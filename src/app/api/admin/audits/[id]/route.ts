import { type NextRequest } from 'next/server';
import { z } from 'zod';
import {
  deleteAuditById,
  findAuditById,
  listAuditEvents,
  listAuditFindings,
  listAuditNotes,
  listAuditPages,
  listAuditStageHistory,
  recordAuditEvent,
  updateAuditAdminFields,
  updateAuditPipelineStage,
} from '@/lib/db/repositories/audits.repo';
import { LEAD_PRIORITIES, PIPELINE_STAGES } from '@/lib/db/schema';
import { apiError, apiSuccess, createRequestId, requireAdminApiAccess } from '@/lib/http/api-helpers';

const PatchAuditSchema = z.object({
  pipelineStage: z.enum(PIPELINE_STAGES).optional(),
  stageReason: z.string().trim().max(400).optional().nullable(),
  leadPriorityOverride: z.enum(LEAD_PRIORITIES).optional().nullable(),
  leadPriorityOverrideReason: z.string().trim().max(400).optional().nullable(),
  followUpAt: z.string().trim().max(60).optional().nullable(),
});

const DeleteAuditSchema = z.object({
  confirmBusinessName: z.string().trim().min(1),
});

export async function GET(
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

  const [pages, findings, notes, events, stageHistory] = await Promise.all([
    listAuditPages(auditId),
    listAuditFindings(auditId),
    listAuditNotes(auditId),
    listAuditEvents(auditId),
    listAuditStageHistory(auditId),
  ]);

  return apiSuccess(
    {
      audit,
      pages,
      findings,
      notes,
      events,
      stageHistory,
    },
    200,
    requestId,
  );
}

export async function PATCH(
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('Invalid JSON request body.', 400, requestId);
  }

  const parsed = PatchAuditSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('Invalid update payload.', 400, requestId);
  }

  const data = parsed.data;

  if (data.pipelineStage) {
    if (
      (data.pipelineStage === 'CONVERTED' || data.pipelineStage === 'NOT_INTERESTED') &&
      (!data.stageReason || data.stageReason.trim().length < 3)
    ) {
      return apiError(
        `A reason is required when marking an audit as ${data.pipelineStage}.`,
        400,
        requestId,
      );
    }
    await updateAuditPipelineStage(auditId, data.pipelineStage, data.stageReason);
  }

  const adminPatch: Parameters<typeof updateAuditAdminFields>[1] = {};

  if (data.leadPriorityOverride !== undefined) {
    if (
      data.leadPriorityOverride !== null &&
      (!data.leadPriorityOverrideReason || data.leadPriorityOverrideReason.trim().length < 3)
    ) {
      return apiError('A reason is required when overriding lead priority.', 400, requestId);
    }
    adminPatch.leadPriorityOverride = data.leadPriorityOverride;
    adminPatch.leadPriorityOverrideReason =
      data.leadPriorityOverride === null ? null : data.leadPriorityOverrideReason ?? null;

    await recordAuditEvent(
      auditId,
      'PRIORITY_OVERRIDDEN',
      data.leadPriorityOverride
        ? `Lead priority overridden to ${data.leadPriorityOverride}.`
        : 'Lead priority override cleared.',
      { reason: adminPatch.leadPriorityOverrideReason },
    );
  }

  if (data.followUpAt !== undefined) {
    adminPatch.followUpAt = data.followUpAt || null;
    await recordAuditEvent(
      auditId,
      'FOLLOW_UP_UPDATED',
      adminPatch.followUpAt
        ? `Follow-up scheduled for ${adminPatch.followUpAt}.`
        : 'Follow-up date cleared.',
    );
  }

  if (Object.keys(adminPatch).length > 0) {
    await updateAuditAdminFields(auditId, adminPatch);
  }

  const updated = await findAuditById(auditId);
  return apiSuccess({ audit: updated }, 200, requestId);
}

export async function DELETE(
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('Please type the business name to confirm deletion.', 400, requestId);
  }

  const parsed = DeleteAuditSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('Please type the business name to confirm deletion.', 400, requestId);
  }

  if (parsed.data.confirmBusinessName.toLowerCase() !== existing.businessName.trim().toLowerCase()) {
    return apiError('Entered business name does not match.', 400, requestId);
  }

  const deleted = await deleteAuditById(auditId);
  return apiSuccess({ deleted }, 200, requestId);
}

