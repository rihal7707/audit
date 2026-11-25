import * as React from 'react';
import { AlertTriangle, Check, Info, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Callout({
  variant = 'info',
  title,
  children,
  className,
}: {
  variant?: 'info' | 'privacy' | 'warning';
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const Icon =
    variant === 'privacy' ? Lock : variant === 'warning' ? AlertTriangle : Info;

  const styles =
    variant === 'warning'
      ? 'bg-amber-50 border-amber-200 text-amber-900'
      : variant === 'privacy'
        ? 'bg-emerald-50/70 border-emerald-200 text-navy-900'
        : 'bg-subtle border-border text-ink';

  const iconColor =
    variant === 'warning'
      ? 'text-amber-700'
      : variant === 'privacy'
        ? 'text-teal-700'
        : 'text-navy-700';

  return (
    <div className={cn('rounded-md border p-4 text-sm', styles, className)}>
      <div className="flex items-start gap-3">
        <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', iconColor)} aria-hidden="true" />
        <div className="space-y-1">
          {title && <p className="font-semibold">{title}</p>}
          <div className="text-sm leading-relaxed opacity-90">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function Tile({
  selected,
  onToggle,
  label,
  description,
  type = 'checkbox',
}: {
  selected: boolean;
  onToggle: () => void;
  label: string;
  description?: string;
  type?: 'checkbox' | 'radio';
}) {
  return (
    <button
      type="button"
      role={type}
      aria-checked={selected}
      onClick={onToggle}
      className={cn(
        'flex min-h-[48px] w-full items-start justify-between gap-3 rounded-md border px-4 py-3 text-left transition-colors duration-150 cursor-pointer',
        selected
          ? 'border-emerald-500 bg-emerald-50/60 text-ink shadow-sm'
          : 'border-border bg-surface text-ink hover:border-navy-600/50 hover:bg-subtle/40',
      )}
    >
      <span className="space-y-0.5">
        <span className="block text-sm font-medium">{label}</span>
        {description && <span className="block text-xs text-muted">{description}</span>}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border transition-colors',
          type === 'radio' ? 'rounded-full' : 'rounded-sm',
          selected
            ? 'border-emerald-500 bg-emerald-500 text-white'
            : 'border-border bg-surface',
        )}
      >
        {selected && <Check className="h-3.5 w-3.5 stroke-[2.5]" />}
      </span>
    </button>
  );
}

export function SegmentedControl({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex flex-wrap gap-2"
    >
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(active ? '' : opt)}
            className={cn(
              'min-h-[44px] rounded-md border px-3.5 py-2 text-xs sm:text-sm font-medium transition-colors cursor-pointer',
              active
                ? 'border-navy-900 bg-navy-900 text-white'
                : 'border-border bg-surface text-ink hover:bg-subtle',
            )}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

