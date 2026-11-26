'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import type {
  AuditEventRow,
  AuditFindingRow,
  AuditNoteRow,
  AuditPageRow,
  AuditRow,
  AuditStageHistoryRow,
} from '@/lib/db/repositories/audits.repo';
import { LEAD_PRIORITIES, PIPELINE_STAGES, type PipelineStage } from '@/lib/db/schema';
import { AuditReportSchema, type AuditReport } from '@/lib/ai/report-schema';
import type { LeadFactorScore } from '@/lib/leads/qualify';
import type { ExtractedPageMetadata } from '@/lib/extraction/extract-page';
import { ADMIN_CSRF_HEADER } from '@/lib/security/admin-session-token';
import { cn, formatDate, formatDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Select, Textarea } from '@/components/ui/form-fields';
import {
  AuditStatusBadge,
  LeadPriorityBadge,
  PipelineStageBadge,
} from '@/components/ui/badges';
import { CopyButton, ModalDialog, Skeleton, TabsContainer } from '@/components/ui/overlays';
import { useToast } from '@/components/ui/toast';
import { ReportView } from '@/components/report/report-view';
import type { SavedRoiState } from '@/lib/roi/types';
import type { AssistantMessageDto } from '@/lib/ai/assistant-types';
import {
  AdminAssistantDetailTab,
  AdminRoiDetailTab,
} from './admin-audit-roi-assistant-tabs';

