'use client';

import * as React from 'react';
import { Calculator } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/form-fields';

export function ImpactEstimator() {
  const [weeklyEnquiries, setWeeklyEnquiries] = React.useState('30');
  const [minutesSavedPerItem, setMinutesSavedPerItem] = React.useState('8');
  const [hourlyCost, setHourlyCost] = React.useState('35');

  const weeklyNum = Math.max(0, Number(weeklyEnquiries) || 0);
  const minsNum = Math.max(0, Number(minutesSavedPerItem) || 0);
  const rateNum = Math.max(0, Number(hourlyCost) || 0);

  const monthlyHours = Math.round(((weeklyNum * minsNum) / 60) * 4.33 * 10) / 10;
  const monthlyValue = Math.round(monthlyHours * rateNum);

  return (
    <Card className="no-print border-border bg-surface p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-teal-700" aria-hidden="true" />
          <h3 className="text-base font-semibold text-ink">
            Interactive Time &amp; Effort Estimator
          </h3>
        </div>
        <span className="rounded-full border border-border bg-subtle px-2.5 py-0.5 text-xs font-medium text-muted">
          Illustrative calculation — local browser only
        </span>
      </div>
      <p className="mt-2 text-sm text-muted">
        Enter your own team figures below to see an indicative time-saving illustration. Nothing
        entered here is saved or sent to the AI model.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Input
          label="Weekly enquiries / calls"
          type="number"
          min={0}
          max={10000}
          value={weeklyEnquiries}
          onChange={(e) => setWeeklyEnquiries(e.target.value)}
        />
        <Input
          label="Minutes saved per enquiry"
          type="number"
          min={0}
          max={120}
          value={minutesSavedPerItem}
          onChange={(e) => setMinutesSavedPerItem(e.target.value)}
        />
        <Input
          label="Internal hourly cost ($)"
          type="number"
          min={0}
          max={500}
          value={hourlyCost}
          onChange={(e) => setHourlyCost(e.target.value)}
        />
      </div>

      <div className="mt-5 flex flex-col justify-between gap-4 rounded-md border border-border bg-subtle/70 p-4 sm:flex-row sm:items-center">
        <div className="text-xs text-muted">
          <span className="font-semibold text-ink">Formula: </span>
          <code className="font-mono">
            ({weeklyNum} × {minsNum} min ÷ 60) × 4.33 wks × ${rateNum}/hr
          </code>
        </div>
        <div className="flex items-baseline gap-6 tabular-nums">
          <div>
            <span className="block text-xs text-muted">Illustrative hours / mo</span>
            <span className="text-xl font-bold text-navy-900">{monthlyHours} hrs</span>
          </div>
          <div>
            <span className="block text-xs text-muted">Illustrative team capacity</span>
            <span className="text-xl font-bold text-teal-700">
              ${monthlyValue.toLocaleString('en-US')}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

