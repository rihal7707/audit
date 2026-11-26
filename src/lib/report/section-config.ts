// src/lib/report/section-config.ts
// Single shared configuration driving report body sections, desktop contents rail,
// mobile Contents sheet, scroll-spy, print view, and landing "What's included" list.

import type { AuditReport } from '@/lib/ai/report-schema';

export interface SectionDef {
  id: string;
  /** Full heading shown in the report body */
  title: string;
  /** Compact label for the Contents rail */
  tocTitle: string;
  /** Group on landing page Deliverable Breakdown */
  landingGroup: 'Understand' | 'Automate' | 'Act on it';
  /** 'section' renders in report body & print; 'panel' opens/focuses the side assistant drawer */
  kind: 'section' | 'panel';
  premium?: boolean;
  /** Optional visibility predicate checked against the report object */
  visible?: (report: AuditReport) => boolean;
}

export const REPORT_SECTIONS: readonly SectionDef[] = [
  {
    id: 'executive-summary',
    title: 'Executive summary',
    tocTitle: 'Executive summary',
    landingGroup: 'Understand',
    kind: 'section',
  },
  {
    id: 'audit-snapshot',
    title: 'Audit snapshot',
    tocTitle: 'Audit snapshot',
    landingGroup: 'Understand',
    kind: 'section',
  },
  {
    id: 'website-analysis',
    title: 'Website analysis',
    tocTitle: 'Website analysis',
    landingGroup: 'Understand',
    kind: 'section',
  },
  {
    id: 'automation-opportunities',
    title: 'Automation opportunities',
    tocTitle: 'Automation opportunities',
    landingGroup: 'Automate',
    kind: 'section',
  },
  {
    id: 'ai-agents',
    title: 'Recommended AI agents',
    tocTitle: 'Recommended AI agents',
    landingGroup: 'Automate',
    kind: 'section',
  },
  {
    id: 'roi',
    title: 'Calculate Your Automation Potential',
    tocTitle: 'ROI Simulator',
    landingGroup: 'Act on it',
    kind: 'section',
  },
  {
    id: 'draft-assets',
    title: 'Draft assets',
    tocTitle: 'Draft assets',
    landingGroup: 'Automate',
    kind: 'section',
    premium: true,
    visible: (r) => Boolean((r as Record<string, unknown>).draftAssets),
  },
  {
    id: 'visitor-journey',
    title: 'Visitor journey',
    tocTitle: 'Visitor journey',
    landingGroup: 'Understand',
    kind: 'section',
    premium: true,
    visible: (r) => Boolean((r as Record<string, unknown>).visitorJourney),
  },
  {
    id: 'quick-wins',
    title: 'Quick wins',
    tocTitle: 'Quick wins',
    landingGroup: 'Act on it',
    kind: 'section',
    premium: true,
    visible: (r) => Boolean((r as Record<string, unknown>).quickWins),
  },
  {
    id: 'implementation-roadmap',
    title: 'Implementation roadmap',
    tocTitle: 'Implementation roadmap',
    landingGroup: 'Act on it',
    kind: 'section',
  },
  {
    id: 'assumptions-limitations',
    title: 'Assumptions & limitations',
    tocTitle: 'Assumptions & limitations',
    landingGroup: 'Act on it',
    kind: 'section',
  },
  {
    id: 'next-steps',
    title: 'Next steps',
    tocTitle: 'Next steps',
    landingGroup: 'Act on it',
    kind: 'section',
  },
  {
    id: 'pilot-proposal',
    title: 'Pilot proposal',
    tocTitle: 'Pilot proposal',
    landingGroup: 'Act on it',
    kind: 'section',
    premium: true,
    visible: (r) => Boolean((r as Record<string, unknown>).pilotProposal),
  },
  {
    id: 'assistant',
    title: 'Ask Your AI Business Consultant',
    tocTitle: 'Ask Your AI Consultant',
    landingGroup: 'Act on it',
    kind: 'panel',
  },
];

export interface NumberedSectionEntry extends SectionDef {
  number: number;
  paddedNumber: string;
  numberedLabel: string;
}

export function getVisibleBodySections(report?: AuditReport): NumberedSectionEntry[] {
  const list = REPORT_SECTIONS.filter((s) => {
    if (s.kind !== 'section') return false;
    if (s.visible) return report ? s.visible(report) : false;
    return !s.premium;
  });
  return list.map((s, idx) => {
    const num = idx + 1;
    const padded = String(num).padStart(2, '0');
    return {
      ...s,
      number: num,
      paddedNumber: padded,
      numberedLabel: `${num}. ${s.tocTitle}`,
    };
  });
}

export function getTocEntries(report?: AuditReport): Array<{
  id: string;
  label: string;
  title: string;
  kind: 'section' | 'panel';
  number?: number;
}> {
  const body = getVisibleBodySections(report).map((s) => ({
    id: s.id,
    label: s.numberedLabel,
    title: s.title,
    kind: 'section' as const,
    number: s.number,
  }));
  const panels = REPORT_SECTIONS.filter((s) => s.kind === 'panel').map((s) => ({
    id: s.id,
    label: s.tocTitle,
    title: s.title,
    kind: 'panel' as const,
  }));
  return [...body, ...panels];
}

export function getLandingIncludedSections(): Array<{
  id: string;
  num: string;
  label: string;
  group: SectionDef['landingGroup'];
}> {
  const items = REPORT_SECTIONS.filter((s) => !s.premium);
  return items.map((s, i) => ({
    id: s.id,
    num: String(i + 1).padStart(2, '0'),
    label: s.id === 'roi' ? `${s.tocTitle} (${s.title})` : s.title,
    group: s.landingGroup,
  }));
}
