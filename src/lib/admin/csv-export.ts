import type { AuditRow } from '@/lib/db/repositories/audits.repo';

const FORMULA_PREFIX_REGEX = /^[=+\-@\t\r]/;

export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let str = String(value);
  if (FORMULA_PREFIX_REGEX.test(str)) {
    str = `'${str}`;
  }
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function buildAuditsCsv(rows: AuditRow[]): string {
  const headers = [
    'ID',
    'Submitted At',
    'Business Name',
    'Website',
    'Industry',
    'Country',
    'Contact Name',
    'Contact Email',
    'Contact Phone',
    'Contact Role',
    'Free Email Domain',
    'Audit Status',
    'Crawl Coverage',
    'Lead Score',
    'Effective Priority',
    'Auto Priority',
    'Priority Override',
    'Pipeline Stage',
    'Consult Requested',
    'Pilot Requested',
    'Follow Up At',
  ];

  const lines: string[] = [headers.map(sanitizeCsvCell).join(',')];

  for (const row of rows) {
    const effectivePriority = row.leadPriorityOverride ?? row.leadPriority;
    const cells = [
      row.id,
      row.createdAt,
      row.businessName,
      row.website,
      row.industry,
      row.country,
      row.contactName,
      row.contactEmail,
      row.contactPhone ?? '',
      row.contactRole ?? '',
      row.isFreeEmailDomain ? 'Yes' : 'No',
      row.auditStatus,
      row.crawlCoverage ?? '',
      row.leadScore,
      effectivePriority,
      row.leadPriority,
      row.leadPriorityOverride ?? '',
      row.pipelineStage,
      row.consultRequestedAt ? 'Yes' : 'No',
      row.pilotRequestedAt ? 'Yes' : 'No',
      row.followUpAt ?? '',
    ];
    lines.push(cells.map(sanitizeCsvCell).join(','));
  }

  // UTF-8 BOM for Excel compatibility
  return `\uFEFF${lines.join('\r\n')}`;
}

