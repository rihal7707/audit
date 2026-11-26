// src/components/roi/roi-comparison-chart.tsx
'use client';

import * as React from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCurrency, formatHours } from '@/lib/roi/format';
import type { Currency, RoiOutputs, RoiScenario, ScenarioKey } from '@/lib/roi/types';
import { Card } from '@/components/ui/card';

const KEYS: ScenarioKey[] = ['conservative', 'moderate', 'optimistic'];

export function RoiComparisonChart({
  currency,
  scenarios,
  outputsByScenario,
  selectedScenario,
}: {
  currency: Currency;
  scenarios: Record<ScenarioKey, RoiScenario>;
  outputsByScenario: Record<ScenarioKey, RoiOutputs>;
  selectedScenario: ScenarioKey;
}) {
  const data = KEYS.map((k) => {
    const s = scenarios[k];
    const o = outputsByScenario[k];
    return {
      key: k,
      name: s.label,
      capacityAnnual: Math.round(o.capacityValueAnnual ?? 0),
      profitAnnual: Math.round(o.grossProfitOpportunityAnnual ?? 0),
      hoursMonthly: o.totalHoursReclaimedMonthly,
      recoveredMonthly: o.recoveredEnquiriesMonthly,
      adminPct: s.adminAutomationPct,
      followUpPct: s.followUpAutomationPct,
      missedPct: s.missedCallRecoverPct,
    };
  });

  const hasChartValues = data.some((d) => d.capacityAnnual > 0 || d.profitAnnual > 0);

  return (
    <Card className="p-5 space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-ink">
          Three-Scenario Comparison &amp; Underlying Assumptions
        </h3>
        <p className="text-xs text-muted">
          Annualised comparison (editable starting points, not benchmarks). Selected scenario:{' '}
          <strong className="text-ink">{scenarios[selectedScenario].label}</strong>.
        </p>
      </div>

      {hasChartValues && (
        <div className="no-print h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E3E8EF" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#0F1B2D' }} />
              <YAxis tick={{ fontSize: 11, fill: '#52607A' }} />
              <Tooltip
                formatter={(value) => formatCurrency(Number(value ?? 0), currency)}
                contentStyle={{ borderRadius: '8px', borderColor: '#E3E8EF', fontSize: '12px' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar
                dataKey="capacityAnnual"
                name="Annual Staff Capacity Value"
                fill="#12233F"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="profitAnnual"
                name="Annual Gross Profit Opportunity"
                fill="#10B981"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Visible assumptions + scenario comparison table (also renders in print) */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border text-muted">
            <tr>
              <th className="py-2 pr-3 font-medium">Scenario</th>
              <th className="py-2 px-2 font-medium text-right">Admin %</th>
              <th className="py-2 px-2 font-medium text-right">Follow-up %</th>
              <th className="py-2 px-2 font-medium text-right">Missed Call %</th>
              <th className="py-2 px-2 font-medium text-right">Hours/mo</th>
              <th className="py-2 px-2 font-medium text-right">Capacity/yr</th>
              <th className="py-2 pl-2 font-medium text-right">Profit Opp./yr</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border tabular-nums">
            {data.map((row) => {
              const isSelected = row.key === selectedScenario;
              return (
                <tr key={row.key} className={isSelected ? 'bg-emerald-50/40 font-semibold' : ''}>
                  <td className="py-2 pr-3 text-ink">
                    {row.name}
                    {isSelected ? ' (Selected)' : ''}
                  </td>
                  <td className="py-2 px-2 text-right">{row.adminPct}%</td>
                  <td className="py-2 px-2 text-right">{row.followUpPct}%</td>
                  <td className="py-2 px-2 text-right">{row.missedPct}%</td>
                  <td className="py-2 px-2 text-right">
                    {row.hoursMonthly !== null ? `${formatHours(row.hoursMonthly)}h` : '—'}
                  </td>
                  <td className="py-2 px-2 text-right">
                    {row.capacityAnnual > 0 ? formatCurrency(row.capacityAnnual, currency) : '—'}
                  </td>
                  <td className="py-2 pl-2 text-right">
                    {row.profitAnnual > 0 ? formatCurrency(row.profitAnnual, currency) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
