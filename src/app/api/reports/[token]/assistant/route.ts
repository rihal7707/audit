// src/app/api/reports/[token]/assistant/route.ts
import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { getAssistantConfigStatus, getEnv } from '@/lib/env';
import { createRequestLogger } from '@/lib/logger';
import { AuditReportSchema } from '@/lib/ai/report-schema';
import { buildAuditAssistantContext } from '@/lib/ai/build-audit-assistant-context';
import { ASSISTANT_PROMPT_VERSION } from '@/lib/ai/audit-assistant-prompt';
import {
  AssistantConfigError,
  AssistantGenerationError,
  AssistantQuotaError,
  generateAuditAssistantReply,
  hasMockAssistantAdapterForTesting,
} from '@/lib/ai/assistant-client';
import {
  countSuccessfulUserMessagesForAudit,
  findOrCreateConversationForAudit,
  hasPendingAssistantMessage,
  insertAssistantMessage,
  listMessagesForConversation,
  recordAssistantAnalyticsEvent,
  serializeMessageDto,
  updateAssistantMessageStatus,
} from '@/lib/db/repositories/assistant.repo';
import { findAuditByPublicToken, listAuditPages } from '@/lib/db/repositories/audits.repo';
import {
  buildPrefillRoiState,
  findAuditRoiByAuditId,
  hydrateSavedRoiState,
} from '@/lib/db/repositories/roi.repo';
import { mergeSignalsAcrossPages, type DetectedSignal } from '@/lib/extraction/signals';
import { scrubSensitiveForAi } from '@/lib/security/pii-scrub';
import { enforceAssistantRateLimits } from '@/lib/security/rate-limit';
import { getClientIpHash } from '@/lib/security/tokens';
import { apiError, apiSuccess, createRequestId } from '@/lib/http/api-helpers';

const PostMessageSchema = z.object({
  message: z.string().trim().min(1),
  conversationId: z.number().int().positive().optional(),
  chipId: z.string().trim().max(60).optional(),
});

