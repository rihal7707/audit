import { type NextRequest } from 'next/server';
import { z } from 'zod';
import {
  addAuditNote,
  findAuditById,
  recordAuditEvent,
} from '@/lib/db/repositories/audits.repo';
import { apiError, apiSuccess, createRequestId, requireAdminApiAccess } from '@/lib/http/api-helpers';

const NoteSchema = z.object({
  note: z.string().trim().min(1, 'Note cannot be empty.').max(2000),
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('Invalid JSON request body.', 400, requestId);
  }

  const parsed = NoteSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message || 'Invalid note.', 400, requestId);
  }

  const created = await addAuditNote(auditId, parsed.data.note);
  await recordAuditEvent(auditId, 'NOTE_ADDED', 'Internal admin note added.');

  return apiSuccess({ note: created }, 201, requestId);
}

