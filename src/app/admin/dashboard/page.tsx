import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAdminConfigStatus, getEnv, isGeminiConfigured } from '@/lib/env';
import { getAuthenticatedAdminSession } from '@/lib/security/admin-auth';
import { AdminShell } from '@/components/admin/admin-shell';
import { AdminDashboardClient } from '@/components/admin/admin-dashboard-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Admin Dashboard',
  robots: { index: false, follow: false },
};

export default async function AdminDashboardPage() {
  const status = getAdminConfigStatus();
  if (!status.configured) redirect('/admin/login');
  const session = await getAuthenticatedAdminSession();
  if (!session) redirect('/admin/login');

  const env = getEnv();

  return (
    <AdminShell>
      <AdminDashboardClient
        runtimeSummary={{
          geminiConfigured: isGeminiConfigured(),
          geminiPaidTier: env.GEMINI_PAID_TIER,
          releaseMode: env.REPORT_RELEASE_MODE,
          model: env.GEMINI_MODEL,
          maxAuditsPerDay: env.MAX_AUDITS_PER_DAY,
        }}
      />
    </AdminShell>
  );
}

