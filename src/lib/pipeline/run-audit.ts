import 'server-only';
import { ensureDbReady } from '@/lib/db';
import { getEnv, isGeminiConfigured } from '@/lib/env';
import { createRequestLogger } from '@/lib/logger';
import {
  acquireProcessingLock,
  findAuditById,
  listAuditPages,
  recordAuditEvent,
  releaseProcessingLock,
  replaceAuditPages,
  saveGeneratedReport,
  updateAuditLeadScoring,
  updateAuditPipelineStage,
  updateAuditProgress,
  type AuditPageRow,
  type AuditRow,
} from '@/lib/db/repositories/audits.repo';
import type { CrawlCoverage } from '@/lib/db/schema';
import { crawlWebsite, type CrawlOptions } from '@/lib/extraction/crawler';
import type { ExtractedPageMetadata, ExtractedPageResult } from '@/lib/extraction/extract-page';
import { mergeSignalsAcrossPages, type DetectedSignal } from '@/lib/extraction/signals';
import {
  GeminiQuotaError,
  generateGroundedAuditReport,
} from '@/lib/ai/gemini-client';
import { PROMPT_VERSION, REPORT_VERSION } from '@/lib/ai/audit-system-prompt';
import { qualifyLead } from '@/lib/leads/qualify';
import { sendNonBlockingNotification } from '@/lib/notifications/notify';
import { validateUrlStatic } from '@/lib/security/url-guard';

export const PIPELINE_STAGES_METADATA = [
  { index: 1, key: 'VALIDATING', label: 'Validating website' },
  { index: 2, key: 'CHECKING_ACCESS', label: 'Checking website accessibility' },
  { index: 3, key: 'DISCOVERING_PAGES', label: 'Discovering relevant pages' },
  { index: 4, key: 'EXTRACTING', label: 'Extracting business information' },
  { index: 5, key: 'ANALYSING', label: 'Analysing website evidence' },
  { index: 6, key: 'GENERATING_AI', label: 'Identifying AI opportunities' },
  { index: 7, key: 'BUILDING_REPORT', label: 'Generating personalised report' },
  { index: 8, key: 'SAVING', label: 'Saving audit' },
  { index: 9, key: 'COMPLETED', label: 'Completed' },
] as const;

export interface RunAuditOptions {
  skipCrawlIfStored?: boolean;
  bypassCrawlCache?: boolean;
  crawlOptions?: CrawlOptions;
  requestId?: string;
}

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function hydrateStoredPages(rows: AuditPageRow[]): {
  pages: ExtractedPageResult[];
  signals: DetectedSignal[];
  possibleInjection: boolean;
  siteLanguage: string | null;
} {
  const pages: ExtractedPageResult[] = rows.map((row) => {
    let meta: ExtractedPageMetadata;
    try {
      meta = JSON.parse(row.extractedMetadata || '{}') as ExtractedPageMetadata;
    } catch {
      meta = {
        title: row.pageTitle || '',
        metaDescription: '',
        canonicalUrl: row.url,
        lang: '',
        h1: [],
        h2: [],
        navLinks: [],
        internalLinks: [],
        externalLinks: [],
        ctaButtons: [],
        visiblePhones: [],
        visibleEmails: [],
        visibleAddresses: [],
        servicesMentioned: [],
        imageAlts: [],
        testimonialsSnippet: [],
        bookingAndEnquiryLinks: [],
        socialLinks: [],
        jsonLdTypes: [],
        openGraph: {},
        signals: [],
        possibleInjection: { flagged: false, matches: [] },
        isJsShell: row.extractionStatus === 'JS_SHELL',
      };
    }

    return {
      pageLabel: row.pageLabel,
      url: row.url,
      pageTitle: row.pageTitle || row.url,
      httpStatus: row.httpStatus ?? 200,
      extractedText: row.extractedText || '',
      metadata: meta,
      contentHash: row.contentHash || '',
      extractionStatus:
        row.extractionStatus === 'JS_SHELL'
          ? 'JS_SHELL'
          : row.extractionStatus === 'FAILED'
            ? 'FAILED'
            : 'OK',
    };
  });

  const signals = mergeSignalsAcrossPages(pages.map((p) => p.metadata.signals || []));
  const possibleInjection = pages.some((p) => p.metadata.possibleInjection?.flagged);
  const siteLanguage = pages[0]?.metadata.lang || null;

  return { pages, signals, possibleInjection, siteLanguage };
}

