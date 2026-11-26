// src/app/api/reports/[token]/roi/route.ts
import { type NextRequest } from 'next/server';
import { findAuditByPublicToken, recordAuditEvent } from '@/lib/db/repositories/audits.repo';
import {
  buildPrefillRoiState,
  findAuditRoiByAuditId,
  hydrateSavedRoiState,
  upsertAuditRoi,
} from '@/lib/db/repositories/roi.repo';
import { cleanRoiInputs, SaveRoiPayloadSchema } from '@/lib/roi/validation';
import { enforceRoiSaveRateLimit } from '@/lib/security/rate-limit';
import { apiError, apiSuccess, createRequestId } from '@/lib/http/api-helpers';

export const runtime = 'nodejs';

function assertReleasedReport(
  audit: Awaited<ReturnType<typeof findAuditByPublicToken>>,
  requestId: string,
) {
  if (!audit) {
    return { ok: false as const, response: apiError('Audit report not found.', 404, requestId) };
  }
  if (audit.releaseStatus === 'REVOKED') {
    return { ok: false as const, response: apiError('This report link has been revoked.', 410, requestId) };
  }
  if (audit.releaseStatus === 'PENDING_REVIEW' || !audit.reportJson) {
    return { ok: false as const, response: apiError('Report is not yet released.', 403, requestId) };
  }
  return { ok: true as const, audit };
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const requestId = createRequestId();
  const { token } = await context.params;
  const audit = await findAuditByPublicToken(token);
  const check = assertReleasedReport(audit, requestId);
  if (!check.ok) return check.response;

  const meta = {
    country: check.audit.country,
    enquiryVolume: check.audit.enquiryVolume,
    phoneVolume: check.audit.phoneVolume,
  };

  const existing = await findAuditRoiByAuditId(check.audit.id);
  const state = existing ? hydrateSavedRoiState(existing, meta) : buildPrefillRoiState(meta);

  return apiSuccess(state, 200, requestId, 'private, no-store');
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const requestId = createRequestId();
  const { token } = await context.params;
  const audit = await findAuditByPublicToken(token);
  const check = assertReleasedReport(audit, requestId);
  if (!check.ok) return check.response;

  const rl = await enforceRoiSaveRateLimit(check.audit.publicToken);
  if (!rl.allowed) {
    return apiError('Too many ROI updates for this report. Please try again later.', 429, requestId);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('Invalid JSON request body.', 400, requestId);
  }

  const parsed = SaveRoiPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('Invalid ROI simulator input values.', 400, requestId);
  }

  const { currency, selectedScenario, inputs, scenarios } = parsed.data;
  const cleanedInputs = cleanRoiInputs(inputs, currency);

  const { state, firstInteraction } = await upsertAuditRoi({
    auditId: check.audit.id,
    currency,
    inputs: cleanedInputs,
    scenarios,
    selectedScenario,
    interacted: true,
  });

  if (firstInteraction) {
    await recordAuditEvent(
      check.audit.id,
      'ROI_USED',
      'Customer interacted with and saved ROI simulator calculations.',
      { currency, selectedScenario },
    );
  }

  const meta = {
    country: check.audit.country,
    enquiryVolume: check.audit.enquiryVolume,
    phoneVolume: check.audit.phoneVolume,
  };
  const hydrated = await findAuditRoiByAuditId(check.audit.id);
  return apiSuccess(
    hydrated ? hydrateSavedRoiState(hydrated, meta) : state,
    200,
    requestId,
    'private, no-store',
  );
}
