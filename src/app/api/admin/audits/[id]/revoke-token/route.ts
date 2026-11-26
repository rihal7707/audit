import { type NextRequest } from 'next/server';
import { z } from 'zod';
import {
  findAuditById,
  recordAuditEvent,
  updateAuditAdminFields,
} from '@/lib/db/repositories/audits.repo';
import { generatePublicToken } from '@/lib/security/tokens';
import { apiError, apiSuccess, createRequestId, requireAdminApiAccess } from '@/lib/http/api-helpers';

export const runtime = 'nodejs';

const RevokeSchema = z.object({
  mode: z.enum(['rotate', 'revoke']).optional().default('rotate'),
});

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

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = RevokeSchema.safeParse(body);
  const mode = parsed.success ? parsed.data.mode : 'rotate';

  if (mode === 'revoke') {
    await updateAuditAdminFields(auditId, { releaseStatus: 'REVOKED' });
    await recordAuditEvent(auditId, 'ADMIN_LINK_REVOKED', 'Administrator revoked public report link.');
    return apiSuccess({ releaseStatus: 'REVOKED', publicToken: audit.publicToken }, 200, requestId);
  }

  const newToken = generatePublicToken();
  await updateAuditAdminFields(auditId, {
    publicToken: newToken,
    releaseStatus: audit.releaseStatus === 'REVOKED' ? 'RELEASED' : audit.releaseStatus,
  });
  await recordAuditEvent(
    auditId,
    'ADMIN_LINK_ROTATED',
    'Administrator revoked old link and generated a fresh report token.',
  );

  return apiSuccess({ publicToken: newToken, releaseStatus: audit.releaseStatus }, 200, requestId);
}

