import { type NextRequest } from 'next/server';
import { z } from 'zod';
import {
  findAuditByPublicToken,
  recordAuditEvent,
  updateAuditLeadScoring,
} from '@/lib/db/repositories/audits.repo';
import { enforceIntentRateLimit } from '@/lib/security/rate-limit';
import { qualifyLead } from '@/lib/leads/qualify';
import { sendNonBlockingNotification } from '@/lib/notifications/notify';
import { apiError, apiSuccess, createRequestId } from '@/lib/http/api-helpers';

const IntentSchema = z.object({
  type: z.enum(['CONSULTATION', 'PILOT', 'DISCUSS', 'BOOKING_CLICK']),
  message: z.string().trim().max(1000).optional(),
  preferredTime: z.string().trim().max(160).optional(),
});

function parseJsonArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

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

  const parsed = IntentSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('Invalid request details.', 400, requestId);
  }

  const rl = await enforceIntentRateLimit(audit.publicToken);
  if (!rl.allowed) {
    return apiError('Too many requests submitted for this report.', 429, requestId);
  }

  const now = new Date().toISOString();
  const { type, message, preferredTime } = parsed.data;

  const consultRequestedAt =
    type === 'CONSULTATION' || type === 'DISCUSS'
      ? audit.consultRequestedAt ?? now
      : audit.consultRequestedAt;
  const pilotRequestedAt =
    type === 'PILOT' ? audit.pilotRequestedAt ?? now : audit.pilotRequestedAt;
  const bookingClickedAt =
    type === 'BOOKING_CLICK' ? audit.bookingClickedAt ?? now : audit.bookingClickedAt;

  const scoring = qualifyLead({
    industry: audit.industry,
    challenges: parseJsonArray(audit.challenges),
    goals: parseJsonArray(audit.goals),
    manualProcesses: audit.manualProcesses,
    contactRole: audit.contactRole,
    timeframe: audit.timeframe,
    consultRequestedAt,
    pilotRequestedAt,
    bookingClickedAt,
    contactPhone: audit.contactPhone,
    marketingConsent: audit.marketingConsent,
    crawlCoverage: audit.crawlCoverage,
    enquiryVolume: audit.enquiryVolume,
    phoneVolume: audit.phoneVolume,
    toolsUsed: audit.toolsUsed,
  });

  await updateAuditLeadScoring(audit.id, {
    leadScore: scoring.totalScore,
    leadScoreBreakdown: JSON.stringify(scoring.breakdown),
    leadReason: scoring.classificationReason,
    leadPriority: scoring.priority,
    consultRequestedAt: consultRequestedAt ?? undefined,
    pilotRequestedAt: pilotRequestedAt ?? undefined,
    bookingClickedAt: bookingClickedAt ?? undefined,
  });

  await recordAuditEvent(
    audit.id,
    `CUSTOMER_${type}`,
    `Customer recorded ${type} action from report page.`,
    {
      preferredTime: preferredTime ?? null,
      message: message ?? null,
      newScore: scoring.totalScore,
    },
  );

  if (type !== 'BOOKING_CLICK') {
    void sendNonBlockingNotification({
      event: 'CUSTOMER_INTENT',
      auditId: audit.id,
      businessName: audit.businessName,
      industry: audit.industry,
      intentType: type,
    });
  }

  return apiSuccess(
    {
      recorded: true,
      type,
      consultRequested: Boolean(consultRequestedAt),
      pilotRequested: Boolean(pilotRequestedAt),
    },
    200,
    requestId,
  );
}

