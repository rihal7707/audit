'use client';

import * as React from 'react';
import { Dialog as RadixDialog, Accordion as RadixAccordion, Tabs as RadixTabs } from 'radix-ui';
import { Check, ChevronDown, Copy, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function CopyButton({
  text,
  label = 'Copy link',
  copiedLabel = 'Copied',
  className,
}: {
  text: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        'inline-flex min-h-[44px] items-center gap-2 rounded border border-border bg-surface px-3.5 py-2 text-sm font-medium text-ink hover:bg-subtle transition-colors cursor-pointer',
        className,
      )}
    >
      {copied ? (
        <>
          <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          <span className="text-teal-700">{copiedLabel}</span>
        </>
      ) : (
        <>
          <Copy className="h-4 w-4 text-muted" aria-hidden="true" />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('rounded bg-subtle', className)} aria-hidden="true" />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-surface px-6 py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-subtle text-navy-700">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-muted">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ModalDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-navy-950/55 backdrop-blur-xs" />
        <RadixDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface p-6 shadow-lg focus:outline-none">
          <div className="flex items-start justify-between gap-4">
            <div>
              <RadixDialog.Title className="text-lg font-semibold text-ink">
                {title}
              </RadixDialog.Title>
              {description && (
                <RadixDialog.Description className="mt-1 text-sm text-muted">
                  {description}
                </RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close
              aria-label="Close dialog"
              className="inline-flex h-10 w-10 items-center justify-center rounded text-muted hover:bg-subtle hover:text-ink"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </RadixDialog.Close>
          </div>
          <div className="mt-4">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

export function DrawerSheet({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-navy-950/50" />
        <RadixDialog.Content className="fixed inset-y-0 right-0 z-50 flex w-[min(340px,88vw)] flex-col border-l border-border bg-surface p-6 shadow-lg focus:outline-none">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <RadixDialog.Title className="text-base font-semibold text-ink">
              {title}
            </RadixDialog.Title>
            <RadixDialog.Close
              aria-label="Close drawer"
              className="inline-flex h-10 w-10 items-center justify-center rounded text-muted hover:bg-subtle hover:text-ink"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </RadixDialog.Close>
          </div>
          <div className="mt-4 flex-1 overflow-y-auto">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

export interface AccordionItemData {
  value: string;
  title: string;
  content: React.ReactNode;
}

export function AccordionList({
  items,
  defaultValue,
}: {
  items: AccordionItemData[];
  defaultValue?: string;
}) {
  return (
    <RadixAccordion.Root
      type="single"
      collapsible
      defaultValue={defaultValue}
      className="divide-y divide-border rounded-lg border border-border bg-surface"
    >
      {items.map((item) => (
        <RadixAccordion.Item key={item.value} value={item.value} className="group">
          <RadixAccordion.Header>
            <RadixAccordion.Trigger className="flex min-h-[52px] w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm sm:text-base font-medium text-ink hover:bg-subtle/50 transition-colors cursor-pointer">
              <span>{item.title}</span>
              <ChevronDown
                className="h-4 w-4 shrink-0 text-muted transition-transform duration-200 group-data-[state=open]:rotate-180"
                aria-hidden="true"
              />
            </RadixAccordion.Trigger>
          </RadixAccordion.Header>
          <RadixAccordion.Content className="px-5 pb-4 pt-1 text-sm leading-relaxed text-muted">
            {item.content}
          </RadixAccordion.Content>
        </RadixAccordion.Item>
      ))}
    </RadixAccordion.Root>
  );
}

export function TabsContainer({
  defaultValue,
  tabs,
}: {
  defaultValue: string;
  tabs: Array<{ value: string; label: string; content: React.ReactNode }>;
}) {
  return (
    <RadixTabs.Root defaultValue={defaultValue} className="space-y-4">
      <RadixTabs.List className="flex flex-wrap gap-1 border-b border-border">
        {tabs.map((tab) => (
          <RadixTabs.Trigger
            key={tab.value}
            value={tab.value}
            className="min-h-[44px] border-b-2 border-transparent px-4 py-2 text-sm font-medium text-muted transition-colors hover:text-ink data-[state=active]:border-emerald-500 data-[state=active]:text-ink cursor-pointer"
          >
            {tab.label}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {tabs.map((tab) => (
        <RadixTabs.Content key={tab.value} value={tab.value} className="focus:outline-none">
          {tab.content}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  );
}

