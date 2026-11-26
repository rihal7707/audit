import { type NextRequest } from 'next/server';
import {
  findAuditById,
  recordAuditEvent,
  updateAuditAdminFields,
} from '@/lib/db/repositories/audits.repo';
import { sendNonBlockingNotification } from '@/lib/notifications/notify';
import { apiError, apiSuccess, createRequestId, requireAdminApiAccess } from '@/lib/http/api-helpers';

export const runtime = 'nodejs';

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

  if (!audit.reportJson) {
    return apiError('Report must be generated before it can be released.', 409, requestId);
  }

  const isLimited = audit.crawlCoverage === 'LIMITED' || audit.crawlCoverage === 'NONE';
  const nextStatus = isLimited ? 'COMPLETED_LIMITED' : 'COMPLETED';

  await updateAuditAdminFields(auditId, {
    releaseStatus: 'RELEASED',
    auditStatus: nextStatus,
  });

  await recordAuditEvent(auditId, 'ADMIN_RELEASED_REPORT', 'Administrator released report to customer.');

  void sendNonBlockingNotification({
    event: 'REPORT_READY',
    auditId,
    businessName: audit.businessName,
    industry: audit.industry,
    publicToken: audit.publicToken,
    customerEmail: audit.contactEmail,
  });

  return apiSuccess({ releaseStatus: 'RELEASED', auditStatus: nextStatus }, 200, requestId);
}

