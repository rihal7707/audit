// src/lib/report/section-config.ts
// Shared ordered list of report sections.
// Data-only: no component imports so it can be used server-side and client-side.

export interface SectionDef {
  id: string;       // slug for scroll-spy, hash, and element id
  title: string;    // human-readable; numbering generated from array index
  premium?: boolean;
  /** key on AuditReport to check; if set and falsy the section is hidden */
  reportKey?: string;
}

export const REPORT_SECTIONS: SectionDef[] = [
  { id: 'executive-summary',        title: 'Executive summary' },
  { id: 'audit-snapshot',           title: 'Audit snapshot' },
  { id: 'website-analysis',         title: 'Website analysis' },
  { id: 'automation-opportunities', title: 'Automation opportunities' },
  { id: 'ai-agents',               title: 'Recommended AI agents' },
  { id: 'roi-simulator',           title: 'Calculate Your Automation Potential' },
  { id: 'implementation-roadmap',   title: 'Implementation roadmap' },
  { id: 'assumptions-limitations',  title: 'Assumptions & limitations' },
  { id: 'next-steps',              title: 'Next steps' },
  // premium add-ons – shown only when present in report data
  { id: 'draft-assets',      title: 'Draft assets',      premium: true, reportKey: 'draftAssets' },
  { id: 'visitor-journey',   title: 'Visitor journey',   premium: true, reportKey: 'visitorJourney' },
  { id: 'quick-wins',        title: 'Quick wins',        premium: true, reportKey: 'quickWins' },
  { id: 'pilot-proposal',    title: 'Pilot proposal',    premium: true, reportKey: 'pilotProposal' },
];

/** Build the numbered TOC from the shared config, optionally filtering by report data */
export function buildToc(report?: Record<string, unknown>): Array<{ id: string; label: string }> {
  const visible = REPORT_SECTIONS.filter((s) => {
    if (!s.reportKey || !report) return !s.premium; // core sections always visible
    return Boolean(report[s.reportKey]);
  });
  return visible.map((s, i) => ({ id: s.id, label: `${i + 1}. ${s.title}` }));
}
