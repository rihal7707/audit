// src/components/admin/admin-audit-roi-assistant-tabs.tsx
'use client';

import * as React from 'react';
import { RotateCcw } from 'lucide-react';
import { formatCurrency, formatHours, formatPct } from '@/lib/roi/format';
import type { SavedRoiState } from '@/lib/roi/types';
import type { AssistantMessageDto } from '@/lib/ai/assistant-types';
import { formatDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export function AdminRoiDetailTab({ roi }: { roi: SavedRoiState | null }) {
  if (!roi) {
    return (
      <Card className="p-6 text-sm text-muted">
        Customer has not interacted with or saved the ROI Simulator on this audit yet.
      </Card>
    );
  }
  const active = roi.outputs[roi.selectedScenario];
  const sc = roi.scenarios[roi.selectedScenario];

  return (
    <Card className="p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Saved ROI Simulator State</h2>
          <p className="text-xs text-muted">
            Selected scenario: <strong>{sc.label}</strong> · Currency: <strong>{roi.currency}</strong> ·
            Updated: {roi.updatedAt ? formatDateTime(roi.updatedAt) : '—'}
          </p>
        </div>
        <span className="rounded bg-subtle px-2.5 py-1 font-mono text-xs text-muted">
          calc v{roi.calcVersion}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 text-xs tabular-nums">
        <div className="rounded border border-border p-3">
          <p className="text-muted">Hours Reclaimed / mo</p>
          <p className="mt-1 text-lg font-bold text-ink">
            {active.totalHoursReclaimedMonthly !== null ? `${formatHours(active.totalHoursReclaimedMonthly)}h` : '—'}
          </p>
        </div>
        <div className="rounded border border-border p-3">
          <p className="text-muted">Staff Capacity Value / yr</p>
          <p className="mt-1 text-lg font-bold text-ink">
            {active.capacityValueAnnual !== null ? formatCurrency(active.capacityValueAnnual, roi.currency) : '—'}
          </p>
        </div>
        <div className="rounded border border-border p-3">
          <p className="text-muted">Year-1 ROI (Basis A / Basis B)</p>
          <p className="mt-1 text-lg font-bold text-ink">
            {active.roiPctBasisA !== null ? formatPct(active.roiPctBasisA) : '—'} /{' '}
            {active.roiPctBasisB !== null ? formatPct(active.roiPctBasisB) : '—'}
          </p>
        </div>
      </div>

      <pre className="max-h-72 overflow-auto rounded bg-navy-950 p-3 font-mono text-xs text-slate-200">
        {JSON.stringify({ inputs: roi.inputs, scenarios: roi.scenarios }, null, 2)}
      </pre>
    </Card>
  );
}

export function AdminAssistantDetailTab({
  assistant,
  busyReset,
  onResetLimit,
}: {
  assistant: {
    messages: AssistantMessageDto[];
    usedCount: number;
    maxMessages: number;
    remainingMessages: number;
  };
  busyReset: boolean;
  onResetLimit: () => void;
}) {
  return (
    <Card className="p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Scrubbed Assistant Conversation History</h2>
          <p className="text-xs text-muted tabular-nums">
            Questions used since last reset: {assistant.usedCount} / {assistant.maxMessages} (remaining:{' '}
            {assistant.remainingMessages})
          </p>
        </div>
        <Button variant="outline" size="sm" loading={busyReset} onClick={onResetLimit}>
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Reset Assistant Limit
        </Button>
      </div>

      {assistant.messages.length === 0 ? (
        <p className="text-sm text-muted">No assistant messages recorded for this audit yet.</p>
      ) : (
        <div className="space-y-3">
          {assistant.messages.map((m) => (
            <div
              key={m.id}
              className="rounded border border-border bg-subtle/40 p-3 text-xs space-y-1"
            >
              <div className="flex items-center justify-between text-[11px] text-muted">
                <span className="font-semibold uppercase text-ink">
                  {m.role} · {m.status}
                </span>
                <span className="tabular-nums">{formatDateTime(m.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap text-ink leading-relaxed">{m.message}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
