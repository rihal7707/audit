// src/components/admin/admin-roi-assistant-stats.tsx
'use client';

import * as React from 'react';
import type { AdminRoiAndAssistantStats } from '@/lib/db/repositories/roi-assistant-analytics.repo';
import { Card } from '@/components/ui/card';

export function AdminRoiAndAssistantStatsCard({
  stats,
  assistantConfig,
}: {
  stats: AdminRoiAndAssistantStats;
  assistantConfig?: {
    enabled: boolean;
    maxUserMessages: number;
    maxMessageChars: number;
    historyMessages: number;
    maxOutputTokens: number;
    maxCallsPerDay: number;
  };
}) {
  const { roi, assistant } = stats;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-ink">ROI Simulator Analytics (Real Audits)</h2>
            <p className="text-xs text-muted">Sample reports are excluded from all metrics.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 tabular-nums">
            <div className="rounded border border-border bg-subtle/40 p-3">
              <p className="text-[11px] text-muted">Reports Using ROI</p>
              <p className="mt-1 text-xl font-bold text-ink">{roi.reportsUsedCount}</p>
            </div>
            <div className="rounded border border-border bg-subtle/40 p-3">
              <p className="text-[11px] text-muted">ROI CTA Clicks</p>
              <p className="mt-1 text-xl font-bold text-ink">{roi.roiCtaClicks}</p>
            </div>
            <div className="rounded border border-border bg-subtle/40 p-3">
              <p className="text-[11px] text-muted">Avg Tasks/mo (n={roi.avgMonthlyAdminTasks.n})</p>
              <p className="mt-1 text-xl font-bold text-ink">
                {roi.avgMonthlyAdminTasks.avg !== null ? roi.avgMonthlyAdminTasks.avg : '—'}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 text-xs tabular-nums">
            <div className="rounded border border-border p-3">
              <p className="font-semibold text-ink mb-1">Selected Scenarios</p>
              <p className="text-muted">
                Conservative: {roi.scenarioCounts.conservative} · Moderate: {roi.scenarioCounts.moderate} · Optimistic: {roi.scenarioCounts.optimistic}
              </p>
            </div>
            <div className="rounded border border-border p-3">
              <p className="font-semibold text-ink mb-1">
                Avg Monthly Capacity (n={roi.avgCapacityValueMonthly.n})
              </p>
              <p className="text-muted">
                {roi.avgCapacityValueMonthly.avg !== null ? `${roi.avgCapacityValueMonthly.avg} (mixed currency units)` : '—'}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-ink">AI Consultant Assistant Analytics</h2>
            <p className="text-xs text-muted">Live report assistant usage and CTA engagement.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-4 tabular-nums">
            <div className="rounded border border-border bg-subtle/40 p-3">
              <p className="text-[11px] text-muted">Reports Opened</p>
              <p className="mt-1 text-xl font-bold text-ink">{assistant.reportsOpenedCount}</p>
            </div>
            <div className="rounded border border-border bg-subtle/40 p-3">
              <p className="text-[11px] text-muted">Customer Messages</p>
              <p className="mt-1 text-xl font-bold text-ink">{assistant.totalCustomerMessages}</p>
            </div>
            <div className="rounded border border-border bg-subtle/40 p-3">
              <p className="text-[11px] text-muted">Free-Text Qs</p>
              <p className="mt-1 text-xl font-bold text-ink">{assistant.freeTextCount}</p>
            </div>
            <div className="rounded border border-border bg-subtle/40 p-3">
              <p className="text-[11px] text-muted">Consult Conv.</p>
              <p className="mt-1 text-xl font-bold text-ink">
                {assistant.assistantToConsultConversionPct !== null
                  ? `${assistant.assistantToConsultConversionPct}%`
                  : '—'}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 text-xs">
            <div className="rounded border border-border p-3">
              <p className="font-semibold text-ink mb-1">Top Chips Used</p>
              {assistant.chipUsageCounts.length === 0 ? (
                <p className="text-muted">—</p>
              ) : (
                <ul className="space-y-0.5 text-muted tabular-nums">
                  {assistant.chipUsageCounts.slice(0, 4).map((c) => (
                    <li key={c.chipId}>{c.chipId}: {c.count}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded border border-border p-3">
              <p className="font-semibold text-ink mb-1">Top Opportunity Tags / CTAs</p>
              <p className="text-muted tabular-nums mb-1">
                CTAs shown: {assistant.ctaShownCount} · clicked: {assistant.ctaClickedCount}
              </p>
              {assistant.topOpportunityCategories.slice(0, 3).map((c) => (
                <p key={c.category} className="text-muted truncate">{c.category}: {c.count}</p>
              ))}
            </div>
          </div>

          {assistantConfig && (
            <p className="border-t border-border pt-2 font-mono text-[11px] text-muted">
              Assistant Settings: enabled={String(assistantConfig.enabled)}, cap={assistantConfig.maxUserMessages}/audit,
              maxChars={assistantConfig.maxMessageChars}, history={assistantConfig.historyMessages},
              maxTokens={assistantConfig.maxOutputTokens}, dailyCap={assistantConfig.maxCallsPerDay}
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
