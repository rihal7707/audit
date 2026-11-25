import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAdminConfigStatus } from '@/lib/env';
import { getAuthenticatedAdminSession } from '@/lib/security/admin-auth';
import { AdminShell } from '@/components/admin/admin-shell';
import { AdminAuditDetailClient } from '@/components/admin/admin-audit-detail-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Audit Detail – Admin',
  robots: { index: false, follow: false },
};

export default async function AdminAuditDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const status = getAdminConfigStatus();
  if (!status.configured) redirect('/admin/login');
  const session = await getAuthenticatedAdminSession();
  if (!session) redirect('/admin/login');

  const { id } = await params;

  return (
    <AdminShell>
      <AdminAuditDetailClient id={id} />
    </AdminShell>
  );
}

