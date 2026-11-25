import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'cta' | 'outline' | 'ghost' | 'danger' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const VARIANT_CLASSES: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-navy-900 text-white hover:bg-navy-800 border border-navy-900 shadow-sm',
  cta:
    'bg-emerald-500 text-navy-950 font-semibold hover:bg-emerald-400 border border-emerald-500 shadow-sm',
  secondary:
    'bg-subtle text-ink hover:bg-border border border-border',
  outline:
    'bg-surface text-ink hover:bg-subtle border border-border',
  ghost:
    'bg-transparent text-ink hover:bg-subtle border border-transparent',
  danger:
    'bg-red-600 text-white hover:bg-red-700 border border-red-600 shadow-sm',
};

const SIZE_CLASSES: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'min-h-[44px] px-3.5 text-sm',
  md: 'min-h-[44px] px-5 text-sm',
  lg: 'min-h-[48px] px-6 text-base',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled,
      children,
      type = 'button',
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(
          'relative inline-flex items-center justify-center gap-2 rounded font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-55 cursor-pointer select-none',
          VARIANT_CLASSES[variant],
          SIZE_CLASSES[size],
          className,
        )}
        {...props}
      >
        <span className={cn('inline-flex items-center gap-2', loading && 'opacity-0')}>
          {children}
        </span>
        {loading && (
          <span className="absolute inset-0 inline-flex items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            <span className="sr-only">Loading</span>
          </span>
        )}
      </button>
    );
  },
);
Button.displayName = 'Button';

