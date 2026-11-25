import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { isGeminiConfigured } from '@/lib/env';

export async function GET() {
  let databaseReachable = false;
  try {
    const db = getDb();
    await db.run(sql`SELECT 1`);
    databaseReachable = true;
  } catch {
    databaseReachable = false;
  }

  return NextResponse.json(
    {
      status: databaseReachable ? 'ok' : 'degraded',
      databaseReachable,
      geminiConfigured: isGeminiConfigured(),
      version: '1.0.0',
    },
    {
      status: databaseReachable ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}

