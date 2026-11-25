import * as React from 'react';
import { ArrowDown, ArrowRight, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export function WorkflowDiagram({ steps }: { steps: string[] }) {
  return (
    <div
      className="flex flex-col items-stretch gap-2 md:flex-row md:flex-wrap md:items-center"
      role="list"
      aria-label="AI agent workflow steps"
    >
      {steps.map((step, idx) => {
        const isLast = idx === steps.length - 1;
        const isHumanHandoff =
          isLast || /human|coordinator|team|staff|handoff|escalat|approv/i.test(step);

        return (
          <React.Fragment key={`${idx}-${step.slice(0, 20)}`}>
            <div
              role="listitem"
              className={cn(
                'flex min-w-[140px] flex-1 items-start gap-2 rounded-md border px-3 py-2.5 text-xs leading-snug',
                isHumanHandoff
                  ? 'border-emerald-300 bg-emerald-50/80 text-navy-900 font-medium'
                  : 'border-border bg-subtle/60 text-ink',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                  isHumanHandoff
                    ? 'bg-emerald-500 text-navy-950'
                    : 'bg-navy-900 text-white',
                )}
              >
                {isHumanHandoff ? (
                  <UserCheck className="h-3 w-3" aria-hidden="true" />
                ) : (
                  idx + 1
                )}
              </span>
              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted">
                  {idx === 0 ? 'Trigger' : isHumanHandoff ? 'Human handoff' : `Step ${idx + 1}`}
                </span>
                <span>{step}</span>
              </div>
            </div>

            {!isLast && (
              <div className="flex items-center justify-center text-muted" aria-hidden="true">
                <ArrowRight className="hidden h-4 w-4 md:block" />
                <ArrowDown className="h-4 w-4 md:hidden" />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

