// src/components/landing/roi-assistant-preview.tsx
'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, Calculator, Clock, MessageSquare, Users } from 'lucide-react';
import { formatCurrency, formatHours } from '@/lib/roi/format';
import {
  getWillowCreekSampleRoiOutputs,
  WILLOW_CREEK_SAMPLE_ROI_INPUTS,
  WILLOW_CREEK_SAMPLE_SCENARIOS,
} from '@/lib/sample/willow-creek';
import { RoiComparisonChart } from '@/components/roi/roi-comparison-chart';
import { AssistantChatPanel } from '@/components/assistant/assistant-chat-panel';
import { Card } from '@/components/ui/card';

export function LandingRoiAndAssistantSections() {
  const sampleOutputs = React.useMemo(
    () => getWillowCreekSampleRoiOutputs(WILLOW_CREEK_SAMPLE_ROI_INPUTS, WILLOW_CREEK_SAMPLE_SCENARIOS),
    [],
  );
  const moderate = sampleOutputs.moderate;

  return (
    <>
      {/* Understand the Financial Impact of AI */}
      <section id="roi-simulator" className="scroll-mt-20 border-t border-border bg-surface py-16 lg:py-24">
        <div className="mx-auto max-w-public px-4 sm:px-6 space-y-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-teal-800">
                <Calculator className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Free Interactive Calculator · Your Numbers, Not Ours</span>
              </div>
              <h2 className="font-serif text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                Understand the Financial Impact of AI
              </h2>
              <p className="text-base leading-relaxed text-muted">
                Every audit includes a free, transparent ROI &amp; Capacity Simulator evaluated deterministically
                from your own workload, staff rates, and optional cost quotes — with no guaranteed savings claims.
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-border bg-subtle px-3 py-1 text-xs font-medium text-muted">
              Illustrative sample. Fictional business.
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="p-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-muted">Sample Hours Reclaimed / Month</p>
                <p className="mt-1 text-2xl font-bold text-ink tabular-nums">
                  {moderate.totalHoursReclaimedMonthly !== null
                    ? `${formatHours(moderate.totalHoursReclaimedMonthly)} hrs/mo`
                    : '—'}
                </p>
                <p className="mt-1 text-xs text-muted">
                  Willow Creek Orthodontics moderate scenario (60% admin · 50% follow-up)
                </p>
              </div>
              <Clock className="h-6 w-6 shrink-0 text-teal-700" aria-hidden="true" />
            </Card>
            <Card className="p-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-muted">Sample Staff Capacity Value</p>
                <p className="mt-1 text-2xl font-bold text-ink tabular-nums">
                  {moderate.capacityValueMonthly !== null && moderate.capacityValueAnnual !== null
                    ? `${formatCurrency(moderate.capacityValueMonthly, 'USD')}/mo (${formatCurrency(moderate.capacityValueAnnual, 'USD')}/yr)`
                    : '—'}
                </p>
                <p className="mt-1 text-xs text-muted">
                  Staff time freed for higher-value work — not cash payroll reductions.
                </p>
              </div>
              <Users className="h-6 w-6 shrink-0 text-teal-700" aria-hidden="true" />
            </Card>
          </div>

          <RoiComparisonChart
            currency="USD"
            scenarios={WILLOW_CREEK_SAMPLE_SCENARIOS}
            outputsByScenario={sampleOutputs}
            selectedScenario="moderate"
          />

          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs text-muted">
              Free interactive tool in every audit report. Open the{' '}
              <Link href="/sample-report#roi" className="font-semibold text-teal-700 hover:underline">
                live sample ROI simulator
              </Link>{' '}
              to adjust sliders yourself.
            </p>
            <Link
              href="/audit"
              className="inline-flex min-h-[44px] items-center gap-2 rounded bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-navy-950 hover:bg-emerald-400"
            >
              Get My Free AI Business Audit
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* Your Personal AI Business Consultant */}
      <section id="ask-your-audit" className="scroll-mt-20 border-t border-border py-16 lg:py-24">
        <div className="mx-auto max-w-public px-4 sm:px-6">
          <div className="grid items-start gap-10 lg:grid-cols-12">
            <div className="lg:col-span-5 space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-teal-800">
                <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Free Grounded Audit Q&amp;A</span>
              </div>
              <h2 className="font-serif text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                Your Personal AI Business Consultant
              </h2>
              <p className="text-base leading-relaxed text-muted">
                Inspect every finding and ROI scenario interactively. Ask follow-up questions in plain English
                — replies draw strictly from your verified audit report and simulator inputs without generic fluff.
              </p>
              <span className="inline-block rounded-full border border-border bg-subtle px-3 py-1 text-xs font-medium text-muted">
                Illustrative sample. Fictional business.
              </span>
              <div className="pt-2">
                <Link
                  href="/audit"
                  className="inline-flex min-h-[44px] items-center gap-2 rounded bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-navy-950 hover:bg-emerald-400"
                >
                  Get My Free AI Business Audit
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="h-[460px] rounded-xl border border-border overflow-hidden shadow-md">
                <AssistantChatPanel
                  mode="sample"
                  businessName="Willow Creek Orthodontics"
                  sampleRoiState={{
                    inputs: WILLOW_CREEK_SAMPLE_ROI_INPUTS,
                    scenarios: WILLOW_CREEK_SAMPLE_SCENARIOS,
                    selectedScenario: 'moderate',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
