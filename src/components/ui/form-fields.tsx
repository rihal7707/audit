import * as React from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FieldWrapperProps {
  id: string;
  label: string;
  required?: boolean;
  helperText?: string;
  error?: string;
  children: (describedBy: string | undefined) => React.ReactNode;
}

export function FieldWrapper({
  id,
  label,
  required,
  helperText,
  error,
  children,
}: FieldWrapperProps) {
  const helperId = helperText ? `${id}-helper` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helperId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
        {required && (
          <span className="ml-1 text-red-700" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children(describedBy)}
      {helperText && (
        <p id={helperId} className="text-xs text-muted">
          {helperText}
        </p>
      )}
      {error && (
        <p
          id={errorId}
          role="alert"
          className="flex items-start gap-1.5 text-xs font-medium text-red-700"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, id, label, helperText, error, required, ...props }, ref) => {
    const generatedId = React.useId();
    const fieldId = id || generatedId;

    const inputEl = (describedBy?: string) => (
      <input
        ref={ref}
        id={fieldId}
        required={required}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        className={cn(
          'flex min-h-[44px] w-full rounded border bg-surface px-3.5 py-2 text-sm text-ink placeholder:text-muted/70 transition-colors',
          error
            ? 'border-red-600 focus:border-red-600'
            : 'border-border hover:border-navy-600/50 focus:border-navy-800',
          'disabled:cursor-not-allowed disabled:bg-subtle disabled:opacity-60',
          className,
        )}
        {...props}
      />
    );

    if (!label) return inputEl();

    return (
      <FieldWrapper
        id={fieldId}
        label={label}
        required={required}
        helperText={helperText}
        error={error}
      >
        {(describedBy) => inputEl(describedBy)}
      </FieldWrapper>
    );
  },
);
Input.displayName = 'Input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, id, label, helperText, error, required, rows = 4, ...props }, ref) => {
    const generatedId = React.useId();
    const fieldId = id || generatedId;

    const el = (describedBy?: string) => (
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        required={required}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        className={cn(
          'flex w-full rounded border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-muted/70 transition-colors',
          error
            ? 'border-red-600 focus:border-red-600'
            : 'border-border hover:border-navy-600/50 focus:border-navy-800',
          'disabled:cursor-not-allowed disabled:bg-subtle disabled:opacity-60',
          className,
        )}
        {...props}
      />
    );

    if (!label) return el();

    return (
      <FieldWrapper
        id={fieldId}
        label={label}
        required={required}
        helperText={helperText}
        error={error}
      >
        {(describedBy) => el(describedBy)}
      </FieldWrapper>
    );
  },
);
Textarea.displayName = 'Textarea';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  error?: string;
  options: readonly SelectOption[];
  placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, id, label, helperText, error, required, options, placeholder, ...props }, ref) => {
    const generatedId = React.useId();
    const fieldId = id || generatedId;

    const el = (describedBy?: string) => (
      <select
        ref={ref}
        id={fieldId}
        required={required}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        className={cn(
          'flex min-h-[44px] w-full rounded border bg-surface px-3.5 py-2 text-sm text-ink transition-colors',
          error
            ? 'border-red-600 focus:border-red-600'
            : 'border-border hover:border-navy-600/50 focus:border-navy-800',
          'disabled:cursor-not-allowed disabled:bg-subtle disabled:opacity-60',
          className,
        )}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );

    if (!label) return el();

    return (
      <FieldWrapper
        id={fieldId}
        label={label}
        required={required}
        helperText={helperText}
        error={error}
      >
        {(describedBy) => el(describedBy)}
      </FieldWrapper>
    );
  },
);
Select.displayName = 'Select';

