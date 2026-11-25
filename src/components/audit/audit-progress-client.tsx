'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  MinusCircle,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { brandConfig } from '@/lib/config/brand';
import { cn, formatElapsed } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Callout } from '@/components/ui/interactive-controls';
import { useToast } from '@/components/ui/toast';

interface StageItem {
  index: number;
  key: string;
  label: string;
  state: 'pending' | 'active' | 'done' | 'skipped' | 'failed';
}

interface ProgressStatusPayload {
  publicToken: string;
  businessName: string;
  website: string;
  auditStatus: string;
  releaseStatus: string;
  crawlCoverage: string | null;
  currentStageIndex: number;
  currentStageLabel: string;
  pagesCount: number;
  pagesOkCount: number;
  elapsedSeconds: number;
  isQueued: boolean;
  isWaitingQuota: boolean;
  isPendingReview: boolean;
  isCompleted: boolean;
  isFailed: boolean;
  retriable: boolean;
  lastError: string | null;
  reportUrl: string | null;
  stages: StageItem[];
}

export function AuditProgressClient({ token }: { token: string }) {
  const { pushToast } = useToast();
  const [data, setData] = React.useState<ProgressStatusPayload | null>(null);
  const [notFound, setNotFound] = React.useState(false);
  const [retrying, setRetrying] = React.useState(false);

  const fetchStatus = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/audits/${token}/status`, { cache: 'no-store' });
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) return;
      const json = (await res.json()) as ProgressStatusPayload;
      setData(json);
    } catch {
      // Transient polling error ignored; next poll retries
    }
  }, [token]);

  React.useEffect(() => {
    if (notFound) return;
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch(`/api/audits/${token}/status`, { cache: 'no-store' });
        if (!active) return;
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (!res.ok) return;
        const json = (await res.json()) as ProgressStatusPayload;
        if (active) setData(json);
      } catch {
        // Transient polling error ignored
      }
    };

    void poll();
    const isTerminal =
      data?.isCompleted || data?.isFailed || data?.isPendingReview;
    const intervalMs = isTerminal ? 12_000 : 2000;
    const timer = setInterval(() => {
      void poll();
    }, intervalMs);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [token, data?.isCompleted, data?.isFailed, data?.isPendingReview, notFound]);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const res = await fetch(`/api/audits/${token}/retry`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        pushToast(json.error || 'Could not queue retry right now.', 'error');
        return;
      }
      pushToast('Audit re-queued for processing.');
      await fetchStatus();
    } catch {
      pushToast('Network error while requesting retry.', 'error');
    } finally {
      setRetrying(false);
    }
  };

  if (notFound) {
    return (
      <Card className="mx-auto max-w-lg p-8 text-center">
        <h1 className="text-xl font-semibold text-ink">Audit not found</h1>
        <p className="mt-2 text-sm text-muted">
          This audit link may have expired or been deleted.
        </p>
        <div className="mt-6">
          <Link
            href="/audit"
            className="inline-flex min-h-[44px] items-center rounded bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-navy-950"
          >
            Start a New Free Audit
          </Link>
        </div>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="mx-auto max-w-2xl p-8">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-teal-700" aria-hidden="true" />
          <p className="text-sm font-medium text-ink">Loading audit progress...</p>
        </div>
      </Card>
    );
  }

  const stageDisplayNum = Math.min(9, Math.max(1, data.currentStageIndex || 1));

  return (
    <Card variant="raised" className="mx-auto max-w-2xl p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-teal-700">
            Audit Progress · Stage {stageDisplayNum} of 9
          </span>
          <h1 className="mt-1 font-serif text-2xl font-semibold text-ink">
            {data.businessName}
          </h1>
          <p className="mt-1 font-mono text-xs text-muted break-all">{data.website}</p>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-border bg-subtle px-3 py-1.5 text-xs font-medium text-ink tabular-nums">
          <Clock className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
          <span>Elapsed: {formatElapsed(data.elapsedSeconds)}</span>
        </div>
      </div>

      {/* Live status description */}
      <div aria-live="polite" className="mt-5 rounded-md border border-border bg-subtle/50 p-4">
        <div className="flex items-center justify-between gap-2 text-sm font-medium text-ink">
          <span>{data.currentStageLabel}</span>
          {data.pagesCount > 0 && (
            <span className="text-xs text-muted tabular-nums">
              {data.pagesOkCount} of {data.pagesCount} pages inspected
            </span>
          )}
        </div>
      </div>

      {/* Terminal / special state banners */}
      {data.isCompleted && data.reportUrl && (
        <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50/70 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-navy-900">
                {data.auditStatus === 'COMPLETED_LIMITED'
                  ? 'Your limited AI Business Audit is ready'
                  : 'Your personalised AI Business Audit is ready'}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {data.auditStatus === 'COMPLETED_LIMITED'
                  ? 'Automated website coverage was limited, so your report clearly marks customer-provided details and lets you add public copy if desired.'
                  : 'Review your evidence-backed findings, automation workflows, and 90-day roadmap.'}
              </p>
            </div>
            <Link
              href={data.reportUrl}
              className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-navy-950 hover:bg-emerald-400"
            >
              View my report
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      )}

      {data.isPendingReview && (
        <Callout variant="info" title="Report prepared — pending team release" className="mt-5">
          Your audit has finished generating and is currently queued for a quick quality check by
          the Amarketing team before release. Please bookmark this page and check back shortly.
        </Callout>
      )}

      {(data.isQueued || data.isWaitingQuota) && (
        <Callout variant="warning" title="Your audit is waiting in queue" className="mt-5">
          <p>
            {data.isWaitingQuota
              ? 'Our AI analysis capacity is temporarily busy. Your crawled website evidence is safely saved and processing will resume automatically.'
              : 'Your audit is queued for processing. Please bookmark this page so you can return directly to your report.'}
          </p>
          {data.retriable && (
            <div className="mt-3">
              <Button variant="outline" size="sm" loading={retrying} onClick={handleRetry}>
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Retry now
              </Button>
            </div>
          )}
        </Callout>
      )}

      {data.isFailed && (
        <div className="mt-5 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
            <div className="space-y-2">
              <p className="font-semibold">Audit could not be completed</p>
              <p className="text-xs leading-relaxed">
                {data.lastError ||
                  'We encountered an unexpected error while analysing your website.'}
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                {data.retriable && (
                  <Button variant="primary" size="sm" loading={retrying} onClick={handleRetry}>
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    Retry Audit
                  </Button>
                )}
                <a
                  href={`mailto:${brandConfig.contactEmail}`}
                  className="text-xs font-medium text-red-800 underline"
                >
                  Contact {brandConfig.contactEmail}
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 9-stage vertical timeline */}
      <ol className="mt-6 space-y-3" aria-label="Audit pipeline stages">
        {data.stages.map((stage) => (
          <li
            key={stage.key}
            className={cn(
              'flex items-center justify-between rounded-md border px-4 py-3 text-sm',
              stage.state === 'active'
                ? 'border-emerald-300 bg-emerald-50/50 font-medium text-ink'
                : stage.state === 'done'
                  ? 'border-border bg-surface text-ink'
                  : stage.state === 'failed'
                    ? 'border-red-200 bg-red-50/60 text-red-800'
                    : 'border-border/70 bg-subtle/40 text-muted',
            )}
          >
            <div className="flex items-center gap-3">
              {stage.state === 'done' && (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
              )}
              {stage.state === 'active' && (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-teal-700" aria-hidden="true" />
              )}
              {stage.state === 'failed' && (
                <XCircle className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
              )}
              {stage.state === 'skipped' && (
                <MinusCircle className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              )}
              {stage.state === 'pending' && (
                <span className="h-4 w-4 shrink-0 rounded-full border border-border bg-surface" />
              )}
              <span>
                {stage.index}. {stage.label}
              </span>
            </div>
            <span className="text-xs capitalize text-muted">{stage.state}</span>
          </li>
        ))}
      </ol>

      <div className="mt-6 flex items-center gap-2 text-xs text-muted">
        <ShieldCheck className="h-4 w-4 text-teal-700" aria-hidden="true" />
        <span>Bookmark this page URL to return to your audit report anytime.</span>
      </div>
    </Card>
  );
}
