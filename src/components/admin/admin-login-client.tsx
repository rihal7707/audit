'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, Lock, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/form-fields';
import { BrandWordmark } from '@/components/layout/site-header';

export function AdminLoginClient({
  configured,
  configReason,
  nextPath,
}: {
  configured: boolean;
  configReason?: string;
  nextPath: string;
}) {
  const router = useRouter();
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Login failed.');
        return;
      }
      router.push(nextPath || '/admin/dashboard');
      router.refresh();
    } catch {
      setError('Network error during login.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-12">
      <div className="mb-6">
        <Link href="/">
          <BrandWordmark />
        </Link>
      </div>

      <Card variant="raised" className="w-full max-w-md p-6 sm:p-8">
        <div className="flex items-center gap-2.5 text-navy-900">
          <Lock className="h-5 w-5 text-teal-700" aria-hidden="true" />
          <h1 className="text-xl font-semibold text-ink">Agency Admin Sign In</h1>
        </div>
        <p className="mt-1.5 text-sm text-muted">
          Internal console for reviewing submitted AI business audits and managing prospects.
        </p>

        {!configured ? (
          <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldAlert className="h-4 w-4 text-amber-700" aria-hidden="true" />
              <span>Admin setup required</span>
            </div>
            <p className="text-xs leading-relaxed">
              {configReason ||
                'Configure ADMIN_PASSWORD (or ADMIN_PASSWORD_HASH) and ADMIN_SESSION_SECRET in your environment.'}
            </p>
            <p className="text-xs text-muted">
              The public audit portal and sample report continue working without admin credentials.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-800"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <Input
              label="Administrator password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <Button type="submit" variant="primary" className="w-full" loading={submitting}>
              Sign In to Console
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}