interface AuditDetailPayload {
  audit: AuditRow;
  pages: AuditPageRow[];
  findings: AuditFindingRow[];
  notes: AuditNoteRow[];
  events: AuditEventRow[];
  stageHistory: AuditStageHistoryRow[];
  roi?: SavedRoiState | null;
  assistant?: {
    messages: AssistantMessageDto[];
    usedCount: number;
    maxMessages: number;
    remainingMessages: number;
  };
}

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function AdminAuditDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const { pushToast } = useToast();

  const [detail, setDetail] = React.useState<AuditDetailPayload | null>(null);
  const [notFound, setNotFound] = React.useState(false);
  const [busyAction, setBusyAction] = React.useState<string | null>(null);

  // Stage reason modal
  const [pendingStage, setPendingStage] = React.useState<PipelineStage | null>(null);
  const [stageReason, setStageReason] = React.useState('');

  // Priority override & follow-up form state
  const [overridePriority, setOverridePriority] = React.useState<string>('');
  const [overrideReason, setOverrideReason] = React.useState<string>('');
  const [followUpDate, setFollowUpDate] = React.useState<string>('');

  // Internal note form
  const [noteText, setNoteText] = React.useState('');

  // Delete confirmation modal
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = React.useState('');

  const originUrl = React.useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => '',
  );

  const loadDetail = React.useCallback(async () => {
    const res = await fetch(`/api/admin/audits/${id}`, { cache: 'no-store' });
    if (res.status === 404) {
      setNotFound(true);
      return;
    }
    if (!res.ok) return;
    const data = (await res.json()) as AuditDetailPayload;
    setDetail(data);
    setOverridePriority(data.audit.leadPriorityOverride ?? '');
    setOverrideReason(data.audit.leadPriorityOverrideReason ?? '');
    setFollowUpDate(data.audit.followUpAt ? data.audit.followUpAt.slice(0, 10) : '');
  }, [id]);

  React.useEffect(() => {
    let active = true;
    fetch(`/api/admin/audits/${id}`, { cache: 'no-store' })
      .then(async (res) => {
        if (!active) return;
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (!res.ok) return;
        const data = (await res.json()) as AuditDetailPayload;
        if (!active) return;
        setDetail(data);
        setOverridePriority(data.audit.leadPriorityOverride ?? '');
        setOverrideReason(data.audit.leadPriorityOverrideReason ?? '');
        setFollowUpDate(data.audit.followUpAt ? data.audit.followUpAt.slice(0, 10) : '');
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [id]);

  const adminFetch = async (url: string, method: string, body?: unknown) => {
    return fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        [ADMIN_CSRF_HEADER]: '1',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  const handleStageSelect = async (stage: PipelineStage) => {
    if (!detail || stage === detail.audit.pipelineStage) return;
    if (stage === 'CONVERTED' || stage === 'NOT_INTERESTED') {
      setPendingStage(stage);
      setStageReason('');
      return;
    }
    setBusyAction(`stage-${stage}`);
    try {
      const res = await adminFetch(`/api/admin/audits/${id}`, 'PATCH', { pipelineStage: stage });
      const json = await res.json();
      if (!res.ok) {
        pushToast(json.error || 'Could not update stage.', 'error');
        return;
      }
      pushToast(`Pipeline stage updated to ${stage.replace(/_/g, ' ')}.`);
      await loadDetail();
    } finally {
      setBusyAction(null);
    }
  };

  const handleConfirmStageWithReason = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingStage) return;
    setBusyAction('stage-reason');
    try {
      const res = await adminFetch(`/api/admin/audits/${id}`, 'PATCH', {
        pipelineStage: pendingStage,
        stageReason,
      });
      const json = await res.json();
      if (!res.ok) {
        pushToast(json.error || 'Reason is required.', 'error');
        return;
      }
      setPendingStage(null);
      pushToast(`Pipeline stage updated to ${pendingStage.replace(/_/g, ' ')}.`);
      await loadDetail();
    } finally {
      setBusyAction(null);
    }
  };

  const handleSavePriorityAndFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyAction('meta-save');
    try {
      const res = await adminFetch(`/api/admin/audits/${id}`, 'PATCH', {
        leadPriorityOverride: overridePriority || null,
        leadPriorityOverrideReason: overridePriority ? overrideReason : null,
        followUpAt: followUpDate ? new Date(`${followUpDate}T09:00:00.000Z`).toISOString() : null,
      });
      const json = await res.json();
      if (!res.ok) {
        pushToast(json.error || 'Could not save changes.', 'error');
        return;
      }
      pushToast('Priority override and follow-up date saved.');
      await loadDetail();
    } finally {
      setBusyAction(null);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    setBusyAction('add-note');
    try {
      const res = await adminFetch(`/api/admin/audits/${id}/notes`, 'POST', { note: noteText });
      const json = await res.json();
      if (!res.ok) {
        pushToast(json.error || 'Could not add note.', 'error');
        return;
      }
      setNoteText('');
      pushToast('Internal note added.');
      await loadDetail();
    } finally {
      setBusyAction(null);
    }
  };

  const handlePostAction = async (
    action: 'retry' | 'regenerate' | 'release' | 'revoke-token' | 'reset-assistant',
    label: string,
    body?: unknown,
  ) => {
    setBusyAction(action);
    try {
      const res = await adminFetch(`/api/admin/audits/${id}/${action}`, 'POST', body);
      const json = await res.json();
      if (!res.ok) {
        pushToast(json.error || `Failed to ${label}.`, 'error');
        return;
      }
      pushToast(label);
      await loadDetail();
    } finally {
      setBusyAction(null);
    }
  };

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyAction('delete');
    try {
      const res = await adminFetch(`/api/admin/audits/${id}`, 'DELETE', {
        confirmBusinessName: deleteConfirmName,
      });
      const json = await res.json();
      if (!res.ok) {
        pushToast(json.error || 'Could not delete audit.', 'error');
        return;
      }
      pushToast('Audit permanently deleted.');
      router.push('/admin/audits');
    } finally {
      setBusyAction(null);
    }
  };

  if (notFound) {
    return (
      <Card className="p-8 text-center">
        <p className="text-lg font-semibold text-ink">Audit record not found</p>
        <Link
          href="/admin/audits"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-teal-700 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Audits
        </Link>
      </Card>
    );
  }

  if (!detail) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  const { audit, pages, notes, events, stageHistory } = detail;
  const challenges = safeJsonParse<string[]>(audit.challenges, []);
  const goals = safeJsonParse<string[]>(audit.goals, []);
  const scoreBreakdown = safeJsonParse<LeadFactorScore[]>(audit.leadScoreBreakdown, []);
  const effectivePriority = audit.leadPriorityOverride ?? audit.leadPriority;
  const isOverdue =
    Boolean(audit.followUpAt) &&
    audit.followUpAt! < new Date().toISOString() &&
    audit.pipelineStage !== 'CONVERTED' &&
    audit.pipelineStage !== 'NOT_INTERESTED';

  let parsedReport: AuditReport | null = null;
  if (audit.reportJson) {
    const res = AuditReportSchema.safeParse(safeJsonParse(audit.reportJson, null));
    if (res.success) parsedReport = res.data;
  }

  const publicReportUrl = `${originUrl}/report/${audit.publicToken}`;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/audits"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to Audits
        </Link>
      </div>

      {/* Header & Quick Actions */}
      <Card className="p-6 space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-ink">{audit.businessName}</h1>
              <AuditStatusBadge status={audit.auditStatus} />
              <LeadPriorityBadge priority={effectivePriority} />
              <PipelineStageBadge stage={audit.pipelineStage} />
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
              <a
                href={audit.website}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex items-center gap-1 font-mono text-teal-700 hover:underline"
              >
                {audit.website}
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
              <span>·</span>
              <span>{audit.industry}</span>
              <span>·</span>
              <span>Submitted {formatDateTime(audit.createdAt)}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <CopyButton text={publicReportUrl} label="Copy report link" />
            <Link
              href={`/report/${audit.publicToken}`}
              target="_blank"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded border border-border bg-surface px-3.5 py-2 text-sm font-medium text-ink hover:bg-subtle"
            >
              Open Report
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>

            {(audit.auditStatus === 'FAILED' || audit.auditStatus === 'WAITING_FOR_QUOTA') && (
              <Button
                variant="primary"
                size="sm"
                loading={busyAction === 'retry'}
                onClick={() => handlePostAction('retry', 'Audit queued for retry.')}
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Retry
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              loading={busyAction === 'regenerate'}
              onClick={() =>
                handlePostAction('regenerate', 'Report regeneration queued from stored crawl data.')
              }
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Regenerate
            </Button>

            {audit.releaseStatus === 'PENDING_REVIEW' && (
              <Button
                variant="cta"
                size="sm"
                loading={busyAction === 'release'}
                onClick={() => handlePostAction('release', 'Report released to customer.')}
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Release Report
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              loading={busyAction === 'revoke-token'}
              onClick={() =>
                handlePostAction(
                  'revoke-token',
                  'Old link revoked and replaced with a new token.',
                  { mode: 'rotate' },
                )
              }
            >
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              Rotate Link
            </Button>

            <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Delete
            </Button>
          </div>
        </div>

        {/* Pipeline Stepper */}
        <div className="border-t border-border pt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
            Pipeline Stage
          </p>
          <div className="flex flex-wrap gap-1.5">
            {PIPELINE_STAGES.map((stage) => {
              const active = audit.pipelineStage === stage;
              return (
                <button
                  key={stage}
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => handleStageSelect(stage)}
                  className={cn(
                    'min-h-[36px] rounded border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer',
                    active
                      ? stage === 'NOT_INTERESTED'
                        ? 'border-red-600 bg-red-600 text-white'
                        : 'border-navy-900 bg-navy-900 text-white'
                      : 'border-border bg-canvas text-muted hover:bg-subtle hover:text-ink',
                  )}
                >
                  {stage.replace(/_/g, ' ')}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <TabsContainer
        defaultValue="overview"
        tabs={[
          {
            value: 'overview',
            label: 'Overview & Lead Score',
            content: (
              <div className="grid gap-6 lg:grid-cols-12">
                {/* Submission & Contact */}
                <div className="space-y-6 lg:col-span-7">
                  <Card className="p-6 space-y-4">
                    <h2 className="text-base font-semibold text-ink">Contact &amp; Consent</h2>
                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-xs text-muted">Full Name</dt>
                        <dd className="font-medium text-ink">{audit.contactName}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted">Email</dt>
                        <dd className="font-medium text-ink flex items-center gap-2">
                          <span>{audit.contactEmail}</span>
                          {audit.isFreeEmailDomain && (
                            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 border border-amber-200">
                              Free email
                            </span>
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted">Phone</dt>
                        <dd className="text-ink">{audit.contactPhone || '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted">Role / Position</dt>
                        <dd className="text-ink">{audit.contactRole || '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted">Consent Version</dt>
                        <dd className="text-xs text-muted">
                          {audit.consentVersion} ({formatDate(audit.consentAt)})
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted">Marketing Opt-In</dt>
                        <dd className="text-ink">{audit.marketingConsent ? 'Yes' : 'No'}</dd>
                      </div>
                    </dl>
                  </Card>

                  <Card className="p-6 space-y-4">
                    <h2 className="text-base font-semibold text-ink">Questionnaire Context</h2>
                    <div className="space-y-3 text-sm">
                      <div>
                        <p className="text-xs font-medium text-muted">Primary Offerings</p>
                        <p className="mt-1 text-ink leading-relaxed">{audit.businessDescription}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted">Challenges</p>
                        <p className="mt-1 text-ink">{challenges.join(', ') || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted">Goals</p>
                        <p className="mt-1 text-ink">{goals.join(', ') || '—'}</p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 pt-1">
                        <div>
                          <p className="text-xs font-medium text-muted">Tools Used</p>
                          <p className="mt-0.5 text-ink">{audit.toolsUsed || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted">Timeframe</p>
                          <p className="mt-0.5 text-ink">{audit.timeframe || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted">Monthly Enquiries</p>
                          <p className="mt-0.5 text-ink">{audit.enquiryVolume || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted">Monthly Calls</p>
                          <p className="mt-0.5 text-ink">{audit.phoneVolume || '—'}</p>
                        </div>
                      </div>
                      {audit.manualProcesses && (
                        <div>
                          <p className="text-xs font-medium text-muted">Manual Processes</p>
                          <p className="mt-1 text-ink">{audit.manualProcesses}</p>
                        </div>
                      )}
                    </div>
                  </Card>
                </div>

                {/* Lead Score & Override / Follow-up */}
                <div className="space-y-6 lg:col-span-5">
                  <Card className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-base font-semibold text-ink">Lead Qualification</h2>
                        <p className="text-xs text-muted">
                          Automatic classification: {audit.leadPriority}
                        </p>
                      </div>
                      <span className="text-2xl font-bold text-navy-900 tabular-nums">
                        {audit.leadScore}/100
                      </span>
                    </div>
                    <p className="text-xs text-muted">{audit.leadReason}</p>

                    <div className="divide-y divide-border border-t border-border pt-2">
                      {scoreBreakdown.map((item) => (
                        <div key={item.key} className="py-2.5 text-xs space-y-1">
                          <div className="flex items-center justify-between font-medium text-ink">
                            <span>{item.label}</span>
                            <span className="tabular-nums">
                              {item.score}/{item.maxScore}
                            </span>
                          </div>
                          <p className="text-muted">{item.reason}</p>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card className="p-6 space-y-4">
                    <h2 className="text-base font-semibold text-ink">
                      Follow-Up &amp; Priority Override
                    </h2>
                    {isOverdue && (
                      <div className="flex items-center gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-800">
                        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>Follow-up date is overdue ({formatDate(audit.followUpAt)})</span>
                      </div>
                    )}

                    <form onSubmit={handleSavePriorityAndFollowUp} className="space-y-4">
                      <Input
                        label="Follow-up date"
                        type="date"
                        value={followUpDate}
                        onChange={(e) => setFollowUpDate(e.target.value)}
                      />

                      <Select
                        label="Manual Priority Override"
                        value={overridePriority}
                        onChange={(e) => setOverridePriority(e.target.value)}
                        options={[
                          { value: '', label: 'Use automatic score classification' },
                          ...LEAD_PRIORITIES.map((p) => ({ value: p, label: p })),
                        ]}
                      />

                      {overridePriority && (
                        <Input
                          label="Override reason"
                          required
                          placeholder="Why are you overriding the automatic score?"
                          value={overrideReason}
                          onChange={(e) => setOverrideReason(e.target.value)}
                        />
                      )}

                      <Button
                        type="submit"
                        variant="primary"
                        loading={busyAction === 'meta-save'}
                        className="w-full"
                      >
                        Save Follow-Up &amp; Priority
                      </Button>
                    </form>
                  </Card>
                </div>
              </div>
            ),
          },
          {
            value: 'website',
            label: `Website Analysis (${pages.length})`,
            content: (
              <div className="space-y-6">
                <Card className="p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <div>
                      <h2 className="text-base font-semibold text-ink">Crawled Pages</h2>
                      <p className="text-xs text-muted">
                        Coverage: <strong>{audit.crawlCoverage ?? 'NONE'}</strong>
                        {audit.crawlFailureReason ? ` — ${audit.crawlFailureReason}` : ''}
                      </p>
                    </div>
                  </div>

                  {pages.length === 0 ? (
                    <p className="text-sm text-muted">
                      No public HTML pages were stored for this audit.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {pages.map((p) => {
                        const meta = safeJsonParse<Partial<ExtractedPageMetadata>>(
                          p.extractedMetadata,
                          {},
                        );
                        return (
                          <Card key={p.id} variant="inset" className="p-4 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="rounded bg-navy-900 px-2 py-0.5 font-mono text-xs font-semibold text-white">
                                  {p.pageLabel}
                                </span>
                                <span className="font-semibold text-sm text-ink">
                                  {p.pageTitle || 'Untitled page'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-xs">
                                <span className="rounded bg-surface border border-border px-2 py-0.5 font-mono">
                                  HTTP {p.httpStatus ?? '—'} · {p.extractionStatus}
                                </span>
                                {meta.possibleInjection?.flagged && (
                                  <span className="rounded bg-red-50 border border-red-200 px-2 py-0.5 font-semibold text-red-800">
                                    Prompt-injection text flagged
                                  </span>
                                )}
                              </div>
                            </div>
                            <p className="font-mono text-xs text-teal-700 break-all">{p.url}</p>
                            {p.extractedText && (
                              <p className="text-xs text-muted line-clamp-3 leading-relaxed">
                                {p.extractedText}
                              </p>
                            )}
                            {meta.signals && meta.signals.length > 0 && (
                              <div className="pt-2 flex flex-wrap gap-1.5">
                                {meta.signals
                                  .filter((s) => s.found)
                                  .map((s) => (
                                    <span
                                      key={s.id}
                                      className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-900"
                                      title={s.evidence}
                                    >
                                      {s.label}: {s.evidence}
                                    </span>
                                  ))}
                              </div>
                            )}
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </Card>
              </div>
            ),
          },
          {
            value: 'report',
            label: 'Report Preview',
            content: (
              <div className="space-y-6">
                {parsedReport ? (
                  <div className="rounded-xl border border-border overflow-hidden">
                    <ReportView
                      report={parsedReport}
                      isAdminPreview
                      pagesAttempted={pages.length}
                      pagesExtractedOk={pages.filter((p) => p.extractionStatus === 'OK').length}
                      inspectedPages={pages.map((p) => ({
                        pageLabel: p.pageLabel,
                        url: p.url,
                        pageTitle: p.pageTitle,
                        extractionStatus: p.extractionStatus,
                      }))}
                      crawlFailureReason={audit.crawlFailureReason}
                    />
                  </div>
                ) : (
                  <Card className="p-6 text-sm text-muted">
                    No generated report JSON is stored for this audit yet.
                  </Card>
                )}

                {audit.reportJson && (
                  <Card className="p-4">
                    <details>
                      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-muted">
                        Admin Raw Report JSON Debug Panel (model: {audit.model || '—'}, prompt:{' '}
                        {audit.promptVersion || '—'})
                      </summary>
                      <pre className="mt-3 max-h-96 overflow-auto rounded bg-navy-950 p-4 font-mono text-xs text-slate-200">
                        {JSON.stringify(safeJsonParse(audit.reportJson, {}), null, 2)}
                      </pre>
                    </details>
                  </Card>
                )}
              </div>
            ),
          },
          {
            value: 'roi',
            label: 'ROI',
            content: <AdminRoiDetailTab roi={detail.roi ?? null} />,
          },
          {
            value: 'assistant',
            label: `Assistant (${detail.assistant?.messages.length ?? 0})`,
            content: detail.assistant ? (
              <AdminAssistantDetailTab
                assistant={detail.assistant}
                busyReset={busyAction === 'reset-assistant'}
                onResetLimit={() =>
                  handlePostAction('reset-assistant', 'Assistant message cap reset for this audit.')
                }
              />
            ) : (
              <Card className="p-6 text-sm text-muted">Assistant data unavailable.</Card>
            ),
          },
          {
            value: 'activity',
            label: `Notes & Activity (${notes.length + events.length})`,
            content: (
              <div className="grid gap-6 lg:grid-cols-12">
                <Card className="p-6 lg:col-span-5">
                  <h2 className="text-base font-semibold text-ink">Add Internal Note</h2>
                  <form onSubmit={handleAddNote} className="mt-3 space-y-3">
                    <Textarea
                      label="Team note"
                      rows={4}
                      placeholder="Call notes, discovery context, or next steps..."
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                    />
                    <Button
                      type="submit"
                      variant="primary"
                      loading={busyAction === 'add-note'}
                      className="w-full"
                    >
                      Save Internal Note
                    </Button>
                  </form>

                  {notes.length > 0 && (
                    <div className="mt-6 space-y-3 border-t border-border pt-4">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
                        Saved Notes
                      </h3>
                      {notes.map((n) => (
                        <div key={n.id} className="rounded border border-border bg-subtle/40 p-3 text-sm">
                          <p className="text-ink whitespace-pre-wrap">{n.note}</p>
                          <p className="mt-1.5 text-[11px] text-muted">
                            {formatDateTime(n.createdAt)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <Card className="p-6 lg:col-span-7">
                  <h2 className="text-base font-semibold text-ink">Audit &amp; Stage Timeline</h2>
                  <div className="mt-4 space-y-3">
                    {stageHistory.length > 0 && (
                      <div className="mb-4 rounded-md border border-border bg-subtle/50 p-3 text-xs space-y-1.5">
                        <p className="font-semibold text-ink">Pipeline Stage History</p>
                        {stageHistory.map((sh) => (
                          <div key={sh.id} className="flex justify-between text-muted">
                            <span>
                              {sh.fromStage ?? 'START'} → <strong className="text-ink">{sh.toStage}</strong>
                              {sh.reason ? ` (${sh.reason})` : ''}
                            </span>
                            <span className="tabular-nums">{formatDateTime(sh.changedAt)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {events.map((ev) => (
                      <div
                        key={ev.id}
                        className="rounded border border-border px-4 py-3 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-semibold text-teal-700">
                            {ev.eventType}
                          </span>
                          <span className="text-muted tabular-nums">
                            {formatDateTime(ev.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-ink">{ev.message}</p>
                        {ev.metadata && (
                          <p className="font-mono text-[11px] text-muted break-all">
                            {ev.metadata}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            ),
          },
        ]}
      />

      {/* Stage Reason Modal (CONVERTED / NOT_INTERESTED) */}
      <ModalDialog
        open={pendingStage !== null}
        onOpenChange={(open) => !open && setPendingStage(null)}
        title={`Confirm stage: ${pendingStage?.replace(/_/g, ' ')}`}
        description="Please record a brief reason for audit trail and funnel reporting."
      >
        <form onSubmit={handleConfirmStageWithReason} className="space-y-4">
          <Input
            label="Reason"
            required
            placeholder={
              pendingStage === 'CONVERTED'
                ? 'e.g. Signed pilot retainer agreement'
                : 'e.g. Budget on hold until Q2'
            }
            value={stageReason}
            onChange={(e) => setStageReason(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPendingStage(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={busyAction === 'stage-reason'}>
              Save Stage
            </Button>
          </div>
        </form>
      </ModalDialog>

      {/* Delete Modal requiring typing business name */}
      <ModalDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Permanently delete audit and personal data"
        description={`To confirm deletion, type "${audit.businessName}" below.`}
      >
        <form onSubmit={handleDelete} className="space-y-4">
          <div className="flex items-start gap-2 rounded border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              This cascades and deletes all crawled pages, findings, notes, events, and stage
              history.
            </span>
          </div>

          <Input
            label="Confirm business name"
            required
            placeholder={audit.businessName}
            value={deleteConfirmName}
            onChange={(e) => setDeleteConfirmName(e.target.value)}
          />

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              disabled={
                deleteConfirmName.trim().toLowerCase() !== audit.businessName.trim().toLowerCase()
              }
              loading={busyAction === 'delete'}
            >
              Delete Permanently
            </Button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
