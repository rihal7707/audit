import 'server-only';
import { and, eq, lt, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { rateLimits } from '@/lib/db/schema';

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
  remaining: number;
  resetAt: number; // unix seconds
}

export async function checkAndIncrementRateLimit(
  key: string,
  windowSeconds: number,
  limit: number,
  nowEpochSeconds = Math.floor(Date.now() / 1000),
): Promise<RateLimitResult> {
  const db = getDb();
  const windowStart = Math.floor(nowEpochSeconds / windowSeconds) * windowSeconds;
  const resetAt = windowStart + windowSeconds;

  await db
    .insert(rateLimits)
    .values({
      key,
      windowStart,
      count: 1,
    })
    .onConflictDoUpdate({
      target: [rateLimits.key, rateLimits.windowStart],
      set: {
        count: sql`${rateLimits.count} + 1`,
      },
    });

  const rows = await db
    .select({ count: rateLimits.count })
    .from(rateLimits)
    .where(and(eq(rateLimits.key, key), eq(rateLimits.windowStart, windowStart)))
    .limit(1);

  const count = rows[0]?.count ?? 1;
  const allowed = count <= limit;
  const remaining = Math.max(0, limit - count);

  return {
    allowed,
    count,
    limit,
    remaining,
    resetAt,
  };
}

export async function pruneExpiredRateLimits(beforeEpochSeconds: number): Promise<number> {
  const db = getDb();
  const res = await db
    .delete(rateLimits)
    .where(lt(rateLimits.windowStart, beforeEpochSeconds));
  return Number(res.rowsAffected ?? 0);
}

