// src/components/roi/roi-simulator.tsx
'use client';

import * as React from 'react';
import { Calculator, Calendar, MessageSquare, Rocket } from 'lucide-react';
import { calculateAllScenarios, cloneDefaultScenarios } from '@/lib/roi/calculator';
import { buildRoiNarrative } from '@/lib/roi/narrative';
import type { Currency, RoiInputs, RoiPrefillNotes, RoiScenario, SavedRoiState, ScenarioKey } from '@/lib/roi/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RoiInputsPanel } from './roi-inputs-panel';
import { RoiResultsPanel } from './roi-results-panel';
import { RoiComparisonChart } from './roi-comparison-chart';

export interface RoiSimulatorHandle {
  flushSave: () => Promise<void>;
}

export interface RoiSimulatorProps {
  mode: 'live' | 'sample' | 'preview';
  businessName: string;
  publicToken?: string;
  challenges?: string[];
  initialInputs?: RoiInputs;
  initialScenarios?: Record<ScenarioKey, RoiScenario>;
  onDiscussRoi?: (payload: { scenario: string; summaryText: string }) => void;
  onRequestPilot?: (payload: { scenario: string; summaryText: string }) => void;
  onBookCall?: (scenario: string) => void;
  onStateChange?: (inputs: RoiInputs, scenarios: Record<ScenarioKey, RoiScenario>, selected: ScenarioKey) => void;
}

