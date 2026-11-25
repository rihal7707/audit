'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GlobalErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-20">
      <div className="max-w-md rounded-xl border border-border bg-surface p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-700">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-semibold text-ink">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted">
          We encountered an unexpected application error. Please try again or return to the homepage.
        </p>
        {error?.digest && (
          <p className="mt-3 font-mono text-xs text-muted">
            Reference ID: {error.digest}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button variant="primary" onClick={reset}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Try again
          </Button>
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center rounded border border-border bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-subtle"
          >
            Return home
          </Link>
        </div>
      </div>
    </div>
  );
}

