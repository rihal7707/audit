'use client';

import * as React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  List,
  MessageSquare,
  Printer,
  Rocket,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import type { AuditReport } from '@/lib/ai/report-schema';
import { getServiceById } from '@/lib/config/services';
import { brandConfig } from '@/lib/config/brand';
import { cn, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  ConfidenceBadge,
  EvidenceTypeBadge,
  PriorityBadge,
  SectionStatusBadge,
} from '@/components/ui/badges';
import { Callout } from '@/components/ui/interactive-controls';
import { CopyButton, DrawerSheet, ModalDialog } from '@/components/ui/overlays';
import { Textarea, Input } from '@/components/ui/form-fields';
import { useToast } from '@/components/ui/toast';
import { BrandWordmark } from '@/components/layout/site-header';
import { WorkflowDiagram } from './workflow-diagram';
import { ImpactEstimator } from './impact-estimator';

export interface ReportViewProps {
  report: AuditReport;
  isSample?: boolean;
  publicToken?: string;
  pagesAttempted?: number;
  pagesExtractedOk?: number;
  inspectedPages?: Array<{
    pageLabel: string;
    url: string;
    pageTitle: string | null;
    extractionStatus: string;
  }>;
  crawlFailureReason?: string | null;
  consultRequested?: boolean;
  pilotRequested?: boolean;
  isAdminPreview?: boolean;
  onReportDeleted?: () => void;
  onSupplementSubmitted?: (progressUrl: string) => void;
}

const REPORT_TOC = [
  { id: 'executive-summary', label: '1. Executive summary' },
  { id: 'audit-snapshot', label: '2. Audit snapshot' },
  { id: 'website-analysis', label: '3. Website analysis' },
  { id: 'automation-opportunities', label: '4. Automation opportunities' },
  { id: 'ai-agents', label: '5. Recommended AI agents' },
  { id: 'implementation-roadmap', label: '6. Implementation roadmap' },
  { id: 'assumptions-limitations', label: '7. Assumptions & limitations' },
  { id: 'next-steps', label: '8. Next steps' },
];

function safeDisplayHostPath(urlStr: string): string {
  try {
    const u = new URL(urlStr);
    return `${u.host}${u.pathname === '/' ? '' : u.pathname}`;
  } catch {
    return urlStr;
  }
}

