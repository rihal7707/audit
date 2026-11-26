// src/components/roi/roi-results-panel.tsx
'use client';

import * as React from 'react';
import { Clock, Info, TrendingUp, Users } from 'lucide-react';
import { formatCount, formatCurrency, formatHours, formatMonths, formatPct } from '@/lib/roi/format';
import type { Currency, RoiInputs, RoiOutputs, RoiScenario, ScenarioKey } from '@/lib/roi/types';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { useCountUp } from './use-count-up';

const SCENARIO_ORDER: ScenarioKey[] = ['conservative', 'moderate', 'optimistic'];

function MetricCard({
  label,
  valueText,
  subText,
  icon: Icon,
  highlight = false,
}: {
  label: string;
  valueText: string;
  subText: string;
  icon: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
}) {
  return (
    <Card className={cn('p-4 space-y-1.5', highlight && 'border-emerald-200 bg-emerald-50/30')}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted">{label}</span>
        <Icon className="h-4 w-4 shrink-0 text-teal-700" aria-hidden="true" />
      </div>
      <p className="text-xl sm:text-2xl font-bold text-ink tabular-nums">{valueText}</p>
      <p className="text-[11px] leading-snug text-muted">{subText}</p>
    </Card>
  );
}

export function RoiResultsPanel({
  currency,
  inputs,
  scenarios,
  selectedScenario,
  outputsByScenario,
  onSelectScenario,
}: {
  currency: Currency;
  inputs: RoiInputs;
  scenarios: Record<ScenarioKey, RoiScenario>;
  selectedScenario: ScenarioKey;
  outputsByScenario: Record<ScenarioKey, RoiOutputs>;
  onSelectScenario: (key: ScenarioKey) => void;
}) {
  const activeScenario = scenarios[selectedScenario];
  const o = outputsByScenario[selectedScenario];

  const animHours = useCountUp(o.totalHoursReclaimedMonthly);
  const animCapacityMo = useCountUp(o.capacityValueMonthly);
  const animGrossMo = useCountUp(o.grossProfitOpportunityMonthly);

  return (
    <div className="space-y-5">
      {/* Scenario Selector */}
      <div className="no-print flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            Scenario Comparison
          </p>
          <p className="text-[11px] text-muted">
            Conservative / Moderate / Optimistic are editable starting points, not benchmarks.
          </p>
        </div>
        <div role="tablist" aria-label="ROI scenarios" className="grid grid-cols-3 gap-1.5 sm:flex">
          {SCENARIO_ORDER.map((k) => {
            const sc = scenarios[k];
            const active = selectedScenario === k;
            return (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onSelectScenario(k)}
                className={cn(
                  'min-h-[42px] rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer',
                  active
                    ? 'border-navy-900 bg-navy-900 text-white shadow-sm'
                    : 'border-border bg-surface text-ink hover:bg-subtle',
                )}
              >
                {sc.label} ({sc.adminAutomationPct}%)
              </button>
            );
          })}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          icon={Clock}
          label="Hours reclaimed / month"
          valueText={animHours !== null ? `${formatHours(animHours)} hrs` : 'Not provided'}
          subText={
            o.adminHoursReclaimedAnnual !== null
              ? `Admin: ${formatHours(o.adminHoursReclaimedMonthly ?? 0)}h · Follow-up: ${formatHours(o.followUpHoursReclaimedMonthly ?? 0)}h (~${Math.round((o.totalHoursReclaimedMonthly ?? 0) * 12)} hrs/yr)`
              : 'Enter admin tasks & minutes per task to compute reclaimed hours.'
          }
          highlight
        />
        <MetricCard
          icon={Users}
          label="Staff capacity value / mo & yr"
          valueText={
            animCapacityMo !== null && o.capacityValueAnnual !== null
              ? `${formatCurrency(animCapacityMo, currency)} / mo`
              : 'Not provided'
          }
          subText={
            o.capacityValueAnnual !== null
              ? `${formatCurrency(o.capacityValueAnnual, currency)}/yr — staff time freed for other work (not cash savings, no payroll reduction assumed).`
              : 'Add staff hourly cost to value freed capacity time.'
          }
        />
        <MetricCard
          icon={TrendingUp}
          label="Gross profit opportunity / mo & yr"
          valueText={
            animGrossMo !== null
              ? `${formatCurrency(animGrossMo, currency)} / mo`
              : 'Not entered'
          }
          subText={
            o.grossProfitOpportunityAnnual !== null
              ? `${formatCurrency(o.grossProfitOpportunityAnnual, currency)}/yr · ${formatCount(o.recoveredEnquiriesMonthly ?? 0)} recovered enquiries → ${formatCount(o.potentialCustomersMonthly ?? 0)} potential customers/mo`
              : o.recoveredEnquiriesMonthly !== null
                ? `${formatCount(o.recoveredEnquiriesMonthly)} recovered enquiries/mo · Add conversion % & gross profit to estimate opportunity.`
                : 'Optional: open Missed calls & conversion above to model enquiry recovery.'
          }
        />
      </div>

      {/* Two ROI Bases Side by Side */}
      <div className="grid gap-4 md:grid-cols-2">
        {[
          {
            title: 'Basis A — Profit-Opportunity Only',
            formula: `Annual Gross Profit Opportunity − Annual Running Cost − Implementation Cost`,
            benefit: o.benefitBasisA,
            netYear1: o.netYear1BasisA,
            roiPct: o.roiPctBasisA,
            payback: o.paybackMonthsBasisA,
            reason: o.roiReasonA,
            note: 'Excludes staff capacity value.',
          },
          {
            title: 'Basis B — Including Staff Capacity Value',
            formula: `(Gross Profit Opportunity + Capacity Value) − Running Cost − Implementation Cost`,
            benefit: o.benefitBasisB,
            netYear1: o.netYear1BasisB,
            roiPct: o.roiPctBasisB,
            payback: o.paybackMonthsBasisB,
            reason: o.roiReasonB,
            note: 'Includes staff time that may be freed for other work (not cash payroll cuts).',
          },
        ].map((basis) => (
          <Card key={basis.title} variant="inset" className="print-break-avoid p-5 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-ink">{basis.title}</h3>
              <span className="rounded bg-surface border border-border px-2 py-0.5 text-[10px] font-medium text-muted">
                {activeScenario.label}
              </span>
            </div>
            <p className="font-mono text-[11px] text-muted">{basis.formula}</p>

            {basis.roiPct !== null && basis.netYear1 !== null ? (
              <div className="grid grid-cols-3 gap-2 pt-1 tabular-nums">
                <div>
                  <span className="block text-[11px] text-muted">Annual benefit</span>
                  <span className="text-sm font-bold text-ink">
                    {basis.benefit !== null ? formatCurrency(basis.benefit, currency) : '—'}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] text-muted">Year-1 ROI</span>
                  <span className="text-sm font-bold text-teal-700">{formatPct(basis.roiPct)}</span>
                </div>
                <div>
                  <span className="block text-[11px] text-muted">Est. payback</span>
                  <span className="text-sm font-bold text-ink">
                    {basis.payback !== null ? formatMonths(basis.payback) : 'N/A'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded border border-border bg-surface p-3 text-xs text-muted">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-navy-700" aria-hidden="true" />
                <span>{basis.reason || 'Not enough information to calculate ROI.'}</span>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-border pt-2 text-[11px] text-muted tabular-nums">
              <span>{basis.note}</span>
              <span>
                Running: {o.annualRunningCost !== null ? `${formatCurrency(o.annualRunningCost, currency)}/yr` : 'Not entered'}
                {inputs.implementationCost !== undefined ? ` · Setup: ${formatCurrency(inputs.implementationCost, currency)}` : ''}
              </span>
            </div>
          </Card>
        ))}
      </div>

      {/* Print-only snapshot of entered inputs */}
      <div className="hidden print-only rounded border border-border p-4 text-xs">
        <p className="font-semibold text-ink mb-1">
          Saved Simulator Inputs ({activeScenario.label}, {currency})
        </p>
        <p className="text-muted tabular-nums">
          Admin tasks/mo: {inputs.monthlyAdminTasks ?? '—'} · Min/task: {inputs.minutesPerAdminTask ?? '—'} ·
          Follow-ups/mo: {inputs.monthlyFollowUps ?? '—'} · Min/follow-up: {inputs.minutesPerFollowUp ?? '—'} ·
          Hourly cost: {inputs.hourlyCost !== undefined ? formatCurrency(inputs.hourlyCost, currency) : '—'} ·
          Missed calls/mo: {inputs.monthlyMissedCalls ?? '—'} · Conv %: {inputs.conversionRatePct ?? '—'} ·
          GP/customer: {inputs.grossProfitPerCustomer !== undefined ? formatCurrency(inputs.grossProfitPerCustomer, currency) : '—'}
        </p>
      </div>
    </div>
  );
}
