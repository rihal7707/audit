import crypto from 'node:crypto';
import { type NextRequest } from 'next/server';
import { getEnv } from '@/lib/env';
import { ensureDbReady } from '@/lib/db';
import {
  countAuditsSince,
  findResumableAudits,
  purgeExpiredAudits,
  recordAuditEvent,
} from '@/lib/db/repositories/audits.repo';
import { purgeExpiredCrawlCache } from '@/lib/db/repositories/crawl-cache.repo';
import { pruneExpiredRateLimits } from '@/lib/db/repositories/rate-limits.repo';
import { runAuditPipeline } from '@/lib/pipeline/run-audit';
import { apiError, apiSuccess, createRequestId } from '@/lib/http/api-helpers';

export const maxDuration = 60;

function verifyCronSecret(request: NextRequest, expectedSecret: string | undefined): boolean {
  if (!expectedSecret) return false;
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return false;
  const provided = authHeader.slice('Bearer '.length).trim();
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expectedSecret).digest();
  return crypto.timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const requestId = createRequestId();
  const env = getEnv();

  if (!verifyCronSecret(request, env.CRON_SECRET)) {
    return apiError('Unauthorized cron request.', 401, requestId);
  }

  await ensureDbReady();

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const staleBeforeIso = new Date(nowMs - 5 * 60 * 1000).toISOString();
  const twentyFourHoursAgoIso = new Date(nowMs - 24 * 3600 * 1000).toISOString();
  const retentionCutoffIso = new Date(
    nowMs - env.DATA_RETENTION_DAYS * 24 * 3600 * 1000,
  ).toISOString();
  const rateLimitCutoffEpoch = Math.floor(nowMs / 1000) - 48 * 3600;

  // Purge expired retention data & caches
  const [purgedAudits, purgedCache, purgedRateLimits] = await Promise.all([
    purgeExpiredAudits(retentionCutoffIso),
    purgeExpiredCrawlCache(nowIso),
    pruneExpiredRateLimits(rateLimitCutoffEpoch),
  ]);

  // Resume queued / waiting-for-quota / stuck audits respecting MAX_AUDITS_PER_DAY
  const recentCount = await countAuditsSince(twentyFourHoursAgoIso);
  const candidates = await findResumableAudits(staleBeforeIso, 5);
  const resumed: Array<{ auditId: number; status: string }> = [];

  for (const audit of candidates) {
    if (recentCount >= env.MAX_AUDITS_PER_DAY && audit.auditStatus === 'QUEUED') {
      continue;
    }
    await recordAuditEvent(
      audit.id,
      'CRON_RESUMED',
      `Background cron resumed audit from status ${audit.auditStatus}.`,
    );
    const result = await runAuditPipeline(audit.id, {
      requestId,
      skipCrawlIfStored: true,
    });
    resumed.push({ auditId: audit.id, status: result.status });
    if (result.status === 'WAITING_FOR_QUOTA') {
      break;
    }
  }

  return apiSuccess(
    {
      purgedAudits,
      purgedCache,
      purgedRateLimits,
      resumed,
    },
    200,
    requestId,
  );
}

export { POST as GET };

