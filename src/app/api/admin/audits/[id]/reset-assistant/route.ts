// src/app/api/admin/audits/[id]/reset-assistant/route.ts
import { type NextRequest } from 'next/server';
import { findAuditById, recordAuditEvent } from '@/lib/db/repositories/audits.repo';
import { apiError, apiSuccess, createRequestId, requireAdminApiAccess } from '@/lib/http/api-helpers';

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

  const existing = await findAuditById(auditId);
  if (!existing) {
    return apiError('Audit not found.', 404, requestId);
  }

  await recordAuditEvent(
    auditId,
    'ASSISTANT_LIMIT_RESET',
    'Administrator reset the assistant message cap for this audit.',
  );

  return apiSuccess({ reset: true }, 200, requestId);
}
