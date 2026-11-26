import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { ensureDbReady, getDatabaseMode, getDb } from '@/lib/db';
import { isGeminiConfigured } from '@/lib/env';

export async function GET() {
  let databaseReachable = false;
  let schemaReady = false;
  let databaseMode: 'remote-libsql' | 'memory' | 'local-file' | 'unknown' = 'unknown';

  try {
    databaseMode = getDatabaseMode();
    await ensureDbReady();
    const db = getDb();
    await db.run(sql`SELECT 1`);
    databaseReachable = true;

    const tbl = await db.run(
      sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'audits' LIMIT 1`,
    );
    schemaReady = (tbl.rows?.length ?? 0) > 0;
  } catch {
    databaseReachable = false;
    schemaReady = false;
  }

  const healthy = databaseReachable && schemaReady;
  const geminiConfigured = isGeminiConfigured();

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      application: 'healthy',
      database: healthy ? 'connected' : databaseReachable ? 'schema_missing' : 'disconnected',
      databaseReachable,
      schemaReady,
      databaseMode,
      gemini: geminiConfigured ? 'configured' : 'missing',
      geminiConfigured,
      websiteExtractor: 'ready',
      backgroundExecution: 'after+cron',
      version: '1.0.0',
    },
    {
      status: healthy ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}

