import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAdminConfigStatus } from '@/lib/env';
import { getAuthenticatedAdminSession } from '@/lib/security/admin-auth';
import { AdminLoginClient } from '@/components/admin/admin-login-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Admin Login',
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const status = getAdminConfigStatus();
  if (status.configured) {
    const session = await getAuthenticatedAdminSession();
    if (session) {
      redirect('/admin/dashboard');
    }
  }

  const sp = await searchParams;
  const safeNext =
    sp.next && sp.next.startsWith('/admin') ? sp.next : '/admin/dashboard';

  return (
    <AdminLoginClient
      configured={status.configured}
      configReason={status.reason}
      nextPath={safeNext}
    />
  );
}

