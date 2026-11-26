import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { ensureDbReady, getDatabaseMode, getDb } from '@/lib/db';
import { getAdminConfigStatus, getEnv, isGeminiConfigured } from '@/lib/env';
import { getAppUrlHost } from '@/lib/config/app-url';
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
  let dbReachable = false;
  let schemaOk = false;
  try {
    await ensureDbReady();
    const db = getDb();
    await db.run(sql`SELECT 1`);
    dbReachable = true;
    const tbl = await db.run(
      sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('audits','audit_roi','assistant_conversations')`,
    );
    schemaOk = (tbl.rows?.length ?? 0) >= 3;
  } catch {
    dbReachable = false;
  }

  return (
    <AdminShell>
      <AdminDashboardClient
        runtimeSummary={{
          geminiConfigured: isGeminiConfigured(),
          geminiPaidTier: env.GEMINI_PAID_TIER,
          releaseMode: env.REPORT_RELEASE_MODE,
          model: env.GEMINI_MODEL,
          maxAuditsPerDay: env.MAX_AUDITS_PER_DAY,
          dbReachable,
          schemaOk,
          databaseMode: getDatabaseMode(),
          adminConfigured: status.configured,
          cronConfigured: Boolean(env.CRON_SECRET),
          onVercel: Boolean(process.env.VERCEL),
          appUrlHost: getAppUrlHost(),
          assistantConfig: {
            enabled: env.ASSISTANT_ENABLED,
            maxUserMessages: env.ASSISTANT_MAX_USER_MESSAGES_PER_AUDIT,
            maxMessageChars: env.ASSISTANT_MAX_MESSAGE_CHARS,
            historyMessages: env.ASSISTANT_HISTORY_MESSAGES,
            maxOutputTokens: env.ASSISTANT_MAX_OUTPUT_TOKENS,
            maxCallsPerDay: env.ASSISTANT_MAX_CALLS_PER_DAY,
          },
        }}
      />
    </AdminShell>
  );
}

