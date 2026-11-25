import { VALID_SERVICE_IDS } from '@/lib/config/services';
import type { CrawlCoverage } from '@/lib/db/schema';
import type { ExtractedPageResult } from '@/lib/extraction/extract-page';
import type { DetectedSignal } from '@/lib/extraction/signals';
import type { AuditFinding, AuditReport } from './report-schema';

export interface GroundingContext {
  pages: ExtractedPageResult[];
  signals: DetectedSignal[];
  coverage: CrawlCoverage;
  model: string;
  promptVersion: string;
  reportVersion: string;
  generatedAt: string;
}

export interface GroundingResult {
  report: AuditReport;
  stats: {
    downgradedCount: number;
    removedCount: number;
    strippedUrlCount: number;
    correctedServiceTagCount: number;
  };
}

const URL_IN_TEXT_REGEX = /\b(?:https?:\/\/[^\s)>\]"']+|www\.[a-z0-9.-]+\.[a-z]{2,}[^\s)>\]"']*)/gi;

const UNSUPPORTED_ABSENCE_REGEX =
  /\b(?:does not have|has no|missing|lacks|without any|no\s+(?:online\s+)?(?:booking|chat|form|faq|testimonials?|reviews?|phone|email|crm))\b/i;

function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019']/g, "'")
    .replace(/[\u201C\u201D"]/g, '"')
    .replace(/[^a-z0-9\s:@.+/,-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripUrlsFromText(text: string): { cleaned: string; count: number } {
  let count = 0;
  const cleaned = text.replace(URL_IN_TEXT_REGEX, () => {
    count += 1;
    return '[link removed]';
  });
  return { cleaned, count };
}

function buildPageCorpus(page: ExtractedPageResult): string {
  const parts = [
    page.pageTitle,
    page.extractedText,
    page.metadata.metaDescription,
    ...page.metadata.h1,
    ...page.metadata.h2,
    ...page.metadata.ctaButtons,
    ...page.metadata.visiblePhones,
    ...page.metadata.visibleEmails,
    ...page.metadata.visibleAddresses,
    ...page.metadata.servicesMentioned,
    ...page.metadata.testimonialsSnippet,
    ...page.metadata.signals.filter((s) => s.found).map((s) => `${s.label} ${s.evidence}`),
  ];
  return normalizeForMatch(parts.join(' '));
}

function evidenceMatchesCorpus(evidence: string, corpus: string): boolean {
  if (!evidence || !corpus) return false;
  const segments = evidence
    .split(/\.{3}|…/)
    .map((s) => normalizeForMatch(s))
    .filter((s) => s.length >= 4);

  if (segments.length === 0) return false;

  // Every non-trivial segment (or strong token overlap if paraphrased lightly) must appear
  return segments.every((seg) => {
    if (corpus.includes(seg)) return true;
    // Allow minor punctuation/formatting variance if at least 80% of 4+ char words appear in order
    const words = seg.split(' ').filter((w) => w.length >= 3);
    if (words.length < 3) return false;
    let hits = 0;
    for (const w of words) {
      if (corpus.includes(w)) hits += 1;
    }
    return hits / words.length >= 0.85;
  });
}

export function applyDeterministicGrounding(
  inputReport: AuditReport,
  context: GroundingContext,
): GroundingResult {
  const report = structuredClone(inputReport);
  let downgradedCount = 0;
  let removedCount = 0;
  let strippedUrlCount = 0;
  let correctedServiceTagCount = 0;

  const pageMap = new Map<string, ExtractedPageResult>();
  const corpusMap = new Map<string, string>();
  for (const p of context.pages) {
    pageMap.set(p.pageLabel, p);
    corpusMap.set(p.pageLabel, buildPageCorpus(p));
  }

  const signalMap = new Map<string, DetectedSignal>();
  for (const s of context.signals) {
    signalMap.set(s.id, s);
  }

  const sanitizeText = (text: string): string => {
    const res = stripUrlsFromText(text);
    strippedUrlCount += res.count;
    return res.cleaned;
  };

  // Enforce authoritative metadata
  report.meta = {
    reportVersion: context.reportVersion,
    promptVersion: context.promptVersion,
    model: context.model,
    generatedAt: context.generatedAt,
    coverage: context.coverage,
  };

  report.businessOverview.summary = sanitizeText(report.businessOverview.summary);
  report.businessOverview.auditCoverage = sanitizeText(report.businessOverview.auditCoverage);
  report.executiveSummary.summary = sanitizeText(report.executiveSummary.summary);
  report.executiveSummary.positiveObservations =
    report.executiveSummary.positiveObservations.map(sanitizeText);
  report.executiveSummary.mainImprovementAreas =
    report.executiveSummary.mainImprovementAreas.map(sanitizeText);
  report.closingMessage = sanitizeText(report.closingMessage);
  report.assumptions = report.assumptions.map(sanitizeText);
  report.limitations = report.limitations.map(sanitizeText);
  report.recommendedNextSteps = report.recommendedNextSteps.map(sanitizeText);
  report.businessRoadmap.first30Days = report.businessRoadmap.first30Days.map(sanitizeText);
  report.businessRoadmap.days31To60 = report.businessRoadmap.days31To60.map(sanitizeText);
  report.businessRoadmap.days61To90 = report.businessRoadmap.days61To90.map(sanitizeText);

  for (const section of report.auditSections) {
    section.summary = sanitizeText(section.summary);
    const verifiedFindings: AuditFinding[] = [];

    for (const f of section.findings) {
      f.title = sanitizeText(f.title);
      f.observation = sanitizeText(f.observation);
      f.evidence = sanitizeText(f.evidence);
      f.businessImpact = sanitizeText(f.businessImpact);
      f.recommendation = sanitizeText(f.recommendation);

      if (!VALID_SERVICE_IDS.has(f.serviceTag)) {
        f.serviceTag = 'lead-qualification-crm';
        correctedServiceTagCount += 1;
      }

      if (f.evidenceType === 'VERIFIED_OBSERVATION') {
        const directPage = pageMap.get(f.evidenceRef);
        const matchedSignal = signalMap.get(f.evidenceRef);

        let grounded = false;
        let resolvedUrl: string | null = null;

        if (directPage) {
          const corpus = corpusMap.get(directPage.pageLabel) ?? '';
          if (evidenceMatchesCorpus(f.evidence, corpus)) {
            grounded = true;
            resolvedUrl = directPage.url;
          }
        } else if (matchedSignal && matchedSignal.found) {
          const sigPage = pageMap.get(matchedSignal.pageId);
          const signalCorpus = normalizeForMatch(
            `${matchedSignal.label} ${matchedSignal.evidence} ${corpusMap.get(matchedSignal.pageId) ?? ''}`,
          );
          if (evidenceMatchesCorpus(f.evidence, signalCorpus)) {
            grounded = true;
            resolvedUrl = sigPage?.url ?? null;
          }
        }

        if (grounded && resolvedUrl) {
          f.sourceUrl = resolvedUrl;
          verifiedFindings.push(f);
        } else {
          // Downgrade ungrounded VERIFIED_OBSERVATION
          downgradedCount += 1;
          f.evidenceType = 'AI_HYPOTHESIS';
          f.confidence = 'LOW';
          f.sourceUrl = null;

          // If downgraded finding reads as an unsupported absence claim, remove it
          const combined = `${f.title} ${f.observation}`;
          if (
            UNSUPPORTED_ABSENCE_REGEX.test(combined) &&
            !/not observed on the (?:pages )?inspected/i.test(combined)
          ) {
            removedCount += 1;
            continue;
          }
          verifiedFindings.push(f);
        }
      } else {
        // CUSTOMER_PROVIDED or AI_HYPOTHESIS: strip any hallucinated sourceUrl unless valid pageRef
        const refPage = pageMap.get(f.evidenceRef);
        f.sourceUrl =
          f.evidenceType === 'CUSTOMER_PROVIDED'
            ? null
            : refPage
              ? refPage.url
              : null;
        verifiedFindings.push(f);
      }
    }

    section.findings = verifiedFindings;
  }

  for (const opp of report.automationOpportunities) {
    opp.title = sanitizeText(opp.title);
    opp.problem = sanitizeText(opp.problem);
    opp.proposedSolution = sanitizeText(opp.proposedSolution);
    opp.businessBenefit = sanitizeText(opp.businessBenefit);
    opp.successMetric = sanitizeText(opp.successMetric);
    opp.howItWorks = opp.howItWorks.map(sanitizeText);
    if (!VALID_SERVICE_IDS.has(opp.serviceTag)) {
      opp.serviceTag = 'lead-qualification-crm';
      correctedServiceTagCount += 1;
    }
  }

  for (const agent of report.aiAgentRecommendations) {
    agent.name = sanitizeText(agent.name);
    agent.purpose = sanitizeText(agent.purpose);
    agent.expectedBenefit = sanitizeText(agent.expectedBenefit);
    agent.workflow = agent.workflow.map(sanitizeText);
    if (!VALID_SERVICE_IDS.has(agent.serviceTag)) {
      agent.serviceTag = 'website-enquiry-assistant';
      correctedServiceTagCount += 1;
    }
  }

  return {
    report,
    stats: {
      downgradedCount,
      removedCount,
      strippedUrlCount,
      correctedServiceTagCount,
    },
  };
}

