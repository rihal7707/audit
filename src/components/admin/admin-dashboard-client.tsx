'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Clock,
  Flame,
  Inbox,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatDate } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import {
  AuditStatusBadge,
  LeadPriorityBadge,
  PipelineStageBadge,
} from '@/components/ui/badges';
import { Callout } from '@/components/ui/interactive-controls';
import { EmptyState, Skeleton } from '@/components/ui/overlays';
import type { AdminStatsData } from '@/lib/db/repositories/audits.repo';

export function AdminDashboardClient({
  runtimeSummary,
}: {
  runtimeSummary: {
    geminiConfigured: boolean;
    geminiPaidTier: boolean;
    releaseMode: string;
    model: string;
    maxAuditsPerDay: number;
  };
}) {
  const [stats, setStats] = React.useState<AdminStatsData | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch('/api/admin/stats', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load dashboard metrics.');
        return res.json();
      })
      .then((data: AdminStatsData) => setStats(data))
      .catch((e) => setError(e instanceof Error ? e.message : 'Error loading dashboard'));
  }, []);

  if (error) {
    return (
      <Card className="p-6 text-sm text-red-700">
        {error}
      </Card>
    );
  }

  if (!stats) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-lg" />
      </div>
    );
  }

  const formatRate = (num: number, den: number) =>
    den > 0 ? `${Math.round((num / den) * 1000) / 10}%` : '—';

  const kpiCards = [
    {
      label: 'Total Submissions',
      value: stats.kpis.totalSubmissions,
      sub: `${stats.kpis.hotLeadsCount} HOT leads`,
    },
    {
      label: 'Reports Generated',
      value: stats.kpis.reportsGenerated,
      sub: `Completion: ${formatRate(stats.kpis.reportsGenerated, stats.kpis.totalSubmissions)}`,
    },
    {
      label: 'Qualified Prospects',
      value: stats.kpis.qualifiedProspects,
      sub: `Of submissions: ${formatRate(stats.kpis.qualifiedProspects, stats.kpis.totalSubmissions)}`,
    },
    {
      label: 'Consultation Requests',
      value: stats.kpis.consultationRequests,
      sub: `From qualified: ${formatRate(stats.kpis.consultationRequests, stats.kpis.qualifiedProspects)}`,
    },
    {
      label: 'Pilot Discussions',
      value: stats.kpis.pilotDiscussions,
      sub: `From consults: ${formatRate(stats.kpis.pilotDiscussions, stats.kpis.consultationRequests)}`,
    },
    {
      label: 'Converted Clients',
      value: stats.kpis.convertedClients,
      sub: `Overall win: ${formatRate(stats.kpis.convertedClients, stats.kpis.totalSubmissions)}`,
    },
  ];

  const hasAttentionItems =
    stats.needsAttention.hotWithoutFollowUp.length > 0 ||
    stats.needsAttention.failedOrQueued.length > 0 ||
    stats.needsAttention.overdueFollowUps.length > 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Agency Overview</h1>
          <p className="text-sm text-muted">
            Live audit metrics, ever-reached pipeline funnel, and priority follow-ups.
          </p>
        </div>
        <Link
          href="/admin/audits"
          className="inline-flex min-h-[44px] items-center gap-2 rounded bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800"
        >
          Manage All Audits
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      {/* Environment & Billing Advisory */}
      {(!runtimeSummary.geminiPaidTier || !runtimeSummary.geminiConfigured) && (
        <Callout variant="warning" title="Gemini Configuration & Billing Notice">
          {!runtimeSummary.geminiConfigured ? (
            <span>
              GEMINI_API_KEY is not configured yet — real customer audits will fail until set (sample
              report remains active).
            </span>
          ) : (
            <span>
              Running with <code className="font-mono">GEMINI_PAID_TIER=false</code> (model:{' '}
              <code className="font-mono">{runtimeSummary.model}</code>, release mode:{' '}
              <code className="font-mono">{runtimeSummary.releaseMode}</code>, cap:{' '}
              {runtimeSummary.maxAuditsPerDay}/day). Enable Cloud Billing with a budget cap before
              accepting real client submissions in all regions, then set{' '}
              <code className="font-mono">GEMINI_PAID_TIER=true</code>.
            </span>
          )}
        </Callout>
      )}

      {/* 6 KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpiCards.map((card) => (
          <Card key={card.label} className="p-4">
            <p className="text-xs font-medium text-muted">{card.label}</p>
            <p className="mt-2 text-2xl font-bold text-ink tabular-nums">{card.value}</p>
            <p className="mt-1 text-xs text-muted tabular-nums">{card.sub}</p>
          </Card>
        ))}
      </div>

      {/* Funnel + Needs Attention */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="p-6 lg:col-span-7">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
                <BarChart3 className="h-4 w-4 text-teal-700" aria-hidden="true" />
                Conversion Funnel (Ever-Reached Stages)
              </h2>
              <p className="text-xs text-muted">
                Counts audits that have ever reached each milestone stage, including converted and
                historical paths.
              </p>
            </div>
          </div>

          <div className="mt-5 h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats.funnel}
                layout="vertical"
                margin={{ top: 4, right: 24, bottom: 4, left: 16 }}
              >
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#52607A' }} />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={145}
                  tick={{ fontSize: 12, fill: '#0F1B2D' }}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(238, 242, 247, 0.5)' }}
                  formatter={(value) => [String(value ?? 0), 'Audits']}
                  contentStyle={{
                    borderRadius: '8px',
                    borderColor: '#E3E8EF',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" fill="#12233F" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border text-muted">
                <tr>
                  <th className="py-2 font-medium">Stage</th>
                  <th className="py-2 font-medium text-right">Count</th>
                  <th className="py-2 font-medium text-right">Step Conv.</th>
                  <th className="py-2 font-medium text-right">Overall</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border tabular-nums">
                {stats.funnel.map((row) => (
                  <tr key={row.key}>
                    <td className="py-2 font-medium text-ink">{row.label}</td>
                    <td className="py-2 text-right font-semibold text-ink">{row.count}</td>
                    <td className="py-2 text-right text-muted">
                      {row.stepConversionPct === null ? '—' : `${row.stepConversionPct}%`}
                    </td>
                    <td className="py-2 text-right text-muted">
                      {row.overallConversionPct === null ? '—' : `${row.overallConversionPct}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-6 lg:col-span-5">
          <h2 className="text-base font-semibold text-ink">Needs Attention</h2>
          <p className="text-xs text-muted">
            Action items requiring team review or follow-up scheduling.
          </p>

          {!hasAttentionItems ? (
            <div className="mt-6 rounded-md border border-border bg-subtle/50 p-6 text-center text-xs text-muted">
              Nothing urgent right now.
            </div>
          ) : (
            <div className="mt-4 space-y-5">
              {stats.needsAttention.hotWithoutFollowUp.length > 0 && (
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-red-700">
                    <Flame className="h-3.5 w-3.5" aria-hidden="true" />
                    HOT leads without follow-up date
                  </p>
                  <ul className="mt-2 space-y-2">
                    {stats.needsAttention.hotWithoutFollowUp.map((a) => (
                      <li key={a.id}>
                        <Link
                          href={`/admin/audits/${a.id}`}
                          className="flex items-center justify-between rounded border border-border px-3 py-2 text-xs hover:bg-subtle"
                        >
                          <span className="font-medium text-ink truncate">{a.businessName}</span>
                          <span className="text-muted shrink-0 ml-2">Score {a.leadScore}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {stats.needsAttention.overdueFollowUps.length > 0 && (
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    Overdue follow-ups
                  </p>
                  <ul className="mt-2 space-y-2">
                    {stats.needsAttention.overdueFollowUps.map((a) => (
                      <li key={a.id}>
                        <Link
                          href={`/admin/audits/${a.id}`}
                          className="flex items-center justify-between rounded border border-amber-200 bg-amber-50/50 px-3 py-2 text-xs hover:bg-amber-50"
                        >
                          <span className="font-medium text-ink truncate">{a.businessName}</span>
                          <span className="text-amber-800 shrink-0 ml-2">
                            Due {formatDate(a.followUpAt)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {stats.needsAttention.failedOrQueued.length > 0 && (
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-navy-900">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
                    Queued, pending review, or failed audits
                  </p>
                  <ul className="mt-2 space-y-2">
                    {stats.needsAttention.failedOrQueued.map((a) => (
                      <li key={a.id}>
                        <Link
                          href={`/admin/audits/${a.id}`}
                          className="flex items-center justify-between rounded border border-border px-3 py-2 text-xs hover:bg-subtle"
                        >
                          <span className="font-medium text-ink truncate">{a.businessName}</span>
                          <AuditStatusBadge status={a.auditStatus} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Recent Audits */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold text-ink">Recent Submissions</h2>
          <Link href="/admin/audits" className="text-xs font-semibold text-teal-700 hover:underline">
            View all
          </Link>
        </div>

        {stats.recentAudits.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<Inbox className="h-6 w-6" aria-hidden="true" />}
              title="No audit submissions yet"
              description="Once prospects complete the free audit wizard, real submissions and lead scores will appear here."
              action={
                <Link
                  href="/audit"
                  target="_blank"
                  className="inline-flex min-h-[44px] items-center rounded bg-emerald-500 px-4 py-2 text-sm font-semibold text-navy-950"
                >
                  Open Public Audit Wizard
                </Link>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-subtle/60 text-xs uppercase text-muted">
                <tr>
                  <th className="px-6 py-3 font-medium">Business</th>
                  <th className="px-4 py-3 font-medium">Industry</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Lead</th>
                  <th className="px-4 py-3 font-medium">Stage</th>
                  <th className="px-6 py-3 font-medium text-right">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stats.recentAudits.map((a) => (
                  <tr key={a.id} className="hover:bg-subtle/40">
                    <td className="px-6 py-3 font-medium text-ink">
                      <Link href={`/admin/audits/${a.id}`} className="hover:text-teal-700 hover:underline">
                        {a.businessName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">{a.industry}</td>
                    <td className="px-4 py-3">
                      <AuditStatusBadge status={a.auditStatus} />
                    </td>
                    <td className="px-4 py-3">
                      <LeadPriorityBadge priority={a.leadPriorityOverride ?? a.leadPriority} />
                    </td>
                    <td className="px-4 py-3">
                      <PipelineStageBadge stage={a.pipelineStage} />
                    </td>
                    <td className="px-6 py-3 text-right text-xs text-muted tabular-nums">
                      {formatDate(a.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
