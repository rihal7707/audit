import Link from 'next/link';
import { ArrowLeft, SearchX } from 'lucide-react';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main id="main-content" className="flex flex-1 items-center justify-center px-4 py-20">
        <div className="max-w-md rounded-xl border border-border bg-surface p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-subtle text-navy-700">
            <SearchX className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-semibold text-ink">Page not found</h1>
          <p className="mt-2 text-sm text-muted">
            The page or audit link you requested is unavailable or may have been deleted.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/"
              className="inline-flex min-h-[44px] items-center gap-2 rounded border border-border bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-subtle"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to Home
            </Link>
            <Link
              href="/audit"
              className="inline-flex min-h-[44px] items-center rounded bg-emerald-500 px-5 py-2 text-sm font-semibold text-navy-950 hover:bg-emerald-400"
            >
              Start Free Audit
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

