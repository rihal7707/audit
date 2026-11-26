import { after, type NextRequest } from 'next/server';
import { getEnv } from '@/lib/env';
import {
  countAuditsSince,
  findAuditByPublicToken,
  recordAuditEvent,
  updateAuditProgress,
} from '@/lib/db/repositories/audits.repo';
import { enforceRetryRateLimit } from '@/lib/security/rate-limit';
import { runAuditPipeline } from '@/lib/pipeline/run-audit';
import { apiError, apiSuccess, createRequestId } from '@/lib/http/api-helpers';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const requestId = createRequestId();
  const { token } = await context.params;

  const audit = await findAuditByPublicToken(token);
  if (!audit) {
    return apiError('Audit not found.', 404, requestId);
  }

  if (audit.auditStatus !== 'FAILED' && audit.auditStatus !== 'WAITING_FOR_QUOTA') {
    return apiError('This audit cannot be retried in its current state.', 409, requestId);
  }

  if (audit.retryCount >= 5) {
    return apiError(
      'Maximum automatic retry attempts reached. Please contact our team for assistance.',
      429,
      requestId,
    );
  }

  const rl = await enforceRetryRateLimit(audit.publicToken);
  if (!rl.allowed) {
    return apiError('Too many retry attempts. Please wait a bit before trying again.', 429, requestId);
  }

  const env = getEnv();
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const recentCount = await countAuditsSince(twentyFourHoursAgo);

  await updateAuditProgress(audit.id, {
    auditStatus: 'QUEUED',
    lastError: null,
    currentStageLabel: 'Queued for retry',
    heartbeatAt: new Date().toISOString(),
  });
  await recordAuditEvent(audit.id, 'PUBLIC_RETRY_REQUESTED', 'Customer triggered retry.');

  if (recentCount < env.MAX_AUDITS_PER_DAY) {
    after(async () => {
      await runAuditPipeline(audit.id, { requestId, skipCrawlIfStored: true });
    });
  }

  return apiSuccess({ queued: true, auditStatus: 'QUEUED' }, 202, requestId);
}

