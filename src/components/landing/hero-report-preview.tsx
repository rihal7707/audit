import Link from 'next/link';
import { ArrowRight, CheckCircle2, ExternalLink } from 'lucide-react';
import { WILLOW_CREEK_SAMPLE_REPORT } from '@/lib/sample/willow-creek';
import { EvidenceTypeBadge, PriorityBadge, SectionStatusBadge } from '@/components/ui/badges';

export function HeroReportPreview() {
  const sample = WILLOW_CREEK_SAMPLE_REPORT;
  const topFinding = sample.auditSections[1]?.findings[0];
  const topOpportunity = sample.automationOpportunities[0];

  return (
    <div className="relative">
      <div className="lg:rotate-[1.5deg] rounded-xl border border-white/15 bg-surface text-ink shadow-lg overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-2 border-b border-border bg-navy-900 px-4 py-3 text-white">
          <div className="min-w-0">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
              Free AI Business Audit
            </span>
            <p className="truncate font-serif text-base font-semibold">
              {sample.businessOverview.businessName}
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
            Illustrative sample
          </span>
        </div>

        {/* Body fed from real sample report data */}
        <div className="space-y-4 p-4 sm:p-5">
          <div className="grid grid-cols-2 gap-2.5">
            {sample.auditSections.slice(0, 2).map((sec) => (
              <div
                key={sec.category}
                className="rounded-md border border-border bg-subtle/60 p-3 space-y-1.5"
              >
                <p className="truncate text-xs font-semibold text-ink">{sec.category}</p>
                <SectionStatusBadge status={sec.status} />
              </div>
            ))}
          </div>

          {topFinding && (
            <div className="rounded-md border border-border border-l-4 border-l-red-600 bg-surface p-3.5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <PriorityBadge priority={topFinding.priority} />
                <EvidenceTypeBadge type={topFinding.evidenceType} />
              </div>
              <p className="text-sm font-semibold text-ink leading-snug">{topFinding.title}</p>
              <p className="rounded bg-subtle/80 px-2.5 py-1.5 font-mono text-[11px] text-muted">
                &ldquo;{topFinding.evidence}&rdquo;
              </p>
            </div>
          )}

          {topOpportunity && (
            <div className="hidden sm:block rounded-md border border-emerald-200 bg-emerald-50/50 p-3.5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-700">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Recommended Automation</span>
              </div>
              <p className="text-sm font-semibold text-ink">{topOpportunity.title}</p>
              <p className="text-xs text-muted line-clamp-2">{topOpportunity.proposedSolution}</p>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-border pt-3 text-xs">
            <span className="text-muted">Fictional example · 5 pages simulated</span>
            <Link
              href="/sample-report"
              className="inline-flex items-center gap-1 font-semibold text-teal-700 hover:underline"
            >
              Inspect full sample
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>

      {/* Subtle layered depth card on desktop only */}
      <div
        aria-hidden="true"
        className="hidden lg:flex items-center justify-between -mt-3 mx-4 rounded-b-xl border border-t-0 border-white/15 bg-navy-800/90 px-4 py-2 text-[11px] text-slate-300"
      >
        <span>30 / 60 / 90-day roadmap included</span>
        <span className="inline-flex items-center gap-1 text-emerald-400">
          Print-ready A4 deliverable
          <ExternalLink className="h-3 w-3" />
        </span>
      </div>
    </div>
  );
}