export function ReportView({
  report,
  isSample = false,
  publicToken,
  pagesAttempted = 5,
  pagesExtractedOk = 5,
  inspectedPages,
  crawlFailureReason,
  consultRequested: initialConsult = false,
  pilotRequested: initialPilot = false,
  isAdminPreview = false,
  onReportDeleted,
  onSupplementSubmitted,
}: ReportViewProps) {
  const { pushToast } = useToast();
  const [activeSection, setActiveSection] = React.useState('executive-summary');
  const [priorityFilter, setPriorityFilter] = React.useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  const [collapsedCategories, setCollapsedCategories] = React.useState<Record<string, boolean>>({});
  const [tocDrawerOpen, setTocDrawerOpen] = React.useState(false);

  // Action dialogs
  const [intentModal, setIntentModal] = React.useState<'DISCUSS' | 'PILOT' | null>(null);
  const [intentMessage, setIntentMessage] = React.useState('');
  const [intentTime, setIntentTime] = React.useState('');
  const [intentSubmitting, setIntentSubmitting] = React.useState(false);
  const [consultRequested, setConsultRequested] = React.useState(initialConsult);
  const [pilotRequested, setPilotRequested] = React.useState(initialPilot);

  // Delete modal
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteConfirmChecked, setDeleteConfirmChecked] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  // Supplement box for LIMITED/NONE audits
  const [supplementText, setSupplementText] = React.useState('');
  const [supplementSubmitting, setSupplementSubmitting] = React.useState(false);
  const [supplementError, setSupplementError] = React.useState<string | null>(null);

  const shareUrl = React.useSyncExternalStore(
    () => () => {},
    () => window.location.href,
    () => '',
  );

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: '-15% 0px -70% 0px' },
    );

    for (const item of REPORT_TOC) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  const toggleCategory = (category: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  const handleIntentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intentModal) return;

    if (isSample || !publicToken || isAdminPreview) {
      pushToast(
        isSample
          ? 'In a live audit, this records your request directly with the Amarketing team.'
          : 'Preview mode — customer intent buttons are disabled for admins.',
        'info',
      );
      setIntentModal(null);
      return;
    }

    setIntentSubmitting(true);
    try {
      const res = await fetch(`/api/reports/${publicToken}/intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: intentModal,
          message: intentMessage.trim() || undefined,
          preferredTime: intentTime.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        pushToast(json.error || 'Could not submit request.', 'error');
        return;
      }
      if (intentModal === 'DISCUSS') setConsultRequested(true);
      if (intentModal === 'PILOT') setPilotRequested(true);
      setIntentModal(null);
      setIntentMessage('');
      setIntentTime('');
      pushToast('Thank you! Your request has been shared with the Amarketing team.');
    } catch {
      pushToast('Network error while recording your request.', 'error');
    } finally {
      setIntentSubmitting(false);
    }
  };

  const handleBookCallClick = async () => {
    if (!isSample && publicToken && !isAdminPreview) {
      void fetch(`/api/reports/${publicToken}/intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'BOOKING_CLICK' }),
      }).catch(() => {});
    }

    if (brandConfig.bookingUrl) {
      window.open(brandConfig.bookingUrl, '_blank', 'noopener,noreferrer');
    } else {
      const subject = encodeURIComponent(
        `Strategy Call — AI Business Audit for ${report.businessOverview.businessName}`,
      );
      const body = encodeURIComponent(
        `Hello Amarketing team,\n\nI would like to book a strategy call to discuss the AI Business Audit for ${report.businessOverview.businessName} (${report.businessOverview.website}).`,
      );
      window.location.href = `mailto:${brandConfig.contactEmail}?subject=${subject}&body=${body}`;
    }
  };

  const handleDeleteAudit = async () => {
    if (!publicToken || !deleteConfirmChecked) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/reports/${publicToken}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      });
      if (!res.ok) {
        const json = await res.json();
        pushToast(json.error || 'Could not delete audit.', 'error');
        return;
      }
      setDeleteOpen(false);
      pushToast('Your audit and associated data have been permanently deleted.');
      onReportDeleted?.();
    } catch {
      pushToast('Network error while deleting audit.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleSupplementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicToken) return;
    setSupplementError(null);
    setSupplementSubmitting(true);
    try {
      const res = await fetch(`/api/reports/${publicToken}/supplement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplementText }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSupplementError(json.error || 'Could not submit additional text.');
        return;
      }
      pushToast('Updating your audit report with your supplied business details...');
      onSupplementSubmitted?.(json.progressUrl);
    } catch {
      setSupplementError('Network error while submitting text.');
    } finally {
      setSupplementSubmitting(false);
    }
  };

  const coverage = report.meta.coverage;
  const isLimitedCoverage = coverage === 'LIMITED' || coverage === 'NONE';

  return (
    <div className="bg-canvas pb-16">
      {/* Sample / Limited persistent banners */}
      {isSample && (
        <div className="border-b border-emerald-200 bg-emerald-50/90 px-4 py-2.5 text-center text-xs sm:text-sm font-medium text-navy-900">
          Illustrative sample – fictional business and simulated findings. Built with our live report
          components to demonstrate deliverable quality.
        </div>
      )}

      {!isSample && isLimitedCoverage && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <div className="mx-auto flex max-w-public items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
            <div>
              <span className="font-semibold">Limited website coverage: </span>
              <span>
                {crawlFailureReason ||
                  'Automated website extraction had limited visibility, so this assessment relies primarily on your questionnaire responses.'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Editorial Navy Cover Band */}
      <section className="print-cover hero-gradient text-white">
        <div className="mx-auto max-w-public px-4 py-12 sm:px-6 lg:py-16">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <BrandWordmark light />
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                FREE AI BUSINESS AUDIT
              </span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-slate-200">
                AI-assisted analysis
              </span>
            </div>
          </div>

          <h1 className="mt-6 font-serif text-3xl font-semibold tracking-tight text-white sm:text-5xl">
            {report.businessOverview.businessName}
          </h1>

          <div className="mt-8 grid gap-4 border-t border-white/15 pt-6 text-sm sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <span className="block text-xs uppercase tracking-wider text-slate-400">Website</span>
              <a
                href={report.businessOverview.website}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="mt-1 inline-flex items-center gap-1 font-mono text-xs text-emerald-400 hover:underline break-all"
              >
                {safeDisplayHostPath(report.businessOverview.website)}
                <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
              </a>
            </div>
            <div>
              <span className="block text-xs uppercase tracking-wider text-slate-400">Industry</span>
              <span className="mt-1 block font-medium text-white">
                {report.businessOverview.industry}
              </span>
            </div>
            <div>
              <span className="block text-xs uppercase tracking-wider text-slate-400">
                Audit Date
              </span>
              <span className="mt-1 block font-medium text-white tabular-nums">
                {formatDate(report.meta.generatedAt)}
              </span>
            </div>
            <div>
              <span className="block text-xs uppercase tracking-wider text-slate-400">
                Pages Inspected
              </span>
              <span className="mt-1 block font-medium text-white tabular-nums">
                {pagesExtractedOk} of {pagesAttempted} attempted
              </span>
            </div>
            <div>
              <span className="block text-xs uppercase tracking-wider text-slate-400">
                Audit Coverage
              </span>
              <span
                className={cn(
                  'mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold',
                  coverage === 'COMPLETE'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : coverage === 'PARTIAL'
                      ? 'bg-blue-400/20 text-blue-200'
                      : 'bg-amber-400/20 text-amber-200',
                )}
              >
                {coverage}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content + Sticky Contents Rail */}
      <div className="mx-auto mt-8 max-w-public px-4 sm:px-6">
        {/* Mobile Contents Trigger */}
        <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-2 lg:hidden">
          <Button variant="outline" size="sm" onClick={() => setTocDrawerOpen(true)}>
            <List className="h-4 w-4" aria-hidden="true" />
            Contents
          </Button>
          <div className="flex items-center gap-2">
            {shareUrl && <CopyButton text={shareUrl} label="Copy link" />}
            <Button variant="primary" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4" aria-hidden="true" />
              Print / PDF
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-10 lg:flex-row lg:items-start">
          {/* Desktop Sticky Rail (240px) */}
          <aside className="no-print hidden w-[240px] shrink-0 lg:sticky lg:top-24 lg:block">
            <Card className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                Report Contents
              </p>
              <nav aria-label="Report sections" className="mt-3 flex flex-col gap-1">
                {REPORT_TOC.map((item) => {
                  const active = activeSection === item.id;
                  return (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      className={cn(
                        'rounded px-2.5 py-2 text-xs font-medium transition-colors',
                        active
                          ? 'bg-navy-900 text-white'
                          : 'text-muted hover:bg-subtle hover:text-ink',
                      )}
                    >
                      {item.label}
                    </a>
                  );
                })}
              </nav>

              <div className="mt-5 flex flex-col gap-2 border-t border-border pt-4">
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full"
                  onClick={() => window.print()}
                >
                  <Printer className="h-4 w-4" aria-hidden="true" />
                  Print / Save PDF
                </Button>
                {shareUrl && (
                  <CopyButton text={shareUrl} label="Copy report link" className="w-full justify-center" />
                )}
              </div>
            </Card>
          </aside>

          {/* Report Document Body (~760-820px max column) */}
          <div className="min-w-0 flex-1 max-w-[840px] space-y-12">
            {/* Evidence Legend */}
            <Card variant="inset" className="p-4 sm:p-5">
              <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  How to read evidence badges in this report
                </p>
                <div className="grid gap-3 text-xs text-muted sm:grid-cols-3">
                  <div className="space-y-1">
                    <EvidenceTypeBadge type="VERIFIED_OBSERVATION" />
                    <p>Directly observed and quoted from the inspected public pages.</p>
                  </div>
                  <div className="space-y-1">
                    <EvidenceTypeBadge type="CUSTOMER_PROVIDED" />
                    <p>Based on operational context you shared in the audit questionnaire.</p>
                  </div>
                  <div className="space-y-1">
                    <EvidenceTypeBadge type="AI_HYPOTHESIS" />
                    <p>Analytical recommendation or item not observed on inspected pages.</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* 1. Executive Summary */}
            <section id="executive-summary" className="scroll-mt-24 space-y-6">
              <div className="border-b border-border pb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-teal-700">
                  Section 01
                </span>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
                  Executive Summary
                </h2>
              </div>

              <Card className="p-6 sm:p-8 space-y-6">
                <p className="text-base sm:text-lg leading-relaxed text-ink">
                  {report.executiveSummary.summary}
                </p>

                <div className="rounded-md border border-border bg-subtle/60 p-4 text-sm">
                  <p className="font-semibold text-ink">Business Overview</p>
                  <p className="mt-1 text-muted leading-relaxed">
                    {report.businessOverview.summary}
                  </p>
                  {report.businessOverview.servicesIdentified.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {report.businessOverview.servicesIdentified.map((srv) => (
                        <span
                          key={srv}
                          className="rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs font-medium text-ink"
                        >
                          {srv}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="rounded-md border border-emerald-200 bg-emerald-50/40 p-5">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-navy-900">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                      What&apos;s working
                    </h3>
                    <ul className="mt-3 space-y-2.5 text-sm text-ink">
                      {report.executiveSummary.positiveObservations.map((obs) => (
                        <li key={obs} className="flex items-start gap-2">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                          <span>{obs}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-md border border-amber-200 bg-amber-50/40 p-5">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-navy-900">
                      <ArrowRight className="h-4 w-4 text-amber-700" aria-hidden="true" />
                      Where the opportunities are
                    </h3>
                    <ul className="mt-3 space-y-2.5 text-sm text-ink">
                      {report.executiveSummary.mainImprovementAreas.map((area) => (
                        <li key={area} className="flex items-start gap-2">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600" />
                          <span>{area}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Card>
            </section>

            {/* 2. Audit Snapshot */}
            <section id="audit-snapshot" className="scroll-mt-24 space-y-5">
              <div className="border-b border-border pb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-teal-700">
                  Section 02
                </span>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
                  Audit Snapshot
                </h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {report.auditSections.map((sec) => (
                  <Card key={sec.category} className="print-break-avoid p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-base font-semibold text-ink">{sec.category}</h3>
                        <SectionStatusBadge status={sec.status} />
                      </div>
                      <p className="mt-2.5 text-sm leading-relaxed text-muted">{sec.summary}</p>
                    </div>
                    <p className="mt-4 text-xs font-medium text-navy-700 tabular-nums">
                      {sec.findings.length}{' '}
                      {sec.findings.length === 1 ? 'finding documented' : 'findings documented'}
                    </p>
                  </Card>
                ))}
              </div>
            </section>

            {/* 3. Website Analysis & Findings */}
            <section id="website-analysis" className="scroll-mt-24 space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-3">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-teal-700">
                    Section 03
                  </span>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
                    Website &amp; Operations Findings
                  </h2>
                </div>

                {/* Screen-only priority filter */}
                <div className="no-print flex flex-wrap gap-1.5" role="group" aria-label="Filter findings by priority">
                  {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setPriorityFilter(level)}
                      className={cn(
                        'min-h-[36px] rounded-full border px-3 py-1 text-xs font-medium transition-colors cursor-pointer',
                        priorityFilter === level
                          ? 'border-navy-900 bg-navy-900 text-white'
                          : 'border-border bg-surface text-muted hover:text-ink',
                      )}
                    >
                      {level === 'ALL' ? 'All priorities' : level}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                {report.auditSections.map((sec) => {
                  const filteredFindings = sec.findings.filter(
                    (f) => priorityFilter === 'ALL' || f.priority === priorityFilter,
                  );
                  if (filteredFindings.length === 0) return null;
                  const isCollapsed = Boolean(collapsedCategories[sec.category]);

                  return (
                    <div key={sec.category} className="space-y-3">
                      <button
                        type="button"
                        onClick={() => toggleCategory(sec.category)}
                        aria-expanded={!isCollapsed}
                        className="flex w-full items-center justify-between rounded-md border border-border bg-surface px-4 py-3 text-left hover:bg-subtle/40 transition-colors cursor-pointer"
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-base font-semibold text-ink">{sec.category}</span>
                          <SectionStatusBadge status={sec.status} />
                        </div>
                        <span className="no-print text-muted">
                          {isCollapsed ? (
                            <ChevronRight className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <ChevronDown className="h-4 w-4" aria-hidden="true" />
                          )}
                        </span>
                      </button>

                      <div className={cn('space-y-4', isCollapsed && 'hidden print-expand')}>
                        {filteredFindings.map((finding, idx) => {
                          const serviceInfo = getServiceById(finding.serviceTag);
                          const priorityBorder =
                            finding.priority === 'HIGH'
                              ? 'border-l-4 border-l-red-600'
                              : finding.priority === 'MEDIUM'
                                ? 'border-l-4 border-l-amber-500'
                                : 'border-l-4 border-l-slate-400';

                          return (
                            <Card
                              key={`${sec.category}-${idx}-${finding.title}`}
                              className={cn('print-break-avoid p-5 sm:p-6', priorityBorder)}
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <h3 className="text-base sm:text-lg font-semibold text-ink">
                                  {finding.title}
                                </h3>
                                <div className="flex flex-wrap gap-1.5">
                                  <PriorityBadge priority={finding.priority} />
                                  <EvidenceTypeBadge type={finding.evidenceType} />
                                  <ConfidenceBadge confidence={finding.confidence} />
                                </div>
                              </div>

                              <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                                <div className="sm:col-span-2">
                                  <dt className="text-xs font-semibold uppercase tracking-wider text-muted">
                                    Observation
                                  </dt>
                                  <dd className="mt-1 text-ink leading-relaxed">
                                    {finding.observation}
                                  </dd>
                                </div>

                                <div className="sm:col-span-2">
                                  <dt className="text-xs font-semibold uppercase tracking-wider text-muted">
                                    Supporting Evidence ({finding.evidenceRef})
                                  </dt>
                                  <dd className="mt-1.5 rounded border border-border bg-subtle/70 p-3">
                                    <blockquote className="font-mono text-xs text-ink leading-relaxed">
                                      &ldquo;{finding.evidence}&rdquo;
                                    </blockquote>
                                    {finding.sourceUrl && (
                                      <a
                                        href={finding.sourceUrl}
                                        target="_blank"
                                        rel="noopener noreferrer nofollow"
                                        className="print-url-link mt-2 inline-flex items-center gap-1 font-mono text-xs font-medium text-teal-700 hover:underline"
                                      >
                                        View source ({safeDisplayHostPath(finding.sourceUrl)})
                                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                                      </a>
                                    )}
                                  </dd>
                                </div>

                                <div>
                                  <dt className="text-xs font-semibold uppercase tracking-wider text-muted">
                                    Why It Matters
                                  </dt>
                                  <dd className="mt-1 text-muted leading-relaxed">
                                    {finding.businessImpact}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="text-xs font-semibold uppercase tracking-wider text-muted">
                                    Recommendation
                                  </dt>
                                  <dd className="mt-1 text-ink leading-relaxed">
                                    {finding.recommendation}
                                  </dd>
                                </div>
                              </dl>

                              {serviceInfo && (
                                <div className="mt-4 border-t border-border pt-3 text-xs text-muted">
                                  Mapped Amarketing capability:{' '}
                                  <span className="font-semibold text-navy-900">
                                    {serviceInfo.name}
                                  </span>
                                </div>
                              )}
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 4. Automation Opportunities */}
            <section id="automation-opportunities" className="scroll-mt-24 space-y-5">
              <div className="border-b border-border pb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-teal-700">
                  Section 04
                </span>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
                  Automation Opportunities
                </h2>
              </div>

              <div className="space-y-5">
                {report.automationOpportunities.map((opp, idx) => {
                  const serviceInfo = getServiceById(opp.serviceTag);
                  return (
                    <Card key={`${idx}-${opp.title}`} className="print-break-avoid p-6">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <h3 className="text-lg font-semibold text-ink">{opp.title}</h3>
                        <div className="flex flex-wrap gap-1.5">
                          <PriorityBadge priority={opp.priority} />
                          <span className="rounded-full border border-border bg-subtle px-2.5 py-0.5 text-xs font-medium text-ink">
                            Complexity: {opp.implementationComplexity}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div className="rounded-md border border-border bg-subtle/50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                            Current Bottleneck
                          </p>
                          <p className="mt-1.5 text-sm leading-relaxed text-ink">{opp.problem}</p>
                        </div>
                        <div className="rounded-md border border-emerald-200 bg-emerald-50/40 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">
                            Proposed Solution
                          </p>
                          <p className="mt-1.5 text-sm leading-relaxed text-ink">
                            {opp.proposedSolution}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                          How It Works
                        </p>
                        <ol className="mt-2 space-y-2 text-sm text-ink">
                          {opp.howItWorks.map((step, sIdx) => (
                            <li key={sIdx} className="flex items-start gap-2.5">
                              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-navy-900 text-xs font-semibold text-white tabular-nums">
                                {sIdx + 1}
                              </span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>

                      <div className="mt-4 rounded-md border border-border bg-surface p-3.5 text-sm">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <span className="font-semibold text-ink">Success metric: </span>
                            <span className="text-teal-700 font-medium">{opp.successMetric}</span>
                          </div>
                          {serviceInfo && (
                            <span className="text-xs text-muted shrink-0">
                              {serviceInfo.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>

            {/* 5. Recommended AI Agents */}
            <section id="ai-agents" className="scroll-mt-24 space-y-5">
              <div className="border-b border-border pb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-teal-700">
                  Section 05
                </span>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
                  Recommended AI Agents
                </h2>
              </div>

              <div className="space-y-5">
                {report.aiAgentRecommendations.map((agent, idx) => {
                  const serviceInfo = getServiceById(agent.serviceTag);
                  return (
                    <Card key={`${idx}-${agent.name}`} className="print-break-avoid p-6 space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-ink">{agent.name}</h3>
                          <p className="mt-1 text-sm text-muted leading-relaxed">{agent.purpose}</p>
                        </div>
                        {serviceInfo && (
                          <span className="rounded-full border border-border bg-subtle px-3 py-1 text-xs font-medium text-navy-800">
                            {serviceInfo.name}
                          </span>
                        )}
                      </div>

                      <WorkflowDiagram steps={agent.workflow} />

                      <p className="text-sm text-ink">
                        <span className="font-semibold">Expected operational benefit: </span>
                        {agent.expectedBenefit}
                      </p>
                    </Card>
                  );
                })}
              </div>

              {/* Client-side optional impact estimator */}
              <ImpactEstimator />
            </section>

            {/* 6. Implementation Roadmap */}
            <section id="implementation-roadmap" className="scroll-mt-24 space-y-5">
              <div className="border-b border-border pb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-teal-700">
                  Section 06
                </span>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
                  30 / 60 / 90-Day Implementation Roadmap
                </h2>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {[
                  {
                    title: 'First 30 Days',
                    subtitle: 'Quick wins & intake capture',
                    items: report.businessRoadmap.first30Days,
                  },
                  {
                    title: 'Days 31–60',
                    subtitle: 'Scheduling & AI assistants',
                    items: report.businessRoadmap.days31To60,
                  },
                  {
                    title: 'Days 61–90',
                    subtitle: 'Reporting & continuous refinement',
                    items: report.businessRoadmap.days61To90,
                  },
                ].map((phase) => (
                  <Card key={phase.title} className="print-break-avoid p-5">
                    <h3 className="text-base font-semibold text-ink">{phase.title}</h3>
                    <p className="text-xs text-muted">{phase.subtitle}</p>
                    <ul className="mt-4 space-y-3 text-sm text-ink">
                      {phase.items.map((item, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle2
                            className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"
                            aria-hidden="true"
                          />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                ))}
              </div>
            </section>

            {/* 7. Assumptions & Limitations */}
            <section id="assumptions-limitations" className="scroll-mt-24 space-y-5">
              <div className="border-b border-border pb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-teal-700">
                  Section 07
                </span>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
                  Assumptions &amp; Limitations
                </h2>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <Card className="print-break-avoid p-5">
                  <h3 className="text-sm font-semibold text-ink">What we inspected</h3>
                  {inspectedPages && inspectedPages.length > 0 ? (
                    <ul className="mt-3 space-y-2 text-xs text-muted">
                      {inspectedPages.map((p) => (
                        <li key={p.pageLabel} className="break-all">
                          <span className="font-mono font-semibold text-ink">{p.pageLabel}: </span>
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className="text-teal-700 hover:underline"
                          >
                            {safeDisplayHostPath(p.url)}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-xs leading-relaxed text-muted">
                      {report.businessOverview.auditCoverage}
                    </p>
                  )}
                </Card>

                <Card className="print-break-avoid p-5">
                  <h3 className="text-sm font-semibold text-ink">What you told us &amp; assumptions</h3>
                  <ul className="mt-3 space-y-2 text-xs leading-relaxed text-muted">
                    {report.assumptions.map((a, i) => (
                      <li key={i}>• {a}</li>
                    ))}
                  </ul>
                </Card>

                <Card className="print-break-avoid p-5">
                  <h3 className="text-sm font-semibold text-ink">Needs further investigation</h3>
                  <ul className="mt-3 space-y-2 text-xs leading-relaxed text-muted">
                    {report.limitations.map((l, i) => (
                      <li key={i}>• {l}</li>
                    ))}
                  </ul>
                </Card>
              </div>

              {/* Supplemental text option for limited coverage customer reports */}
              {!isSample && !isAdminPreview && publicToken && isLimitedCoverage && (
                <Card className="no-print border-amber-200 bg-amber-50/40 p-6">
                  <div className="flex items-start gap-3">
                    <FileText className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-ink">
                        Add public page text to enrich this limited report
                      </h3>
                      <p className="mt-1 text-sm text-muted">
                        Because our crawler had limited access to your site, you can paste public
                        service descriptions or homepage copy below (no personal or patient data) to
                        regenerate an updated report.
                      </p>
                      <form onSubmit={handleSupplementSubmit} className="mt-4 space-y-3">
                        <Textarea
                          label="Public website text or service summary"
                          placeholder="Paste public service descriptions, FAQs, or booking instructions from your website..."
                          value={supplementText}
                          onChange={(e) => setSupplementText(e.target.value)}
                          error={supplementError ?? undefined}
                        />
                        <Button type="submit" variant="primary" loading={supplementSubmitting}>
                          Regenerate Audit With Added Text
                        </Button>
                      </form>
                    </div>
                  </div>
                </Card>
              )}
            </section>

            {/* 8. Next Steps CTA Band */}
            <section id="next-steps" className="scroll-mt-24">
              <div className="print-cover hero-gradient rounded-xl p-8 text-white shadow-md">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  Section 08 — Recommended Next Steps
                </span>
                <h2 className="mt-2 font-serif text-2xl sm:text-3xl font-semibold text-white">
                  Let&apos;s Discuss Your Business Opportunities
                </h2>
                <p className="mt-3 max-w-2xl text-sm sm:text-base leading-relaxed text-slate-200">
                  Your audit has identified opportunities. Let&apos;s discuss which ones make sense
                  for your business and how Amarketing can help implement them.
                </p>

                <ul className="mt-5 space-y-2 text-sm text-slate-200">
                  {report.recommendedNextSteps.map((step, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2
                        className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400"
                        aria-hidden="true"
                      />
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>

                <div className="no-print mt-7 flex flex-wrap gap-3">
                  <Button variant="cta" size="lg" onClick={handleBookCallClick}>
                    <Calendar className="h-4 w-4" aria-hidden="true" />
                    Book a Free Strategy Call
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className="border-white/25 bg-white/10 text-white hover:bg-white/20"
                    onClick={() => setIntentModal('DISCUSS')}
                  >
                    <MessageSquare className="h-4 w-4" aria-hidden="true" />
                    {consultRequested ? 'Audit Discussion Requested' : 'Discuss My Audit'}
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className="border-white/25 bg-white/10 text-white hover:bg-white/20"
                    onClick={() => setIntentModal('PILOT')}
                  >
                    <Rocket className="h-4 w-4" aria-hidden="true" />
                    {pilotRequested ? 'Pilot Requested' : 'Request a Pilot'}
                  </Button>
                </div>

                <p className="mt-6 border-t border-white/15 pt-4 text-xs leading-relaxed text-slate-300">
                  {report.closingMessage}
                </p>
              </div>
            </section>

            {/* Disclaimer + Self-Service Delete */}
            <section className="space-y-4 border-t border-border pt-6 text-xs text-muted">
              <Callout variant="info" title="Preliminary Advisory Disclaimer">
                This audit is a preliminary assessment prepared from publicly accessible website
                information and customer-provided operational details. It does not guarantee
                specific savings, conversion rates, or business results, and any operational
                decisions remain yours.
              </Callout>

              {!isSample && !isAdminPreview && publicToken && (
                <div className="no-print flex flex-wrap items-center justify-between gap-4 rounded-md border border-border bg-surface p-4">
                  <div>
                    <p className="text-sm font-medium text-ink">Manage your audit data</p>
                    <p className="text-xs text-muted">
                      You can permanently delete this audit report and all stored submission data at
                      any time.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)}>
                    <Trash2 className="h-4 w-4 text-red-600" aria-hidden="true" />
                    Delete my audit and data
                  </Button>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      {/* Print-only running footer */}
      <div className="print-only hidden print-running-footer">
        <span>
          {brandConfig.productTitle} — {report.businessOverview.businessName}
        </span>
        <span>Prepared by {brandConfig.legalEntityName}</span>
      </div>

      {/* Mobile Contents Drawer */}
      <DrawerSheet
        open={tocDrawerOpen}
        onOpenChange={setTocDrawerOpen}
        title="Report Contents"
      >
        <nav className="flex flex-col gap-1">
          {REPORT_TOC.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={() => setTocDrawerOpen(false)}
              className="flex min-h-[44px] items-center rounded px-3 text-sm font-medium text-ink hover:bg-subtle"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </DrawerSheet>

      {/* Discuss / Request Pilot Modal */}
      <ModalDialog
        open={intentModal !== null}
        onOpenChange={(open) => !open && setIntentModal(null)}
        title={intentModal === 'PILOT' ? 'Request a Focused AI Pilot' : 'Discuss Your Audit'}
        description="Let the Amarketing team know how you would like to follow up — no obligation."
      >
        <form onSubmit={handleIntentSubmit} className="space-y-4">
          <Input
            label="Preferred contact time or channel (optional)"
            placeholder="e.g. Weekday mornings via email or phone"
            value={intentTime}
            onChange={(e) => setIntentTime(e.target.value)}
          />
          <Textarea
            label="What would you like to explore first? (optional)"
            placeholder="e.g. Missed-call follow-up or connecting our enquiry form to CRM..."
            value={intentMessage}
            onChange={(e) => setIntentMessage(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIntentModal(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={intentSubmitting}>
              Send Request
            </Button>
          </div>
        </form>
      </ModalDialog>

      {/* Self-Service Deletion Confirmation Modal */}
      <ModalDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete audit and all associated data?"
        description="This permanently removes your report, crawled page records, and contact details. This action cannot be undone."
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>The report link will stop working immediately after deletion.</span>
          </div>

          <label className="flex items-start gap-2.5 text-sm text-ink cursor-pointer">
            <input
              type="checkbox"
              checked={deleteConfirmChecked}
              onChange={(e) => setDeleteConfirmChecked(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-border"
            />
            <span>I confirm I want to permanently delete this audit and all stored data.</span>
          </label>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Keep Report
            </Button>
            <Button
              variant="danger"
              disabled={!deleteConfirmChecked}
              loading={deleting}
              onClick={handleDeleteAudit}
            >
              Delete Permanently
            </Button>
          </div>
        </div>
      </ModalDialog>
    </div>
  );
}