async function enterStage(
  auditId: number,
  auditStatus: AuditRow['auditStatus'],
  stageIndex: number,
  stageLabel: string,
  eventType: string,
  message: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await updateAuditProgress(auditId, {
    auditStatus,
    currentStageIndex: stageIndex,
    currentStageLabel: stageLabel,
    heartbeatAt: new Date().toISOString(),
  });
  await recordAuditEvent(auditId, eventType, message, metadata);
}

export async function runAuditPipeline(
  auditId: number,
  options: RunAuditOptions = {},
): Promise<{ status: AuditRow['auditStatus']; error?: string }> {
  await ensureDbReady();
  const reqId = options.requestId || `pipeline-${auditId}`;
  const log = createRequestLogger(reqId, { auditId });

  const lockAcquired = await acquireProcessingLock(auditId, 2, 300);
  if (!lockAcquired) {
    await updateAuditProgress(auditId, {
      auditStatus: 'QUEUED',
      currentStageLabel: 'Waiting for available processing slot',
      heartbeatAt: new Date().toISOString(),
    });
    await recordAuditEvent(
      auditId,
      'CONCURRENCY_QUEUED',
      'Audit queued because maximum concurrent analysis slots are currently busy.',
    );
    return { status: 'QUEUED' };
  }

  try {
    const audit = await findAuditById(auditId);
    if (!audit) {
      return { status: 'FAILED', error: 'Audit record not found.' };
    }

    if (audit.pipelineStage === 'NEW') {
      await updateAuditPipelineStage(auditId, 'ANALYSIS_IN_PROGRESS', 'Background analysis started');
    }

    const storedPages = await listAuditPages(auditId);
    const hasStoredCrawl =
      storedPages.length > 0 && (options.skipCrawlIfStored !== false || audit.crawlCoverage !== null);

    let crawlCoverage: CrawlCoverage = audit.crawlCoverage ?? 'NONE';
    let crawlFailureReason: string | null = audit.crawlFailureReason ?? null;
    let pages: ExtractedPageResult[] = [];
    let signals: DetectedSignal[] = [];
    let siteLanguage: string | null = null;
    let possibleInjection = false;

    if (hasStoredCrawl) {
      await enterStage(
        auditId,
        'EXTRACTING',
        4,
        'Using saved website evidence',
        'CRAWL_REUSED',
        `Reusing ${storedPages.length} already-extracted page(s) for idempotent generation.`,
        { pageCount: storedPages.length },
      );
      const hydrated = hydrateStoredPages(storedPages);
      pages = hydrated.pages;
      signals = hydrated.signals;
      possibleInjection = hydrated.possibleInjection;
      siteLanguage = hydrated.siteLanguage;
      if (!audit.crawlCoverage) {
        crawlCoverage = pages.filter((p) => p.extractionStatus === 'OK').length >= 3
          ? 'COMPLETE'
          : pages.length > 0
            ? 'PARTIAL'
            : 'LIMITED';
      }
    } else {
      // Stage 1: Validating website
      await enterStage(
        auditId,
        'VALIDATING',
        1,
        'Validating website',
        'STAGE_VALIDATING',
        'Validating submitted website URL and security constraints.',
      );

      validateUrlStatic(audit.website, {
        allowLocalTestFixture: options.crawlOptions?.allowLocalTestFixture,
      });

      // Stage 2: Checking website accessibility
      await enterStage(
        auditId,
        'CHECKING_ACCESS',
        2,
        'Checking website accessibility',
        'STAGE_CHECKING_ACCESS',
        'Checking robots.txt rules and homepage reachability.',
      );

      // Stage 3: Discovering relevant pages
      await enterStage(
        auditId,
        'DISCOVERING_PAGES',
        3,
        'Discovering relevant pages',
        'STAGE_DISCOVERING_PAGES',
        'Inspecting navigation and sitemap to select up to 5 public pages.',
      );

      const crawlRes = await crawlWebsite(audit.website, {
        ...options.crawlOptions,
        bypassCache: options.bypassCrawlCache,
        onPageProgress: async (attempted, totalPlanned) => {
          await updateAuditProgress(auditId, {
            auditStatus: 'DISCOVERING_PAGES',
            currentStageIndex: 3,
            currentStageLabel: `Inspecting page ${attempted} of ${totalPlanned}`,
            heartbeatAt: new Date().toISOString(),
          });
        },
      });

      crawlCoverage = crawlRes.coverage;
      crawlFailureReason = crawlRes.failureReason;
      pages = crawlRes.pages;
      signals = crawlRes.signals;
      siteLanguage = crawlRes.siteLanguage;
      possibleInjection = crawlRes.possibleInjection;

      // Stage 4: Extracting business information
      await enterStage(
        auditId,
        'EXTRACTING',
        4,
        'Extracting business information',
        'STAGE_EXTRACTING',
        `Extracted ${pages.length} page(s) with coverage status ${crawlCoverage}.`,
        {
          coverage: crawlCoverage,
          pagesCount: pages.length,
          fromCache: crawlRes.fromCache,
          possibleInjection,
        },
      );

      const nowIso = new Date().toISOString();
      await replaceAuditPages(
        auditId,
        pages.map((p) => ({
          pageLabel: p.pageLabel,
          url: p.url,
          pageTitle: p.pageTitle,
          httpStatus: p.httpStatus,
          extractedText: p.extractedText,
          extractedMetadata: JSON.stringify(p.metadata),
          contentHash: p.contentHash,
          extractionStatus: p.extractionStatus,
          fetchedAt: nowIso,
        })),
      );

      await updateAuditProgress(auditId, {
        crawlCoverage,
        crawlFailureReason,
      });
    }

    // Stage 5: Analysing website evidence
    await enterStage(
      auditId,
      'ANALYSING',
      5,
      'Analysing website evidence',
      'STAGE_ANALYSING',
      'Preparing verified signals and scrubbing free-text context for AI analysis.',
      { signalsCount: signals.length, coverage: crawlCoverage },
    );

    if (!isGeminiConfigured() && process.env.NODE_ENV !== 'test') {
      await updateAuditProgress(auditId, {
        auditStatus: 'FAILED',
        lastError: 'AI analysis service is not configured yet (missing GEMINI_API_KEY).',
        heartbeatAt: new Date().toISOString(),
      });
      await recordAuditEvent(
        auditId,
        'AUDIT_FAILED',
        'Cannot run AI analysis because GEMINI_API_KEY is not configured.',
      );
      return { status: 'FAILED', error: 'AI service not configured' };
    }

    // Stage 6: Identifying AI opportunities (single Gemini call)
    await enterStage(
      auditId,
      'GENERATING',
      6,
      'Identifying AI opportunities',
      'STAGE_GENERATING_AI',
      'Running Gemini structured audit analysis.',
    );

    const challenges = parseJsonArray(audit.challenges);
    const goals = parseJsonArray(audit.goals);

    const generationResult = await generateGroundedAuditReport({
      businessName: audit.businessName,
      website: audit.website,
      industry: audit.industry,
      country: audit.country,
      location: audit.location,
      businessSize: audit.businessSize,
      businessDescription: audit.businessDescription,
      challenges,
      goals,
      toolsUsed: audit.toolsUsed,
      enquiryVolume: audit.enquiryVolume,
      phoneVolume: audit.phoneVolume,
      teamSize: audit.teamSize,
      manualProcesses: audit.manualProcesses,
      timeframe: audit.timeframe,
      supplementText: audit.supplementText,
      crawlCoverage,
      crawlFailureReason,
      siteLanguage,
      signals,
      pages,
    });

    // Stage 7: Generating personalised report (grounding + validation summary)
    await enterStage(
      auditId,
      'GENERATING',
      7,
      'Generating personalised report',
      'STAGE_GROUNDING_COMPLETE',
      'Validated structured report and applied deterministic citation grounding.',
      {
        callsUsed: generationResult.callsUsed,
        model: generationResult.usedModel,
        groundingStats: generationResult.stats,
      },
    );

    // Stage 8: Saving audit
    await enterStage(
      auditId,
      'SAVING',
      8,
      'Saving audit',
      'STAGE_SAVING',
      'Saving audit report, findings, and updated lead score.',
    );

    const env = getEnv();
    const isLimited = crawlCoverage === 'LIMITED' || crawlCoverage === 'NONE';
    const isReviewMode = env.REPORT_RELEASE_MODE === 'review';

    const finalAuditStatus: AuditRow['auditStatus'] = isReviewMode
      ? 'PENDING_REVIEW'
      : isLimited
        ? 'COMPLETED_LIMITED'
        : 'COMPLETED';

    const finalReleaseStatus: AuditRow['releaseStatus'] = isReviewMode ? 'PENDING_REVIEW' : 'AUTO';

    const flatFindings = generationResult.report.auditSections.flatMap((section) =>
      section.findings.map((f) => ({
        category: section.category,
        finding: f.title,
        priority: f.priority,
        evidenceType: f.evidenceType,
        confidence: f.confidence,
        evidence: f.evidence,
        recommendation: f.recommendation,
      })),
    );

    await saveGeneratedReport(auditId, {
      reportJson: JSON.stringify(generationResult.report),
      reportVersion: REPORT_VERSION,
      promptVersion: PROMPT_VERSION,
      model: generationResult.usedModel,
      auditStatus: finalAuditStatus,
      releaseStatus: finalReleaseStatus,
      crawlCoverage,
      findings: flatFindings,
    });

    // Recompute lead score with final crawl coverage
    const scoring = qualifyLead({
      industry: audit.industry,
      challenges,
      goals,
      manualProcesses: audit.manualProcesses,
      contactRole: audit.contactRole,
      timeframe: audit.timeframe,
      consultRequestedAt: audit.consultRequestedAt,
      pilotRequestedAt: audit.pilotRequestedAt,
      bookingClickedAt: audit.bookingClickedAt,
      contactPhone: audit.contactPhone,
      marketingConsent: audit.marketingConsent,
      crawlCoverage,
      enquiryVolume: audit.enquiryVolume,
      phoneVolume: audit.phoneVolume,
      toolsUsed: audit.toolsUsed,
    });

    await updateAuditLeadScoring(auditId, {
      leadScore: scoring.totalScore,
      leadScoreBreakdown: JSON.stringify(scoring.breakdown),
      leadReason: scoring.classificationReason,
      leadPriority: scoring.priority,
    });

    if (audit.pipelineStage === 'NEW' || audit.pipelineStage === 'ANALYSIS_IN_PROGRESS') {
      await updateAuditPipelineStage(
        auditId,
        'REPORT_GENERATED',
        isLimited ? 'Report generated with limited website coverage' : 'Report generated successfully',
      );
    }

    await recordAuditEvent(
      auditId,
      'AUDIT_COMPLETED',
      `Audit pipeline finished with status ${finalAuditStatus}.`,
      {
        coverage: crawlCoverage,
        leadPriority: scoring.priority,
        leadScore: scoring.totalScore,
        possibleInjection,
      },
    );

    // Non-blocking notifications
    if (scoring.priority === 'HOT') {
      void sendNonBlockingNotification({
        event: 'HOT_LEAD',
        auditId,
        businessName: audit.businessName,
        industry: audit.industry,
      });
    }
    if (finalReleaseStatus === 'AUTO') {
      void sendNonBlockingNotification({
        event: 'REPORT_READY',
        auditId,
        businessName: audit.businessName,
        industry: audit.industry,
        publicToken: audit.publicToken,
        customerEmail: audit.contactEmail,
      });
    }

    log.info({ finalAuditStatus, crawlCoverage }, 'Audit pipeline completed');
    return { status: finalAuditStatus };
  } catch (err) {
    const existing = await findAuditById(auditId);
    const nextRetry = (existing?.retryCount ?? 0) + 1;

    if (err instanceof GeminiQuotaError) {
      await updateAuditProgress(auditId, {
        auditStatus: 'WAITING_FOR_QUOTA',
        retryCount: nextRetry,
        lastError: 'AI analysis quota is temporarily busy. Your saved website evidence is preserved and will resume automatically.',
        heartbeatAt: new Date().toISOString(),
      });
      await recordAuditEvent(
        auditId,
        'WAITING_FOR_QUOTA',
        'Gemini API quota/availability reached (429/503). Crawl data preserved for automatic or manual resume.',
        { statusCode: err.statusCode },
      );
      return { status: 'WAITING_FOR_QUOTA' };
    }

    const safeMessage =
      err instanceof Error && err.message.includes('schema validation')
        ? 'The AI report response did not pass validation checks. You can retry generation safely.'
        : 'We encountered a temporary issue while preparing your audit. Please retry or contact our team.';

    await updateAuditProgress(auditId, {
      auditStatus: 'FAILED',
      retryCount: nextRetry,
      lastError: safeMessage,
      heartbeatAt: new Date().toISOString(),
    });
    const safeStatus =
      err && typeof err === 'object' && 'status' in err
        ? (err as { status?: unknown }).status
        : undefined;
    await recordAuditEvent(auditId, 'AUDIT_FAILED', safeMessage, {
      errorName: err instanceof Error ? err.name : 'UnknownError',
      statusCode: typeof safeStatus === 'number' ? safeStatus : null,
    });

    log.error({ err }, 'Audit pipeline failed');
    return { status: 'FAILED', error: safeMessage };
  } finally {
    await releaseProcessingLock(auditId).catch(() => {});
  }
}

