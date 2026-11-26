// src/components/roi/roi-field.tsx
'use client';

import * as React from 'react';
import { HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function RoiNumberField({
  id,
  label,
  tooltip,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  unitPrefix,
  unitSuffix,
  badge,
  placeholder = 'Optional',
}: {
  id: string;
  label: string;
  tooltip: string;
  value: number | undefined;
  onChange: (val: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number;
  unitPrefix?: string;
  unitSuffix?: string;
  badge?: string;
  placeholder?: string;
}) {
  const [showTip, setShowTip] = React.useState(false);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-xs font-medium text-ink">
          {label}
        </label>
        <button
          type="button"
          onClick={() => setShowTip((v) => !v)}
          aria-label={`Help for ${label}`}
          title={tooltip}
          className="inline-flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-subtle hover:text-ink"
        >
          <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
      {badge && (
        <p className="text-[11px] text-teal-700 font-medium">{badge}</p>
      )}
      {showTip && (
        <p className="rounded bg-subtle px-2.5 py-1.5 text-[11px] leading-snug text-muted">
          {tooltip}
        </p>
      )}
      <div className="relative flex items-center">
        {unitPrefix && (
          <span className="pointer-events-none absolute left-3 text-xs font-medium text-muted">
            {unitPrefix}
          </span>
        )}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
          value={value === undefined ? '' : value}
          onChange={(e) => {
            const raw = e.target.value.trim();
            if (raw === '') {
              onChange(undefined);
              return;
            }
            const parsed = Number(raw);
            if (!Number.isFinite(parsed) || parsed < min) return;
            onChange(max !== undefined ? Math.min(parsed, max) : parsed);
          }}
          className={cn(
            'min-h-[42px] w-full rounded border border-border bg-surface py-1.5 text-sm text-ink tabular-nums placeholder:text-muted/60 focus:border-navy-800 focus:outline-none',
            unitPrefix ? 'pl-8 pr-3' : unitSuffix ? 'pl-3 pr-10' : 'px-3',
          )}
        />
        {unitSuffix && (
          <span className="pointer-events-none absolute right-3 text-xs text-muted">
            {unitSuffix}
          </span>
        )}
      </div>
    </div>
  );
}

export function RoiSliderField({
  id,
  label,
  tooltip,
  value,
  onChange,
  min = 0,
  max,
}: {
  id: string;
  label: string;
  tooltip: string;
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max: number;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-xs font-medium text-ink" title={tooltip}>
          {label}
        </label>
        <div className="flex items-center gap-1">
          <input
            aria-label={`${label} percentage`}
            type="number"
            min={min}
            max={max}
            value={value}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v)) onChange(Math.min(Math.max(v, min), max));
            }}
            className="w-16 rounded border border-border bg-surface px-2 py-1 text-right text-xs font-semibold text-ink tabular-nums"
          />
          <span className="text-xs text-muted">%</span>
        </div>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer accent-emerald-600"
      />
      <p className="text-[11px] text-muted">{tooltip}</p>
    </div>
  );
}