export const RoiSimulator = React.forwardRef<RoiSimulatorHandle, RoiSimulatorProps>(
  function RoiSimulator(
    {
      mode,
      businessName,
      publicToken,
      challenges = [],
      initialInputs = { currency: 'USD' },
      initialScenarios,
      onDiscussRoi,
      onRequestPilot,
      onBookCall,
      onStateChange,
    },
    ref,
  ) {
    const [inputs, setInputs] = React.useState<RoiInputs>(initialInputs);
    const [currency, setCurrency] = React.useState<Currency>(initialInputs.currency ?? 'USD');
    const [scenarios, setScenarios] = React.useState<Record<ScenarioKey, RoiScenario>>(
      () => initialScenarios ?? cloneDefaultScenarios(),
    );
    const [selectedScenario, setSelectedScenario] = React.useState<ScenarioKey>('moderate');
    const [prefillNotes, setPrefillNotes] = React.useState<RoiPrefillNotes | undefined>();
    const [loadError, setLoadError] = React.useState<string | null>(null);
    const [saveStatus, setSaveStatus] = React.useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const dirtyRef = React.useRef(false);
    const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const latestRef = React.useRef({ currency, inputs, scenarios, selectedScenario });
    latestRef.current = { currency, inputs, scenarios, selectedScenario };

    const persistNow = React.useCallback(async () => {
      if (mode !== 'live' || !publicToken || !dirtyRef.current) return;
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      const { currency: c, inputs: inp, scenarios: sc, selectedScenario: sel } = latestRef.current;
      setSaveStatus('saving');
      try {
        const res = await fetch(`/api/reports/${publicToken}/roi`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currency: c, inputs: inp, scenarios: sc, selectedScenario: sel }),
        });
        if (res.ok) {
          dirtyRef.current = false;
          setSaveStatus('saved');
        } else {
          setSaveStatus('error');
        }
      } catch {
        setSaveStatus('error');
      }
    }, [mode, publicToken]);

    React.useImperativeHandle(ref, () => ({ flushSave: persistNow }), [persistNow]);

    React.useEffect(() => {
      if (mode !== 'live' || !publicToken) return;
      let active = true;
      fetch(`/api/reports/${publicToken}/roi`, { cache: 'no-store' })
        .then(async (res) => {
          if (!active) return;
          if (!res.ok) {
            const j = (await res.json().catch(() => ({}))) as { error?: string };
            setLoadError(j.error || 'Could not load saved ROI values.');
            return;
          }
          const data = (await res.json()) as SavedRoiState;
          if (!active) return;
          setCurrency(data.currency);
          setInputs(data.inputs);
          setScenarios(data.scenarios);
          setSelectedScenario(data.selectedScenario);
          setPrefillNotes(data.prefillNotes);
        })
        .catch(() => {
          if (active) setLoadError('Network issue while loading ROI values (calculator still works locally).');
        });
      return () => {
        active = false;
      };
    }, [mode, publicToken]);

    const scheduleSave = React.useCallback(() => {
      if (mode !== 'live' || !publicToken) return;
      dirtyRef.current = true;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        void persistNow();
      }, 650);
    }, [mode, publicToken, persistNow]);

    const outputsByScenario = React.useMemo(
      () => calculateAllScenarios(inputs, scenarios),
      [inputs, scenarios],
    );

    const narrative = React.useMemo(
      () =>
        buildRoiNarrative({
          businessName,
          currency,
          scenario: scenarios[selectedScenario],
          outputs: outputsByScenario[selectedScenario],
        }),
      [businessName, currency, scenarios, selectedScenario, outputsByScenario],
    );

    const updateInput = (key: keyof RoiInputs, val: number | undefined) => {
      setInputs((prev) => {
        const next = { ...prev, [key]: val };
        onStateChange?.(next, scenarios, selectedScenario);
        return next;
      });
      scheduleSave();
    };

    const updateCurrency = (c: Currency) => {
      setCurrency(c);
      setInputs((prev) => ({ ...prev, currency: c }));
      scheduleSave();
    };

    const updateScenario = (patch: Partial<RoiScenario>) => {
      setScenarios((prev) => {
        const next = {
          ...prev,
          [selectedScenario]: { ...prev[selectedScenario], ...patch },
        };
        onStateChange?.(inputs, next, selectedScenario);
        return next;
      });
      scheduleSave();
    };

    const handleResetAssumptions = () => {
      const fresh = cloneDefaultScenarios();
      setScenarios(fresh);
      onStateChange?.(inputs, fresh, selectedScenario);
      scheduleSave();
    };

    const defaultMissedOpen =
      mode === 'sample' ||
      challenges.includes('Missed phone calls') ||
      challenges.includes('Managing customer enquiries');

    return (
      <div className="space-y-6">
        {mode === 'sample' && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50/70 px-4 py-2 text-xs font-semibold tracking-wide text-navy-900">
            SIMULATED DEMONSTRATION DATA – NOT ACTUAL BUSINESS RESULTS.
          </div>
        )}

        <Card className="p-5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-teal-700" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-ink">Interactive ROI &amp; Capacity Simulator</p>
              <p className="text-xs text-muted">
                Model reclaimed hours, missed-call recovery, and Year-1 economics using your numbers.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-border bg-subtle px-2.5 py-0.5 text-xs font-medium text-muted">
              Your numbers, not ours.
            </span>
            {mode === 'live' && saveStatus === 'saved' && (
              <span className="no-print text-[11px] font-medium text-teal-700">Saved</span>
            )}
            {mode === 'live' && saveStatus === 'saving' && (
              <span className="no-print text-[11px] text-muted">Saving...</span>
            )}
          </div>
        </Card>

        {loadError && (
          <div className="no-print rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
            {loadError}
          </div>
        )}

        <RoiInputsPanel
          inputs={inputs}
          scenario={scenarios[selectedScenario]}
          currency={currency}
          prefillNotes={prefillNotes}
          defaultMissedOpen={defaultMissedOpen}
          onInputChange={updateInput}
          onCurrencyChange={updateCurrency}
          onScenarioChange={updateScenario}
          onResetAssumptions={handleResetAssumptions}
        />

        <RoiResultsPanel
          currency={currency}
          inputs={inputs}
          scenarios={scenarios}
          selectedScenario={selectedScenario}
          outputsByScenario={outputsByScenario}
          onSelectScenario={(k) => {
            setSelectedScenario(k);
            onStateChange?.(inputs, scenarios, k);
            scheduleSave();
          }}
        />

        <RoiComparisonChart
          currency={currency}
          scenarios={scenarios}
          outputsByScenario={outputsByScenario}
          selectedScenario={selectedScenario}
        />

        <Card variant="inset" className="p-5 space-y-2 text-xs leading-relaxed text-ink">
          <p className="font-semibold text-ink">How to interpret these numbers</p>
          <p className="text-muted">{narrative}</p>
          <p className="text-[11px] text-muted border-t border-border pt-2">
            Calculation limitations: All calculations run deterministically from the inputs and
            editable starting percentages you enter. Staff capacity value measures time potentially
            freed for higher-value work — not cash payroll reductions. ROI is shown only when
            implementation cost is entered and positive.
          </p>
        </Card>

        {mode !== 'preview' && (
          <Card className="no-print border-navy-800/20 bg-surface p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-ink">Want to Explore These Opportunities?</h3>
                <p className="text-xs text-muted">
                  Share your {scenarios[selectedScenario].label} scenario with Amarketing to discuss what is realistic for your workflow — no obligation.
                </p>
              </div>
              <div className="flex flex-wrap gap-2.5">
                <Button
                  variant="cta"
                  size="sm"
                  onClick={() =>
                    onDiscussRoi?.({ scenario: selectedScenario, summaryText: narrative })
                  }
                >
                  <MessageSquare className="h-4 w-4" aria-hidden="true" />
                  Discuss My ROI Results
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onBookCall?.(selectedScenario)}
                >
                  <Calendar className="h-4 w-4" aria-hidden="true" />
                  Book a Free Strategy Call
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    onRequestPilot?.({ scenario: selectedScenario, summaryText: narrative })
                  }
                >
                  <Rocket className="h-4 w-4" aria-hidden="true" />
                  Request a Pilot
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    );
  },
);
