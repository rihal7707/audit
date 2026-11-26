import { after, type NextRequest } from 'next/server';
import { getEnv } from '@/lib/env';
import { ensureDbReady } from '@/lib/db';
import { createRequestLogger } from '@/lib/logger';
import { isCountryRestrictedForUnpaidGemini } from '@/lib/config/countries';
import {
  AuditSubmissionSchema,
  CONSENT_VERSION,
} from '@/lib/validation/audit-submission';
import {
  validateUrlStatic,
  validateUrlWithDns,
  UrlGuardError,
} from '@/lib/security/url-guard';
import {
  buildDedupeKey,
  generatePublicToken,
  getClientIp,
  getClientIpHash,
} from '@/lib/security/tokens';
import { isFreeEmailDomain } from '@/lib/security/pii-scrub';
import { enforceAuditSubmissionRateLimit } from '@/lib/security/rate-limit';
import { verifyTurnstileToken } from '@/lib/security/turnstile';
import {
  countAuditsSince,
  createAudit,
  findRecentDuplicateAudit,
} from '@/lib/db/repositories/audits.repo';
import { qualifyLead } from '@/lib/leads/qualify';
import { runAuditPipeline } from '@/lib/pipeline/run-audit';
import { sendNonBlockingNotification } from '@/lib/notifications/notify';
import { apiError, apiSuccess, createRequestId } from '@/lib/http/api-helpers';

export const maxDuration = 60;

async function withSqliteBusyRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const code = (err as { code?: unknown })?.code;
      if ((code === 'SQLITE_BUSY' || msg.includes('SQLITE_BUSY')) && i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 120 * (i + 1)));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

export async function POST(request: NextRequest) {
  const requestId = createRequestId();
  const log = createRequestLogger(requestId);

  try {
    return await handleAuditSubmission(request, requestId, log);
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : String(err);
    const errCode = (err as { code?: unknown })?.code;
    log.error({ err, errCode }, 'Unhandled error in POST /api/audits');
    console.error(`[POST /api/audits] requestId=${requestId} code=${String(errCode ?? '')} error=${errMessage}`);
    return apiError(
      'Server error while starting your audit. Please retry or contact our team.',
      500,
      requestId,
    );
  }
}

