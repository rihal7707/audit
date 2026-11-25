'use client';

import * as React from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FieldWrapper, type SelectOption } from './form-fields';

export interface ComboboxProps {
  id?: string;
  label: string;
  required?: boolean;
  helperText?: string;
  error?: string;
  options: readonly SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
}

export function Combobox({
  id,
  label,
  required,
  helperText,
  error,
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  searchPlaceholder = 'Search...',
}: ComboboxProps) {
  const generatedId = React.useId();
  const fieldId = id || generatedId;
  const listboxId = `${fieldId}-listbox`;

  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [activeIndex, setActiveIndex] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const selectedOption = options.find((o) => o.value === value);
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    );
  }, [options, query]);

  const handleToggle = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next) {
        setActiveIndex(0);
        setTimeout(() => searchInputRef.current?.focus(), 0);
      } else {
        setQuery('');
      }
      return next;
    });
  };

  React.useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const selectValue = (val: string) => {
    onChange(val);
    setOpen(false);
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(filtered.length - 1, prev + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(0, prev - 1));
    } else if (e.key === 'Enter' && open) {
      e.preventDefault();
      const target = filtered[activeIndex];
      if (target) selectValue(target.value);
    }
  };

  return (
    <FieldWrapper
      id={fieldId}
      label={label}
      required={required}
      helperText={helperText}
      error={error}
    >
      {(describedBy) => (
        <div ref={containerRef} className="relative">
          <button
            id={fieldId}
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-haspopup="listbox"
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={describedBy}
            onClick={handleToggle}
            className={cn(
              'flex min-h-[44px] w-full items-center justify-between rounded border bg-surface px-3.5 py-2 text-left text-sm transition-colors',
              error
                ? 'border-red-600'
                : 'border-border hover:border-navy-600/50 focus:border-navy-800',
              !selectedOption && 'text-muted',
            )}
          >
            <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          </button>

          {open && (
            <div
              onKeyDown={handleKeyDown}
              className="absolute z-40 mt-1.5 w-full rounded-md border border-border bg-surface shadow-lg"
            >
              <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                <Search className="h-4 w-4 text-muted" aria-hidden="true" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActiveIndex(0);
                  }}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  className="w-full bg-transparent text-sm text-ink placeholder:text-muted/70 focus:outline-none"
                />
              </div>
              <ul
                id={listboxId}
                role="listbox"
                className="max-h-60 overflow-y-auto p-1"
              >
                {filtered.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-muted">No matching options.</li>
                ) : (
                  filtered.map((opt, idx) => {
                    const isSelected = opt.value === value;
                    const isActive = idx === activeIndex;
                    return (
                      <li
                        key={opt.value}
                        role="option"
                        aria-selected={isSelected}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => selectValue(opt.value)}
                        className={cn(
                          'flex min-h-[40px] cursor-pointer items-center justify-between rounded px-3 py-2 text-sm',
                          isActive && 'bg-subtle',
                          isSelected && 'font-medium text-teal-700',
                        )}
                      >
                        <span className="truncate">{opt.label}</span>
                        {isSelected && (
                          <Check className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
                        )}
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </FieldWrapper>
  );
}
