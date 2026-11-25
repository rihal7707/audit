import { type NextRequest } from 'next/server';
import { z } from 'zod';
import {
  deleteAuditByToken,
  findAuditByPublicToken,
  listAuditPages,
  recordAuditEvent,
} from '@/lib/db/repositories/audits.repo';
import { serializePublicReportDto } from '@/lib/reports/public-dto';
import { apiError, apiSuccess, createRequestId } from '@/lib/http/api-helpers';

const DeleteConfirmSchema = z.object({
  confirm: z.literal(true),
});

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const requestId = createRequestId();
  const { token } = await context.params;

  const audit = await findAuditByPublicToken(token);
  if (!audit) {
    return apiError('Audit report not found.', 404, requestId);
  }

  if (audit.releaseStatus === 'REVOKED') {
    return apiError('This report link has been revoked.', 410, requestId);
  }

  const pages = await listAuditPages(audit.id);
  const dto = serializePublicReportDto(audit, pages);

  return apiSuccess(dto, 200, requestId, 'private, no-store');
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const requestId = createRequestId();
  const { token } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('Explicit confirmation is required to delete your data.', 400, requestId);
  }

  const parsed = DeleteConfirmSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('Explicit confirmation is required to delete your data.', 400, requestId);
  }

  const audit = await findAuditByPublicToken(token);
  if (!audit) {
    return apiError('Audit report not found.', 404, requestId);
  }

  await recordAuditEvent(audit.id, 'SELF_SERVICE_DELETE', 'Customer initiated self-service deletion.');
  const deleted = await deleteAuditByToken(token);

  return apiSuccess({ deleted }, 200, requestId);
}

