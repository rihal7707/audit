import { AuditReportSchema, type AuditReport } from '@/lib/ai/report-schema';
import type { AuditPageRow, AuditRow } from '@/lib/db/repositories/audits.repo';
import type { AuditStatus, CrawlCoverage, ReleaseStatus } from '@/lib/db/schema';

/**
 * Strictly allow-listed public report DTO.
 * Never includes contactName, contactEmail, contactPhone, contactRole,
 * leadScore, leadPriority, auditNotes, ipHash, or internal admin fields.
 */
export interface PublicReportDto {
  publicToken: string;
  businessName: string;
  website: string;
  industry: string;
  auditStatus: AuditStatus;
  releaseStatus: ReleaseStatus;
  crawlCoverage: CrawlCoverage | null;
  crawlFailureReason: string | null;
  pagesAttempted: number;
  pagesExtractedOk: number;
  inspectedPages: Array<{
    pageLabel: string;
    url: string;
    pageTitle: string | null;
    extractionStatus: string;
  }>;
  hasSupplementText: boolean;
  challenges: string[];
  consultRequested: boolean;
  pilotRequested: boolean;
  createdAt: string;
  report: AuditReport | null;
}

export function serializePublicReportDto(
  audit: AuditRow,
  pages: AuditPageRow[],
): PublicReportDto {
  const canRevealReport =
    audit.releaseStatus !== 'PENDING_REVIEW' &&
    audit.releaseStatus !== 'REVOKED' &&
    Boolean(audit.reportJson);

  let parsedReport: AuditReport | null = null;
  if (canRevealReport && audit.reportJson) {
    try {
      const checked = AuditReportSchema.safeParse(JSON.parse(audit.reportJson));
      if (checked.success) {
        parsedReport = checked.data;
      }
    } catch {
      parsedReport = null;
    }
  }

  let challenges: string[] = [];
  try {
    const raw = JSON.parse(audit.challenges);
    if (Array.isArray(raw)) {
      challenges = raw.filter((c): c is string => typeof c === 'string');
    }
  } catch {
    challenges = [];
  }

  return {
    publicToken: audit.publicToken,
    businessName: audit.businessName,
    website: audit.website,
    industry: audit.industry,
    auditStatus: audit.auditStatus,
    releaseStatus: audit.releaseStatus,
    crawlCoverage: audit.crawlCoverage,
    crawlFailureReason: audit.crawlFailureReason,
    pagesAttempted: pages.length,
    pagesExtractedOk: pages.filter((p) => p.extractionStatus === 'OK').length,
    inspectedPages: pages.map((p) => ({
      pageLabel: p.pageLabel,
      url: p.url,
      pageTitle: p.pageTitle,
      extractionStatus: p.extractionStatus,
    })),
    hasSupplementText: Boolean(audit.supplementText && audit.supplementText.trim().length > 0),
    challenges,
    consultRequested: Boolean(audit.consultRequestedAt),
    pilotRequested: Boolean(audit.pilotRequestedAt),
    createdAt: audit.createdAt,
    report: parsedReport,
  };
}

