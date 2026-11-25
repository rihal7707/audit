import { after, type NextRequest } from 'next/server';
import { z } from 'zod';
import {
  findAuditByPublicToken,
  recordAuditEvent,
  updateAuditProgress,
} from '@/lib/db/repositories/audits.repo';
import { enforceSupplementRateLimit } from '@/lib/security/rate-limit';
import { detectSensitiveFreeText } from '@/lib/security/pii-scrub';
import { runAuditPipeline } from '@/lib/pipeline/run-audit';
import { apiError, apiSuccess, createRequestId } from '@/lib/http/api-helpers';

export const maxDuration = 60;

const SupplementSchema = z.object({
  supplementText: z
    .string()
    .trim()
    .min(30, 'Please enter at least 30 characters of public page text or service details.')
    .max(5000, 'Text is limited to 5,000 characters.'),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const requestId = createRequestId();
  const { token } = await context.params;

  const audit = await findAuditByPublicToken(token);
  if (!audit || audit.releaseStatus === 'REVOKED') {
    return apiError('Audit report not found.', 404, requestId);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('Invalid JSON request body.', 400, requestId);
  }

  const parsed = SupplementSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.issues[0]?.message || 'Invalid supplemental text.',
      400,
      requestId,
    );
  }

  const piiCheck = detectSensitiveFreeText(parsed.data.supplementText);
  if (piiCheck.hasSensitiveData) {
    return apiError(
      `Please remove sensitive personal details (${piiCheck.reasons.join(', ')}) before submitting.`,
      400,
      requestId,
    );
  }

  const rl = await enforceSupplementRateLimit(audit.publicToken);
  if (!rl.allowed) {
    return apiError(
      'Regeneration limit reached for this report. Please wait an hour before updating again.',
      429,
      requestId,
    );
  }

  await updateAuditProgress(audit.id, {
    supplementText: parsed.data.supplementText,
    supplementCount: audit.supplementCount + 1,
    auditStatus: 'QUEUED',
    currentStageIndex: 5,
    currentStageLabel: 'Preparing updated assessment',
    heartbeatAt: new Date().toISOString(),
  });

  await recordAuditEvent(
    audit.id,
    'CUSTOMER_SUPPLEMENT_ADDED',
    'Customer supplied additional public page text for report regeneration.',
    { length: parsed.data.supplementText.length },
  );

  after(async () => {
    await runAuditPipeline(audit.id, { requestId, skipCrawlIfStored: true });
  });

  return apiSuccess(
    {
      queued: true,
      progressUrl: `/audit/progress/${audit.publicToken}`,
    },
    202,
    requestId,
  );
}

