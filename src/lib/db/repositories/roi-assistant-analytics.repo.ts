// src/lib/db/repositories/roi-assistant-analytics.repo.ts
import 'server-only';
import { asc, desc, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { getEnv } from '@/lib/env';
import {
  assistantAnalytics,
  assistantConversations,
  assistantMessages,
  auditEvents,
  auditRoi,
  audits,
} from '@/lib/db/schema';
import {
  countSuccessfulUserMessagesForAudit,
  serializeMessageDto,
} from '@/lib/db/repositories/assistant.repo';
import { findAuditRoiByAuditId, hydrateSavedRoiState } from '@/lib/db/repositories/roi.repo';
import type { AssistantMessageDto } from '@/lib/ai/assistant-types';
import type { RoiOutputs, RoiInputs, SavedRoiState, ScenarioKey } from '@/lib/roi/types';

export interface AdminRoiAndAssistantStats {
  roi: {
    reportsUsedCount: number;
    scenarioCounts: Record<ScenarioKey, number>;
    avgMonthlyAdminTasks: { avg: number | null; n: number };
    avgCapacityValueMonthly: { avg: number | null; n: number };
    roiCtaClicks: number;
  };
  assistant: {
    reportsOpenedCount: number;
    totalCustomerMessages: number;
    chipUsageCounts: Array<{ chipId: string; count: number }>;
    freeTextCount: number;
    topOpportunityCategories: Array<{ category: string; count: number }>;
    ctaShownCount: number;
    ctaClickedCount: number;
    assistantToConsultConversionPct: number | null;
  };
}

export async function getAdminRoiAndAssistantStats(): Promise<AdminRoiAndAssistantStats> {
  const db = getDb();
  const [roiRows, roiCtaEvents, analyticsRows, userMsgRows, auditConsultRows] = await Promise.all([
    db.select().from(auditRoi).where(eq(auditRoi.interacted, true)),
    db.select({ id: auditEvents.id }).from(auditEvents).where(eq(auditEvents.eventType, 'ROI_CTA_CLICK')),
    db.select().from(assistantAnalytics),
    db
      .select({ id: assistantMessages.id })
      .from(assistantMessages)
      .innerJoin(assistantConversations, eq(assistantMessages.conversationId, assistantConversations.id))
      .where(eq(assistantMessages.role, 'user')),
    db
      .select({ id: audits.id, consultRequestedAt: audits.consultRequestedAt })
      .from(audits),
  ]);

  const scenarioCounts: Record<ScenarioKey, number> = { conservative: 0, moderate: 0, optimistic: 0 };
  const adminTaskVals: number[] = [];
  const capVals: number[] = [];

  for (const row of roiRows) {
    const sc = row.selectedScenario as ScenarioKey;
    if (sc in scenarioCounts) scenarioCounts[sc] += 1;
    try {
      const inp = JSON.parse(row.inputsJson) as RoiInputs;
      if (typeof inp.monthlyAdminTasks === 'number' && Number.isFinite(inp.monthlyAdminTasks)) {
        adminTaskVals.push(inp.monthlyAdminTasks);
      }
      const outs = JSON.parse(row.outputsJson) as Record<ScenarioKey, RoiOutputs>;
      const cap = outs[sc]?.capacityValueMonthly;
      if (typeof cap === 'number' && Number.isFinite(cap)) {
        capVals.push(cap);
      }
    } catch {
      // skip corrupt row
    }
  }

  const avgOf = (arr: number[]) =>
    arr.length > 0 ? Math.round((arr.reduce((s, n) => s + n, 0) / arr.length) * 10) / 10 : null;

  const openedAuditIds = new Set<number>();
  const ctaShownAuditIds = new Set<number>();
  const ctaClickedAuditIds = new Set<number>();
  const chipCounts = new Map<string, number>();
  const catCounts = new Map<string, number>();
  let freeTextCount = 0;
  let ctaShownCount = 0;
  let ctaClickedCount = 0;

  for (const ev of analyticsRows) {
    if (ev.eventType === 'opened') openedAuditIds.add(ev.auditId);
    if (ev.eventType === 'chip_used' && ev.chipId) {
      chipCounts.set(ev.chipId, (chipCounts.get(ev.chipId) ?? 0) + 1);
    }
    if (ev.eventType === 'message_sent') freeTextCount += 1;
    if (ev.eventType === 'cta_shown') {
      ctaShownCount += 1;
      ctaShownAuditIds.add(ev.auditId);
    }
    if (ev.eventType === 'cta_clicked') {
      ctaClickedCount += 1;
      ctaClickedAuditIds.add(ev.auditId);
    }
    if (ev.opportunityCategory) {
      catCounts.set(ev.opportunityCategory, (catCounts.get(ev.opportunityCategory) ?? 0) + 1);
    }
  }

  const consultById = new Map(auditConsultRows.map((a) => [a.id, Boolean(a.consultRequestedAt)]));
  let convertedFromAssistant = 0;
  for (const aid of ctaClickedAuditIds) {
    if (consultById.get(aid)) convertedFromAssistant += 1;
  }

  const completedUserMessages = await db
    .select({ id: assistantMessages.id })
    .from(assistantMessages)
    .where(eq(assistantMessages.status, 'COMPLETED'));
  const completedIds = new Set(completedUserMessages.map((m) => m.id));
  const totalCustomerMessages = userMsgRows.filter((m) => completedIds.has(m.id)).length;

  return {
    roi: {
      reportsUsedCount: roiRows.length,
      scenarioCounts,
      avgMonthlyAdminTasks: { avg: avgOf(adminTaskVals), n: adminTaskVals.length },
      avgCapacityValueMonthly: { avg: avgOf(capVals), n: capVals.length },
      roiCtaClicks: roiCtaEvents.length,
    },
    assistant: {
      reportsOpenedCount: openedAuditIds.size,
      totalCustomerMessages,
      chipUsageCounts: Array.from(chipCounts.entries())
        .map(([chipId, count]) => ({ chipId, count }))
        .sort((a, b) => b.count - a.count),
      freeTextCount,
      topOpportunityCategories: Array.from(catCounts.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count),
      ctaShownCount,
      ctaClickedCount,
      assistantToConsultConversionPct:
        ctaShownAuditIds.size > 0
          ? Math.round((convertedFromAssistant / ctaShownAuditIds.size) * 1000) / 10
          : null,
    },
  };
}

export async function getAdminAuditRoiAndAssistantDetail(audit: {
  id: number;
  country: string;
  enquiryVolume: string | null;
  phoneVolume: string | null;
}): Promise<{
  roi: SavedRoiState | null;
  assistant: {
    messages: AssistantMessageDto[];
    usedCount: number;
    maxMessages: number;
    remainingMessages: number;
  };
}> {
  const db = getDb();
  const env = getEnv();
  const [roiRow, convs, usedCount] = await Promise.all([
    findAuditRoiByAuditId(audit.id),
    db
      .select({ id: assistantConversations.id })
      .from(assistantConversations)
      .where(eq(assistantConversations.auditId, audit.id))
      .orderBy(desc(assistantConversations.updatedAt)),
    countSuccessfulUserMessagesForAudit(audit.id),
  ]);

  let msgs: AssistantMessageDto[] = [];
  if (convs.length > 0) {
    const rows = await db
      .select()
      .from(assistantMessages)
      .where(inArray(assistantMessages.conversationId, convs.map((c) => c.id)))
      .orderBy(asc(assistantMessages.createdAt), asc(assistantMessages.id));
    msgs = rows.map(serializeMessageDto);
  }

  return {
    roi: roiRow
      ? hydrateSavedRoiState(roiRow, {
          country: audit.country,
          enquiryVolume: audit.enquiryVolume,
          phoneVolume: audit.phoneVolume,
        })
      : null,
    assistant: {
      messages: msgs,
      usedCount,
      maxMessages: env.ASSISTANT_MAX_USER_MESSAGES_PER_AUDIT,
      remainingMessages: Math.max(0, env.ASSISTANT_MAX_USER_MESSAGES_PER_AUDIT - usedCount),
    },
  };
}
