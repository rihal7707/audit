// src/components/roi/roi-inputs-panel.tsx
'use client';

import * as React from 'react';
import { ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import { INPUT_LIMITS } from '@/lib/roi/calculator';
import {
  SUPPORTED_CURRENCIES,
  type Currency,
  type RoiInputs,
  type RoiPrefillNotes,
  type RoiScenario,
} from '@/lib/roi/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RoiNumberField, RoiSliderField } from './roi-field';

export function RoiInputsPanel({
  inputs,
  scenario,
  currency,
  prefillNotes,
  defaultMissedOpen,
  onInputChange,
  onCurrencyChange,
  onScenarioChange,
  onResetAssumptions,
}: {
  inputs: RoiInputs;
  scenario: RoiScenario;
  currency: Currency;
  prefillNotes?: RoiPrefillNotes;
  defaultMissedOpen: boolean;
  onInputChange: (key: keyof RoiInputs, val: number | undefined) => void;
  onCurrencyChange: (c: Currency) => void;
  onScenarioChange: (patch: Partial<RoiScenario>) => void;
  onResetAssumptions: () => void;
}) {
  const [missedOpen, setMissedOpen] = React.useState(defaultMissedOpen);
  const [costsOpen, setCostsOpen] = React.useState(true);

  const sym = currency === 'INR' ? '₹' : currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : currency === 'AED' ? 'AED' : '$';

  return (
    <div className="no-print space-y-5">
      {/* Group 1: Your business */}
      <Card className="p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
          <div>
            <h3 className="text-sm font-semibold text-ink">1. Your business</h3>
            <p className="text-xs text-muted">Enter your own operational baselines (all optional).</p>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="roi-currency" className="text-xs font-medium text-muted">
              Currency
            </label>
            <select
              id="roi-currency"
              value={currency}
              onChange={(e) => onCurrencyChange(e.target.value as Currency)}
              className="min-h-[36px] rounded border border-border bg-surface px-2.5 text-xs font-semibold text-ink"
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <RoiNumberField
            id="roi-admin-tasks"
            label="Monthly admin tasks"
            tooltip="Exclude follow-ups; enter those below. E.g. intake triage, scheduling, data entry."
            value={inputs.monthlyAdminTasks}
            onChange={(v) => onInputChange('monthlyAdminTasks', v)}
            max={INPUT_LIMITS.monthlyAdminTasks![1]}
          />
          <RoiNumberField
            id="roi-min-admin"
            label="Minutes per admin task"
            tooltip="Average staff minutes spent handling each admin task manually."
            value={inputs.minutesPerAdminTask}
            onChange={(v) => onInputChange('minutesPerAdminTask', v)}
            max={INPUT_LIMITS.minutesPerAdminTask![1]}
            unitSuffix="min"
          />
          <RoiNumberField
            id="roi-hourly-cost"
            label="Staff hourly cost"
            tooltip="Loaded hourly staff cost used only to value reclaimed capacity (not payroll cuts)."
            value={inputs.hourlyCost}
            onChange={(v) => onInputChange('hourlyCost', v)}
            max={INPUT_LIMITS.hourlyCost![1]}
            unitPrefix={sym}
          />
          <RoiNumberField
            id="roi-enquiries"
            label="Monthly enquiries"
            tooltip="Total monthly web/email enquiries received by your business."
            badge={prefillNotes?.monthlyEnquiries}
            value={inputs.monthlyEnquiries}
            onChange={(v) => onInputChange('monthlyEnquiries', v)}
            max={INPUT_LIMITS.monthlyEnquiries![1]}
          />
          <RoiNumberField
            id="roi-followups"
            label="Monthly follow-ups"
            tooltip="Separate follow-up messages or callback attempts outside admin tasks above."
            value={inputs.monthlyFollowUps}
            onChange={(v) => onInputChange('monthlyFollowUps', v)}
            max={INPUT_LIMITS.monthlyFollowUps![1]}
          />
          <RoiNumberField
            id="roi-min-followup"
            label="Minutes per follow-up"
            tooltip="Average minutes spent preparing, sending, and logging each follow-up."
            value={inputs.minutesPerFollowUp}
            onChange={(v) => onInputChange('minutesPerFollowUp', v)}
            max={INPUT_LIMITS.minutesPerFollowUp![1]}
            unitSuffix="min"
          />
          <RoiNumberField
            id="roi-calls"
            label="Monthly inbound calls"
            tooltip="Approximate inbound phone calls received per month."
            badge={prefillNotes?.monthlyCalls}
            value={inputs.monthlyCalls}
            onChange={(v) => onInputChange('monthlyCalls', v)}
            max={INPUT_LIMITS.monthlyCalls![1]}
          />
          <RoiNumberField
            id="roi-bookings"
            label="Monthly bookings"
            tooltip="Optional context on current booked consultations or orders per month."
            value={inputs.monthlyBookings}
            onChange={(v) => onInputChange('monthlyBookings', v)}
            max={INPUT_LIMITS.monthlyBookings![1]}
          />
        </div>

        {/* Missed calls & conversion subgroup */}
        <div className="rounded-md border border-border bg-subtle/40">
          <button
            type="button"
            onClick={() => setMissedOpen((o) => !o)}
            aria-expanded={missedOpen}
            className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-semibold text-ink hover:bg-subtle/70 cursor-pointer"
          >
            <span>
              Missed calls &amp; conversion opportunity (optional)
            </span>
            {missedOpen ? <ChevronDown className="h-4 w-4 text-muted" /> : <ChevronRight className="h-4 w-4 text-muted" />}
          </button>
          {missedOpen && (
            <div className="grid gap-4 border-t border-border p-4 sm:grid-cols-3">
              <RoiNumberField
                id="roi-missed-calls"
                label="Monthly missed calls"
                tooltip="Inbound calls currently missed or sent to voicemail per month."
                value={inputs.monthlyMissedCalls}
                onChange={(v) => onInputChange('monthlyMissedCalls', v)}
                max={INPUT_LIMITS.monthlyMissedCalls![1]}
              />
              <RoiNumberField
                id="roi-conversion-pct"
                label="Enquiry conversion rate (%)"
                tooltip="Percentage of recovered enquiries that become paying customers."
                value={inputs.conversionRatePct}
                onChange={(v) => onInputChange('conversionRatePct', v)}
                max={100}
                unitSuffix="%"
              />
              <RoiNumberField
                id="roi-gp-customer"
                label="Gross profit per customer"
                tooltip="Estimated gross profit (not revenue) earned per converted customer."
                value={inputs.grossProfitPerCustomer}
                onChange={(v) => onInputChange('grossProfitPerCustomer', v)}
                max={INPUT_LIMITS.grossProfitPerCustomer![1]}
                unitPrefix={sym}
              />
            </div>
          )}
        </div>
      </Card>

      {/* Group 2: Automation assumptions (per selected scenario) */}
      <Card className="p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
          <div>
            <h3 className="text-sm font-semibold text-ink">
              2. Automation assumptions ({scenario.label})
            </h3>
            <p className="text-xs text-muted">
              Editable starting points — not industry benchmarks. Adjust independently per scenario.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onResetAssumptions}>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Reset assumptions
          </Button>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          <RoiSliderField
            id="roi-slider-admin"
            label="Admin workflow automation"
            tooltip="Share of repetitive admin tasks assisted (0–90%)."
            value={scenario.adminAutomationPct}
            max={90}
            onChange={(v) => onScenarioChange({ adminAutomationPct: v })}
          />
          <RoiSliderField
            id="roi-slider-followup"
            label="Follow-up automation"
            tooltip="Share of manual follow-ups automated with CRM triggers (0–90%)."
            value={scenario.followUpAutomationPct}
            max={90}
            onChange={(v) => onScenarioChange({ followUpAutomationPct: v })}
          />
          <RoiSliderField
            id="roi-slider-missed"
            label="Missed-call recovery"
            tooltip="Share of missed callers engaged via AI/SMS callback (0–80%)."
            value={scenario.missedCallRecoverPct}
            max={80}
            onChange={(v) => onScenarioChange({ missedCallRecoverPct: v })}
          />
        </div>
      </Card>

      {/* Group 3: Costs (optional) */}
      <Card className="p-5">
        <button
          type="button"
          onClick={() => setCostsOpen((v) => !v)}
          aria-expanded={costsOpen}
          className="flex w-full items-center justify-between text-left cursor-pointer"
        >
          <div>
            <h3 className="text-sm font-semibold text-ink">3. Costs (optional)</h3>
            <p className="text-xs text-muted">
              Enter your own implementation or vendor quote to calculate ROI &amp; payback. We never invent prices.
            </p>
          </div>
          {costsOpen ? <ChevronDown className="h-4 w-4 text-muted" /> : <ChevronRight className="h-4 w-4 text-muted" />}
        </button>
        {costsOpen && (
          <div className="mt-4 grid gap-4 border-t border-border pt-4 sm:grid-cols-3">
            <RoiNumberField
              id="roi-impl-cost"
              label="One-off implementation cost"
              tooltip="Upfront setup cost quote (>0 required to compute Year-1 ROI%)."
              value={inputs.implementationCost}
              onChange={(v) => onInputChange('implementationCost', v)}
              max={INPUT_LIMITS.implementationCost![1]}
              unitPrefix={sym}
            />
            <RoiNumberField
              id="roi-op-cost"
              label="Monthly AI / software operating cost"
              tooltip="Estimated monthly platform/AI usage fees."
              value={inputs.monthlyOperatingCost}
              onChange={(v) => onInputChange('monthlyOperatingCost', v)}
              max={INPUT_LIMITS.monthlyOperatingCost![1]}
              unitPrefix={sym}
            />
            <RoiNumberField
              id="roi-maint-cost"
              label="Monthly maintenance / support cost"
              tooltip="Optional ongoing support retainer or maintenance cost."
              value={inputs.monthlyMaintenanceCost}
              onChange={(v) => onInputChange('monthlyMaintenanceCost', v)}
              max={INPUT_LIMITS.monthlyMaintenanceCost![1]}
              unitPrefix={sym}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
