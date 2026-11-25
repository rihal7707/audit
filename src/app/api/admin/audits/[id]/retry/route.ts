import { after, type NextRequest } from 'next/server';
import {
  findAuditById,
  recordAuditEvent,
  updateAuditProgress,
} from '@/lib/db/repositories/audits.repo';
import { runAuditPipeline } from '@/lib/pipeline/run-audit';
import { apiError, apiSuccess, createRequestId, requireAdminApiAccess } from '@/lib/http/api-helpers';

export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = createRequestId();
  const auth = await requireAdminApiAccess(request, requestId);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const auditId = Number(id);
  if (!Number.isInteger(auditId) || auditId <= 0) {
    return apiError('Invalid audit ID.', 400, requestId);
  }

  const audit = await findAuditById(auditId);
  if (!audit) {
    return apiError('Audit not found.', 404, requestId);
  }

  await updateAuditProgress(auditId, {
    auditStatus: 'QUEUED',
    lastError: null,
    currentStageLabel: 'Queued by administrator for retry',
    heartbeatAt: new Date().toISOString(),
  });
  await recordAuditEvent(auditId, 'ADMIN_RETRY', 'Administrator queued audit for retry.');

  after(async () => {
    await runAuditPipeline(auditId, { requestId, skipCrawlIfStored: true });
  });

  return apiSuccess({ queued: true }, 202, requestId);
}

