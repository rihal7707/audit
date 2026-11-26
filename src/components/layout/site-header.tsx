'use client';

import * as React from 'react';
import Link from 'next/link';
import { Menu } from 'lucide-react';
import { brandConfig } from '@/lib/config/brand';
import { DrawerSheet } from '@/components/ui/overlays';

const NAV_LINKS = [
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#whats-included', label: "What's included" },
  { href: '/#roi-simulator', label: 'ROI Simulator' },
  { href: '/#ask-your-audit', label: 'Ask Your Audit' },
  { href: '/#who-its-for', label: "Who it's for" },
  { href: '/#faq', label: 'FAQ' },
  { href: '/sample-report', label: 'Sample report' },
];

export function BrandWordmark({ light = false }: { light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg
        width="24"
        height="24"
        viewBox="0 0 28 28"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect
          width="28"
          height="28"
          rx="6"
          fill={light ? 'rgba(16, 185, 129, 0.16)' : '#070F1E'}
          stroke={light ? 'rgba(52, 211, 153, 0.35)' : 'none'}
        />
        <path
          d="M7 19.5L12.5 9L16.5 16.5L21 9"
          stroke="#10B981"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="21" cy="9" r="2" fill="#34D399" />
      </svg>
      <span
        className={`text-sm font-bold tracking-[0.08em] ${
          light ? 'text-white' : 'text-navy-950'
        }`}
      >
        {brandConfig.wordmark}
      </span>
    </span>
  );
}

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <header className="no-print sticky top-0 z-40 border-b border-border/80 bg-surface/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-public items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="rounded py-1 focus-visible:outline-emerald-500">
          <BrandWordmark />
        </Link>

        <nav aria-label="Primary navigation" className="hidden items-center gap-6 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted transition-colors hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/audit"
            className="hidden sm:inline-flex min-h-[44px] items-center justify-center rounded bg-navy-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy-800"
          >
            Get My Free Audit
          </Link>

          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded border border-border bg-surface text-ink hover:bg-subtle lg:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <DrawerSheet
        open={mobileOpen}
        onOpenChange={setMobileOpen}
        title={brandConfig.wordmark}
      >
        <nav aria-label="Mobile navigation" className="flex flex-col gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="flex min-h-[44px] items-center rounded px-3 text-sm font-medium text-ink hover:bg-subtle"
            >
              {link.label}
            </Link>
          ))}
          <div className="mt-4 border-t border-border pt-4">
            <Link
              href="/audit"
              onClick={() => setMobileOpen(false)}
              className="flex min-h-[44px] w-full items-center justify-center rounded bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-navy-950 hover:bg-emerald-400"
            >
              Get My Free AI Business Audit
            </Link>
          </div>
        </nav>
      </DrawerSheet>
    </header>
  );
}

