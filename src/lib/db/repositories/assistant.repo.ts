// src/lib/db/repositories/assistant.repo.ts
import 'server-only';
import { and, asc, desc, eq, gt, inArray, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import {
  assistantAnalytics,
  assistantConversations,
  assistantMessages,
  auditEvents,
} from '@/lib/db/schema';
import { generatePublicToken } from '@/lib/security/tokens';
import type { AssistantCta, AssistantMessageDto } from '@/lib/ai/assistant-types';

export type AssistantConversationRow = typeof assistantConversations.$inferSelect;
export type AssistantMessageRow = typeof assistantMessages.$inferSelect;

export async function findOrCreateConversationForAudit(params: {
  auditId: number;
  requestedConversationId?: number | null;
  forceNew?: boolean;
}): Promise<AssistantConversationRow> {
  const db = getDb();
  const now = new Date().toISOString();

  if (!params.forceNew && params.requestedConversationId && params.requestedConversationId > 0) {
    const match = await db
      .select()
      .from(assistantConversations)
      .where(
        and(
          eq(assistantConversations.id, params.requestedConversationId),
          eq(assistantConversations.auditId, params.auditId),
        ),
      )
      .limit(1);
    if (match[0]) return match[0];
  }

  if (!params.forceNew && !params.requestedConversationId) {
    const latest = await db
      .select()
      .from(assistantConversations)
      .where(eq(assistantConversations.auditId, params.auditId))
      .orderBy(desc(assistantConversations.updatedAt), desc(assistantConversations.id))
      .limit(1);
    if (latest[0]) return latest[0];
  }

  const inserted = await db
    .insert(assistantConversations)
    .values({
      auditId: params.auditId,
      conversationToken: generatePublicToken(),
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const row = inserted[0];
  if (!row) throw new Error('Failed to create assistant conversation');
  return row;
}

export async function listMessagesForConversation(conversationId: number): Promise<AssistantMessageRow[]> {
  const db = getDb();
  return db
    .select()
    .from(assistantMessages)
    .where(eq(assistantMessages.conversationId, conversationId))
    .orderBy(asc(assistantMessages.createdAt), asc(assistantMessages.id));
}

export async function hasPendingAssistantMessage(conversationId: number): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select({ id: assistantMessages.id })
    .from(assistantMessages)
    .where(
      and(
        eq(assistantMessages.conversationId, conversationId),
        eq(assistantMessages.status, 'PENDING'),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function countSuccessfulUserMessagesForAudit(auditId: number): Promise<number> {
  const db = getDb();
  const resets = await db
    .select({ createdAt: auditEvents.createdAt })
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.auditId, auditId),
        eq(auditEvents.eventType, 'ASSISTANT_LIMIT_RESET'),
      ),
    )
    .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
    .limit(1);

  const resetAfter = resets[0]?.createdAt ?? null;
  const convs = await db
    .select({ id: assistantConversations.id })
    .from(assistantConversations)
    .where(eq(assistantConversations.auditId, auditId));
  if (convs.length === 0) return 0;

  const convIds = convs.map((c) => c.id);
  const whereClause = resetAfter
    ? and(
        inArray(assistantMessages.conversationId, convIds),
        eq(assistantMessages.role, 'user'),
        eq(assistantMessages.status, 'COMPLETED'),
        gt(assistantMessages.createdAt, resetAfter),
      )
    : and(
        inArray(assistantMessages.conversationId, convIds),
        eq(assistantMessages.role, 'user'),
        eq(assistantMessages.status, 'COMPLETED'),
      );

  const countRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(assistantMessages)
    .where(whereClause);
  return Number(countRows[0]?.count ?? 0);
}

export async function insertAssistantMessage(input: {
  conversationId: number;
  role: 'user' | 'assistant';
  message: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  relatedFindingIds?: string[];
  metadata?: Record<string, unknown>;
  model?: string | null;
  promptVersion?: string | null;
}): Promise<AssistantMessageRow> {
  const db = getDb();
  const now = new Date().toISOString();
  const rows = await db
    .insert(assistantMessages)
    .values({
      conversationId: input.conversationId,
      role: input.role,
      message: input.message,
      relatedFindingIds: input.relatedFindingIds ? JSON.stringify(input.relatedFindingIds) : null,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
      status: input.status,
      model: input.model ?? null,
      promptVersion: input.promptVersion ?? null,
      createdAt: now,
    })
    .returning();

  await db
    .update(assistantConversations)
    .set({ updatedAt: now })
    .where(eq(assistantConversations.id, input.conversationId));

  if (!rows[0]) throw new Error('Failed to insert assistant message');
  return rows[0];
}

export async function updateAssistantMessageStatus(
  id: number,
  status: 'COMPLETED' | 'FAILED',
): Promise<void> {
  const db = getDb();
  await db.update(assistantMessages).set({ status }).where(eq(assistantMessages.id, id));
}

export async function recordAssistantAnalyticsEvent(input: {
  auditId: number;
  eventType: 'opened' | 'message_sent' | 'chip_used' | 'cta_shown' | 'cta_clicked';
  opportunityCategory?: string | null;
  chipId?: string | null;
}): Promise<void> {
  const db = getDb();
  await db.insert(assistantAnalytics).values({
    auditId: input.auditId,
    eventType: input.eventType,
    opportunityCategory: input.opportunityCategory ?? null,
    chipId: input.chipId ?? null,
    createdAt: new Date().toISOString(),
  });
}

export function serializeMessageDto(row: AssistantMessageRow): AssistantMessageDto {
  let relatedFindingIds: string[] | undefined;
  let meta: Record<string, unknown> = {};
  try {
    if (row.relatedFindingIds) relatedFindingIds = JSON.parse(row.relatedFindingIds) as string[];
    if (row.metadataJson) meta = JSON.parse(row.metadataJson) as Record<string, unknown>;
  } catch {
    // ignore corrupt meta
  }
  return {
    id: String(row.id),
    role: row.role,
    message: row.message,
    status: row.status,
    createdAt: row.createdAt,
    redacted: Boolean(meta.redacted),
    relatedFindingIds,
    relatedOpportunityIds: Array.isArray(meta.relatedOpportunityIds)
      ? (meta.relatedOpportunityIds as string[])
      : undefined,
    suggestedFollowUpQuestions: Array.isArray(meta.suggestedFollowUpQuestions)
      ? (meta.suggestedFollowUpQuestions as string[])
      : undefined,
    cta: meta.cta as AssistantCta | undefined,
  };
}