async function handleAuditSubmission(
  request: NextRequest,
  requestId: string,
  log: ReturnType<typeof createRequestLogger>,
) {

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return apiError('Invalid request format.', 400, requestId);
  }

  let parsed;
  try {
    parsed = AuditSubmissionSchema.safeParse(rawBody);
  } catch {
    return apiError('Please review the highlighted fields.', 400, requestId);
  }
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || 'form';
      if (!fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return apiError('Please review the highlighted fields.', 400, requestId, { fieldErrors });
  }

  const data = parsed.data;

  // Bot protection 1: honeypot
  if (data.websiteConfirmHp && data.websiteConfirmHp.trim().length > 0) {
    return apiError('Submission could not be accepted.', 400, requestId);
  }

  // Bot protection 2: minimum time-to-submit (~2.5s)
  const elapsedMs = Date.now() - data.formStartedAt;
  if (elapsedMs < 2500) {
    return apiError(
      'Please take a moment to review your details before submitting.',
      400,
      requestId,
    );
  }

  // Bot protection 3: optional Cloudflare Turnstile
  const clientIp = getClientIp(request);
  const turnstile = await verifyTurnstileToken(data.turnstileToken, clientIp);
  if (!turnstile.success) {
    return apiError(turnstile.error || 'Human verification failed.', 400, requestId, {
      fieldErrors: { turnstileToken: turnstile.error || 'Human verification failed.' },
    });
  }

  // Region guard for unpaid Gemini quota
  const env = getEnv();
  if (!env.GEMINI_PAID_TIER && isCountryRestrictedForUnpaidGemini(data.country)) {
    return apiError(
      'The free AI business audit is not yet available in your region.',
      403,
      requestId,
      {
        code: 'REGION_RESTRICTED',
        fieldErrors: { country: 'The free audit is not yet available in your region.' },
      },
    );
  }

  // Validate URL strictly against SSRF rules
  let staticUrl;
  try {
    staticUrl = validateUrlStatic(data.website);
    await validateUrlWithDns(staticUrl.normalizedUrl);
  } catch (err) {
    if (err instanceof UrlGuardError) {
      // Allow non-resolving public-looking hostnames to fall through to LIMITED assessment,
      // while strictly blocking private/internal/invalid schemes/ports/SSRF DNS targets.
      if (err.code !== 'DNS_RESOLUTION_FAILED') {
        return apiError(err.message, 400, requestId, {
          fieldErrors: { website: err.message },
        });
      }
      staticUrl = validateUrlStatic(data.website);
    } else {
      return apiError('Invalid website URL.', 400, requestId, {
        fieldErrors: { website: 'Please enter a valid public website URL.' },
      });
    }
  }

  await ensureDbReady();
  const ipHash = getClientIpHash(request);

  // Dedupe check (same normalized domain + email within 24 hours)
  const twentyFourHoursAgoIso = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const dedupeKey = buildDedupeKey(staticUrl.registrableDomain, data.contactEmail);
  const existingDuplicate = await withSqliteBusyRetry(() =>
    findRecentDuplicateAudit(dedupeKey, twentyFourHoursAgoIso),
  );
  if (existingDuplicate) {
    return apiSuccess(
      {
        token: existingDuplicate.publicToken,
        progressUrl: `/audit/progress/${existingDuplicate.publicToken}`,
        deduplicated: true,
      },
      200,
      requestId,
    );
  }

  // DB-backed IP rate limits
  const rl = await withSqliteBusyRetry(() => enforceAuditSubmissionRateLimit(ipHash));
  if (!rl.allowed) {
    return apiError(rl.reason || 'Rate limit exceeded.', 429, requestId);
  }

  // Global daily cap check
  const recentCount = await withSqliteBusyRetry(() => countAuditsSince(twentyFourHoursAgoIso));
  const dailyCapReached = recentCount >= env.MAX_AUDITS_PER_DAY;

  const publicToken = generatePublicToken();
  const initialScore = qualifyLead({
    industry: data.industry,
    challenges: data.challenges,
    goals: data.goals,
    manualProcesses: data.manualProcesses || null,
    contactRole: data.contactRole || null,
    timeframe: data.timeframe || null,
    contactPhone: data.contactPhone || null,
    marketingConsent: data.marketingConsent,
    enquiryVolume: data.enquiryVolume || null,
    phoneVolume: data.phoneVolume || null,
    toolsUsed: data.toolsUsed || null,
    crawlCoverage: null,
  });

  const audit = await withSqliteBusyRetry(() =>
    createAudit({
    publicToken,
    businessName: data.businessName,
    website: staticUrl.normalizedUrl,
    normalizedDomain: staticUrl.registrableDomain,
    industry: data.industry,
    country: data.country,
    location: data.location || null,
    businessSize: data.businessSize || null,
    businessDescription: data.businessDescription,
    challenges: data.challenges,
    goals: data.goals,
    toolsUsed: data.toolsUsed || null,
    enquiryVolume: data.enquiryVolume || null,
    phoneVolume: data.phoneVolume || null,
    teamSize: data.teamSize || null,
    manualProcesses: data.manualProcesses || null,
    timeframe: data.timeframe || null,
    contactName: data.contactName,
    contactEmail: data.contactEmail,
    contactPhone: data.contactPhone || null,
    contactRole: data.contactRole || null,
    isFreeEmailDomain: isFreeEmailDomain(data.contactEmail),
    consent: true,
    consentVersion: CONSENT_VERSION,
    consentAt: new Date().toISOString(),
    marketingConsent: data.marketingConsent,
    leadScore: initialScore.totalScore,
    leadScoreBreakdown: JSON.stringify(initialScore.breakdown),
    leadReason: initialScore.classificationReason,
    leadPriority: initialScore.priority,
    releaseStatus: env.REPORT_RELEASE_MODE === 'review' ? 'PENDING_REVIEW' : 'AUTO',
    dedupeKey,
    ipHash,
  }),
  );

  void sendNonBlockingNotification({
    event: 'NEW_AUDIT',
    auditId: audit.id,
    businessName: audit.businessName,
    industry: audit.industry,
  });

  if (!dailyCapReached) {
    after(async () => {
      await runAuditPipeline(audit.id, {
        requestId,
        crawlOptions: {
          allowCrossDomainRedirect: data.allowCrossDomainRedirect,
        },
      });
    });
  } else {
    log.warn({ auditId: audit.id }, 'Daily audit cap reached; audit left queued');
  }

  return apiSuccess(
    {
      token: audit.publicToken,
      progressUrl: `/audit/progress/${audit.publicToken}`,
      queuedDueToDailyCap: dailyCapReached,
    },
    201,
    requestId,
  );
}

