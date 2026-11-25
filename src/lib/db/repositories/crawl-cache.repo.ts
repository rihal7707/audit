import 'server-only';
import { eq, gt, lt, and } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { crawlCache } from '@/lib/db/schema';

export async function getCachedCrawl(originHash: string, nowIso = new Date().toISOString()) {
  const db = getDb();
  const rows = await db
    .select()
    .from(crawlCache)
    .where(and(eq(crawlCache.originHash, originHash), gt(crawlCache.expiresAt, nowIso)))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertCachedCrawl(
  originHash: string,
  payloadJson: string,
  fetchedAtIso: string,
  expiresAtIso: string,
): Promise<void> {
  const db = getDb();
  await db
    .insert(crawlCache)
    .values({
      originHash,
      payloadJson,
      fetchedAt: fetchedAtIso,
      expiresAt: expiresAtIso,
    })
    .onConflictDoUpdate({
      target: crawlCache.originHash,
      set: {
        payloadJson,
        fetchedAt: fetchedAtIso,
        expiresAt: expiresAtIso,
      },
    });
}

export async function purgeExpiredCrawlCache(nowIso = new Date().toISOString()): Promise<number> {
  const db = getDb();
  const res = await db.delete(crawlCache).where(lt(crawlCache.expiresAt, nowIso));
  return Number(res.rowsAffected ?? 0);
}