function parseJsonArray(raw: string): string[] {
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

async function loadReleasedAuditAndContext(token: string, requestId: string) {
  const audit = await findAuditByPublicToken(token);
  if (!audit) return { ok: false as const, response: apiError('Audit report not found.', 404, requestId) };
  if (audit.releaseStatus === 'REVOKED') {
    return { ok: false as const, response: apiError('This report link has been revoked.', 410, requestId) };
  }
  if (audit.releaseStatus === 'PENDING_REVIEW' || !audit.reportJson) {
    return { ok: false as const, response: apiError('Report is not yet released.', 403, requestId) };
  }
  const parsed = AuditReportSchema.safeParse(JSON.parse(audit.reportJson));
  if (!parsed.success) {
    return { ok: false as const, response: apiError('Audit report payload is invalid.', 500, requestId) };
  }
  const [pages, savedRoi] = await Promise.all([
    listAuditPages(audit.id),
    findAuditRoiByAuditId(audit.id),
  ]);
  const roiMeta = { country: audit.country, enquiryVolume: audit.enquiryVolume, phoneVolume: audit.phoneVolume };
  const roiState = savedRoi ? hydrateSavedRoiState(savedRoi, roiMeta) : buildPrefillRoiState(roiMeta);
  const signals = mergeSignalsAcrossPages(
    pages.map((p) => {
      try {
        const meta = JSON.parse(p.extractedMetadata || '{}') as { signals?: DetectedSignal[] };
        return meta.signals ?? [];
      } catch {
        return [];
      }
    }),
  );
  const built = buildAuditAssistantContext({
    businessName: audit.businessName,
    website: audit.website,
    industry: audit.industry,
    businessDescription: audit.businessDescription,
    challenges: parseJsonArray(audit.challenges),
    goals: parseJsonArray(audit.goals),
    crawlCoverage: audit.crawlCoverage,
    crawlFailureReason: audit.crawlFailureReason,
    report: parsed.data,
    signals,
    roiState,
  });
  return { ok: true as const, audit, built };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const requestId = createRequestId();
  const { token } = await context.params;
  const loaded = await loadReleasedAuditAndContext(token, requestId);
  if (!loaded.ok) return loaded.response;

  const env = getEnv();
  const status = getAssistantConfigStatus();
  const mockActive = hasMockAssistantAdapterForTesting();
  const reqConvId = Number(request.nextUrl.searchParams.get('conversationId') || '0') || null;
  const conv = await findOrCreateConversationForAudit({
    auditId: loaded.audit.id,
    requestedConversationId: reqConvId,
  });
  const [rows, usedCount] = await Promise.all([
    listMessagesForConversation(conv.id),
    countSuccessfulUserMessagesForAudit(loaded.audit.id),
  ]);

  if (request.nextUrl.searchParams.get('trackOpen') === '1') {
    void recordAssistantAnalyticsEvent({ auditId: loaded.audit.id, eventType: 'opened' });
  }

  return apiSuccess(
    {
      enabled: status.enabled,
      configured: status.configured || (status.enabled && mockActive),
      unavailableReason: status.configured || mockActive ? undefined : status.reason,
      conversationId: conv.id,
      conversationToken: conv.conversationToken,
      remainingMessages: Math.max(0, env.ASSISTANT_MAX_USER_MESSAGES_PER_AUDIT - usedCount),
      maxMessages: env.ASSISTANT_MAX_USER_MESSAGES_PER_AUDIT,
      maxMessageChars: env.ASSISTANT_MAX_MESSAGE_CHARS,
      messages: rows.filter((r) => r.status === 'COMPLETED').map(serializeMessageDto),
      findingsLookup: loaded.built.findingsLookup,
      opportunitiesLookup: loaded.built.opportunitiesLookup,
    },
    200,
    requestId,
    'private, no-store',
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const requestId = createRequestId();
  const log = createRequestLogger(requestId);
  const { token } = await context.params;
  const loaded = await loadReleasedAuditAndContext(token, requestId);
  if (!loaded.ok) return loaded.response;

  const env = getEnv();
  const status = getAssistantConfigStatus();
  const mockActive = hasMockAssistantAdapterForTesting();
  if (!status.enabled || (!status.configured && !mockActive)) {
    return apiError(status.reason || 'Assistant not available yet.', 503, requestId, { code: 'ASSISTANT_UNAVAILABLE' });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('Invalid JSON request body.', 400, requestId);
  }
  const parsedBody = PostMessageSchema.safeParse(body);
  if (!parsedBody.success) {
    return apiError('Please enter a question to send.', 400, requestId);
  }
  const rawMessage = parsedBody.data.message.trim();
  if (rawMessage.length > env.ASSISTANT_MAX_MESSAGE_CHARS) {
    return apiError(
      `Message exceeds the ${env.ASSISTANT_MAX_MESSAGE_CHARS}-character limit.`,
      400,
      requestId,
    );
  }

  const rl = await enforceAssistantRateLimits({
    ipHash: getClientIpHash(request),
    publicToken: loaded.audit.publicToken,
    dailyLimit: env.ASSISTANT_MAX_CALLS_PER_DAY,
  });
  if (!rl.allowed) {
    return apiError(rl.reason || 'Rate limit exceeded.', 429, requestId, { code: 'RATE_LIMITED' });
  }

  const usedBefore = await countSuccessfulUserMessagesForAudit(loaded.audit.id);
  if (usedBefore >= env.ASSISTANT_MAX_USER_MESSAGES_PER_AUDIT) {
    return apiError(
      'You have reached the question limit for this audit report. Request a consultation to continue exploring with our team.',
      429,
      requestId,
      { code: 'CAP_REACHED' },
    );
  }

  const conv = await findOrCreateConversationForAudit({
    auditId: loaded.audit.id,
    requestedConversationId: parsedBody.data.conversationId ?? null,
  });
  if (await hasPendingAssistantMessage(conv.id)) {
    return apiError('Please wait for the previous reply to finish.', 409, requestId, { code: 'PENDING' });
  }

  const scrubbed = scrubSensitiveForAi(rawMessage);
  const redacted = scrubbed !== rawMessage;
  const userRow = await insertAssistantMessage({
    conversationId: conv.id,
    role: 'user',
    message: scrubbed,
    status: 'PENDING',
    metadata: { redacted, chipId: parsedBody.data.chipId ?? 'free_text' },
  });

  const existingRows = (await listMessagesForConversation(conv.id)).filter(
    (r) => r.status === 'COMPLETED' && r.id !== userRow.id,
  );
  const recentHistory = existingRows
    .slice(-env.ASSISTANT_HISTORY_MESSAGES)
    .map((r) => ({ role: r.role, message: r.message }));

  const recentAssistantRows = existingRows.filter((r) => r.role === 'assistant').slice(-2);
  const recentCtaShownCount = recentAssistantRows.filter((r) => {
    try {
      const m = r.metadataJson ? (JSON.parse(r.metadataJson) as { cta?: { show?: boolean } }) : {};
      return Boolean(m.cta?.show);
    } catch {
      return false;
    }
  }).length;

  try {
    const reply = await generateAuditAssistantReply({
      contextText: loaded.built.contextText,
      history: recentHistory,
      userMessage: scrubbed,
      validFindingIds: new Set(loaded.built.findingIds),
      validOpportunityIds: new Set(loaded.built.opportunityIds),
      recentCtaShownCount,
    });

    await updateAssistantMessageStatus(userRow.id, 'COMPLETED');
    const assistantRow = await insertAssistantMessage({
      conversationId: conv.id,
      role: 'assistant',
      message: reply.payload.answer,
      status: 'COMPLETED',
      relatedFindingIds: reply.payload.relatedFindingIds,
      metadata: {
        relatedOpportunityIds: reply.payload.relatedOpportunityIds,
        suggestedFollowUpQuestions: reply.payload.suggestedFollowUpQuestions,
        cta: reply.payload.cta,
      },
      model: reply.usedModel,
      promptVersion: ASSISTANT_PROMPT_VERSION,
    });

    const firstOppTag = reply.payload.relatedOpportunityIds
      .map((id) => loaded.built.opportunityCategories[id])
      .find(Boolean);
    await recordAssistantAnalyticsEvent({
      auditId: loaded.audit.id,
      eventType: parsedBody.data.chipId ? 'chip_used' : 'message_sent',
      chipId: parsedBody.data.chipId ?? 'free_text',
      opportunityCategory: firstOppTag ?? null,
    });
    if (reply.payload.cta.show) {
      await recordAssistantAnalyticsEvent({
        auditId: loaded.audit.id,
        eventType: 'cta_shown',
        opportunityCategory: firstOppTag ?? null,
      });
    }

    log.info({ conversationId: conv.id, callsUsed: reply.callsUsed }, 'Assistant reply completed');
    const usedAfter = usedBefore + 1;
    return apiSuccess(
      {
        conversationId: conv.id,
        conversationToken: conv.conversationToken,
        redacted,
        remainingMessages: Math.max(0, env.ASSISTANT_MAX_USER_MESSAGES_PER_AUDIT - usedAfter),
        userMessage: serializeMessageDto({ ...userRow, status: 'COMPLETED' }),
        assistantMessage: serializeMessageDto(assistantRow),
      },
      200,
      requestId,
      'private, no-store',
    );
  } catch (err) {
    await updateAssistantMessageStatus(userRow.id, 'FAILED');
    if (err instanceof AssistantConfigError) {
      log.warn({ reason: 'config_error' }, 'Assistant unavailable');
      return apiError('Assistant not available yet.', 503, requestId, { code: 'ASSISTANT_UNAVAILABLE' });
    }
    if (err instanceof AssistantQuotaError) {
      log.warn({ statusCode: err.statusCode }, 'Assistant quota busy');
      return apiError('The assistant is temporarily busy. Please try again in a moment.', err.statusCode, requestId, {
        code: 'QUOTA_BUSY',
      });
    }
    if (err instanceof AssistantGenerationError) {
      log.warn({ reason: 'generation_validation' }, 'Assistant could not answer reliably');
      return apiError(
        "Couldn't answer that reliably from your audit data. Please try rephrasing or pick a suggested question.",
        422,
        requestId,
        { code: 'UNRELIABLE_OUTPUT' },
      );
    }
    log.error({ reason: 'unexpected_error' }, 'Assistant unexpected failure');
    return apiError('Could not complete your request right now. Please try again.', 500, requestId);
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const requestId = createRequestId();
  const { token } = await context.params;
  const loaded = await loadReleasedAuditAndContext(token, requestId);
  if (!loaded.ok) return loaded.response;

  const conv = await findOrCreateConversationForAudit({
    auditId: loaded.audit.id,
    forceNew: true,
  });
  const env = getEnv();
  const usedCount = await countSuccessfulUserMessagesForAudit(loaded.audit.id);

  return apiSuccess(
    {
      conversationId: conv.id,
      conversationToken: conv.conversationToken,
      remainingMessages: Math.max(0, env.ASSISTANT_MAX_USER_MESSAGES_PER_AUDIT - usedCount),
      messages: [],
    },
    200,
    requestId,
    'private, no-store',
  );
}
