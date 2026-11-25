import * as React from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'flat' | 'raised' | 'inset';
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'flat', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-md border border-border transition-colors',
          variant === 'flat' && 'bg-surface',
          variant === 'raised' && 'bg-surface shadow-md',
          variant === 'inset' && 'bg-subtle/70',
          className,
        )}
        {...props}
      />
    );
  },
);
Card.displayName = 'Card';

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-6 pb-3', className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('text-lg font-semibold tracking-tight text-ink', className)}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('mt-1 text-sm text-muted', className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-6 pt-3', className)} {...props} />;
}

