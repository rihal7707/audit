import crypto from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { DatabaseNotConfiguredError, ensureDbReady, getDatabaseMode, getDb } from '@/lib/db';
import {
  getAdminConfigStatus,
  getEnv,
  getMissingOrInvalidEnvNames,
  isGeminiConfigured,
} from '@/lib/env';
import { getAppUrlHost } from '@/lib/config/app-url';

export const runtime = 'nodejs';

const EXPECTED_TABLES = [
  'audits',
  'audit_pages',
  'audit_findings',
  'audit_notes',
  'audit_events',
  'audit_stage_history',
  'rate_limits',
  'crawl_cache',
  'processing_locks',
  'audit_roi',
  'assistant_conversations',
  'assistant_messages',
  'assistant_analytics',
] as const;

function hasValidCronAuth(request: NextRequest, expected?: string): boolean {
  if (!expected) return false;
  const auth = request.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) return false;
  const provided = auth.slice('Bearer '.length).trim();
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  let dbReachable = false;
  let schemaOk = false;
  let databaseMode: 'remote-libsql' | 'memory' | 'local-file' | 'unknown' = 'unknown';
  let errorCategory: 'DATABASE_NOT_CONFIGURED' | 'KEY_NOT_CONFIGURED' | null = null;

  try {
    databaseMode = getDatabaseMode();
    await ensureDbReady();
    const db = getDb();
    await db.run(sql`SELECT 1`);
    dbReachable = true;

    const tbl = await db.run(sql`SELECT name FROM sqlite_master WHERE type = 'table'`);
    const existingNames = new Set(
      (tbl.rows || []).map((r) => String((r as Record<string, unknown>).name || '')),
    );
    schemaOk = EXPECTED_TABLES.every((t) => existingNames.has(t));
  } catch (err) {
    dbReachable = false;
    schemaOk = false;
    if (err instanceof DatabaseNotConfiguredError) {
      errorCategory = 'DATABASE_NOT_CONFIGURED';
    }
  }

  const env = getEnv();
  const geminiConfigured = isGeminiConfigured();
  const adminConfigured = getAdminConfigStatus().configured;
  const cronConfigured = Boolean(env.CRON_SECRET);
  const onVercel = Boolean(process.env.VERCEL);
  const healthy = dbReachable && schemaOk;

  if (!errorCategory && !geminiConfigured) {
    errorCategory = 'KEY_NOT_CONFIGURED';
  }

  const basePayload: Record<string, unknown> = {
    status: healthy ? 'ok' : 'degraded',
    application: 'healthy',
    database: healthy ? 'connected' : dbReachable ? 'schema_missing' : 'disconnected',
    dbReachable,
    schemaOk,
    databaseReachable: dbReachable,
    schemaReady: schemaOk,
    databaseMode,
    gemini: geminiConfigured ? 'configured' : 'missing',
    geminiConfigured,
    adminConfigured,
    cronConfigured,
    onVercel,
    appUrlHost: getAppUrlHost(),
    websiteExtractor: 'ready',
    backgroundExecution: 'after+cron',
    version: '1.0.0',
  };

  if (request.nextUrl?.searchParams?.get('detail') === '1' && hasValidCronAuth(request, env.CRON_SECRET)) {
    basePayload.category = errorCategory;
    basePayload.missingOrInvalidEnv = getMissingOrInvalidEnvNames();
  }

  return NextResponse.json(basePayload, {
    status: healthy ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
