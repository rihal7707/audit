'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ExternalLink,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BrandWordmark } from '@/components/layout/site-header';
import { DrawerSheet } from '@/components/ui/overlays';
import { ADMIN_CSRF_HEADER } from '@/lib/security/admin-session-token';

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [loggingOut, setLoggingOut] = React.useState(false);

  const navItems = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/audits', label: 'Audits & Leads', icon: ListChecks },
  ];

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: { [ADMIN_CSRF_HEADER]: '1' },
      });
    } finally {
      router.push('/admin/login');
      router.refresh();
    }
  };

  const handleTopSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    router.push(q ? `/admin/audits?search=${encodeURIComponent(q)}` : '/admin/audits');
  };

  const navContent = (
    <div className="flex h-full flex-col justify-between">
      <div>
        <div className="border-b border-border px-5 py-4">
          <Link href="/admin/dashboard" className="block">
            <BrandWordmark />
            <span className="mt-1 block text-[11px] font-medium uppercase tracking-wider text-muted">
              Agency Console
            </span>
          </Link>
        </div>

        <nav aria-label="Admin navigation" className="space-y-1 p-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href === '/admin/audits' && pathname.startsWith('/admin/audits/'));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex min-h-[44px] items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-navy-900 text-white'
                    : 'text-muted hover:bg-subtle hover:text-ink',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-border p-3 space-y-1">
        <Link
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-[44px] items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-muted hover:bg-subtle hover:text-ink"
        >
          <span>Public Site</span>
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex min-h-[44px] w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted hover:bg-red-50 hover:text-red-700 cursor-pointer"
        >
          <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{loggingOut ? 'Signing out...' : 'Logout'}</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-canvas">
      {/* Desktop Sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-border bg-surface lg:block">
        <div className="sticky top-0 h-screen">{navContent}</div>
      </aside>

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border bg-surface/95 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open admin menu"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded border border-border bg-surface text-ink lg:hidden"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
            <span className="text-sm font-semibold text-ink lg:hidden">Admin Console</span>
          </div>

          <form onSubmit={handleTopSearch} className="relative w-full max-w-sm">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search business, domain, or email..."
              aria-label="Quick search audits"
              className="h-10 w-full rounded-md border border-border bg-canvas pl-9 pr-3 text-sm text-ink placeholder:text-muted focus:border-navy-800 focus:bg-surface focus:outline-none"
            />
          </form>
        </header>

        <main id="main-content" className="mx-auto w-full max-w-admin flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>

      <DrawerSheet open={mobileOpen} onOpenChange={setMobileOpen} title="AMARKETING Admin">
        {navContent}
      </DrawerSheet>
    </div>
  );
}
