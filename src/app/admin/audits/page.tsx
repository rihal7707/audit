import { Suspense } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAdminConfigStatus } from '@/lib/env';
import { getAuthenticatedAdminSession } from '@/lib/security/admin-auth';
import { AdminShell } from '@/components/admin/admin-shell';
import { AdminAuditsClient } from '@/components/admin/admin-audits-client';
import { Skeleton } from '@/components/ui/overlays';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Audits & Leads – Admin',
  robots: { index: false, follow: false },
};

export default async function AdminAuditsPage() {
  const status = getAdminConfigStatus();
  if (!status.configured) redirect('/admin/login');
  const session = await getAuthenticatedAdminSession();
  if (!session) redirect('/admin/login');

  return (
    <AdminShell>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
        <AdminAuditsClient />
      </Suspense>
    </AdminShell>
  );
}
