import 'server-only';
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  like,
  lt,
  lte,
  or,
  sql,
} from 'drizzle-orm';
import { getDb } from '@/lib/db';
import {
  audits,
  auditEvents,
  auditFindings,
  auditNotes,
  auditPages,
  auditRoi,
  auditStageHistory,
  assistantAnalytics,
  assistantConversations,
  assistantMessages,
  PIPELINE_STAGES,
  processingLocks,
  type AuditStatus,
  type CrawlCoverage,
  type LeadPriority,
  type PipelineStage,
  type ReleaseStatus,
} from '@/lib/db/schema';

export type AuditRow = typeof audits.$inferSelect;
export type AuditPageRow = typeof auditPages.$inferSelect;
export type AuditFindingRow = typeof auditFindings.$inferSelect;
export type AuditNoteRow = typeof auditNotes.$inferSelect;
export type AuditEventRow = typeof auditEvents.$inferSelect;
export type AuditStageHistoryRow = typeof auditStageHistory.$inferSelect;

export interface CreateAuditInput {
  publicToken: string;
  businessName: string;
  website: string;
  normalizedDomain: string;
  industry: string;
  country: string;
  location?: string | null;
  businessSize?: string | null;
  businessDescription: string;
  challenges: string[];
  goals: string[];
  toolsUsed?: string | null;
  enquiryVolume?: string | null;
  phoneVolume?: string | null;
  teamSize?: string | null;
  manualProcesses?: string | null;
  timeframe?: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone?: string | null;
  contactRole?: string | null;
  isFreeEmailDomain: boolean;
  consent: boolean;
  consentVersion: string;
  consentAt: string;
  marketingConsent: boolean;
  leadScore: number;
  leadScoreBreakdown: string;
  leadReason: string;
  leadPriority: LeadPriority;
  releaseStatus: ReleaseStatus;
  dedupeKey: string;
  ipHash?: string | null;
}

export async function createAudit(input: CreateAuditInput): Promise<AuditRow> {
  const db = getDb();
  const now = new Date().toISOString();

  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(audits)
      .values({
        publicToken: input.publicToken,
        businessName: input.businessName,
        website: input.website,
        normalizedDomain: input.normalizedDomain,
        industry: input.industry,
        country: input.country,
        location: input.location ?? null,
        businessSize: input.businessSize ?? null,
        businessDescription: input.businessDescription,
        challenges: JSON.stringify(input.challenges),
        goals: JSON.stringify(input.goals),
        toolsUsed: input.toolsUsed ?? null,
        enquiryVolume: input.enquiryVolume ?? null,
        phoneVolume: input.phoneVolume ?? null,
        teamSize: input.teamSize ?? null,
        manualProcesses: input.manualProcesses ?? null,
        timeframe: input.timeframe ?? null,
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone ?? null,
        contactRole: input.contactRole ?? null,
        isFreeEmailDomain: input.isFreeEmailDomain,
        consent: input.consent,
        consentVersion: input.consentVersion,
        consentAt: input.consentAt,
        marketingConsent: input.marketingConsent,
        auditStatus: 'QUEUED',
        currentStageIndex: 0,
        currentStageLabel: 'Queued for analysis',
        heartbeatAt: now,
        retryCount: 0,
        leadScore: input.leadScore,
        leadScoreBreakdown: input.leadScoreBreakdown,
        leadReason: input.leadReason,
        leadPriority: input.leadPriority,
        pipelineStage: 'NEW',
        stageEnteredAt: now,
        releaseStatus: input.releaseStatus,
        dedupeKey: input.dedupeKey,
        ipHash: input.ipHash ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const row = inserted[0];
    if (!row) {
      throw new Error('Failed to create audit record');
    }

    await tx.insert(auditStageHistory).values({
      auditId: row.id,
      fromStage: null,
      toStage: 'NEW',
      reason: 'Audit submitted',
      changedAt: now,
    });

    await tx.insert(auditEvents).values({
      auditId: row.id,
      eventType: 'AUDIT_SUBMITTED',
      message: 'Audit submission created and queued for processing.',
      metadata: JSON.stringify({ industry: input.industry }),
      createdAt: now,
    });

    return row;
  });
}

export async function findAuditByPublicToken(token: string): Promise<AuditRow | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(audits)
    .where(eq(audits.publicToken, token))
    .limit(1);
  return rows[0] ?? null;
}

export async function findAuditById(id: number): Promise<AuditRow | null> {
  const db = getDb();
  const rows = await db.select().from(audits).where(eq(audits.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function findRecentDuplicateAudit(
  dedupeKey: string,
  sinceIso: string,
): Promise<AuditRow | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(audits)
    .where(and(eq(audits.dedupeKey, dedupeKey), gte(audits.createdAt, sinceIso)))
    .orderBy(desc(audits.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function countAuditsSince(sinceIso: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(audits)
    .where(gte(audits.createdAt, sinceIso));
  return Number(rows[0]?.count ?? 0);
}

export interface AuditProgressPatch {
  auditStatus?: AuditStatus;
  currentStageIndex?: number;
  currentStageLabel?: string;
  heartbeatAt?: string;
  retryCount?: number;
  lastError?: string | null;
  crawlCoverage?: CrawlCoverage | null;
  crawlFailureReason?: string | null;
  releaseStatus?: ReleaseStatus;
  supplementText?: string | null;
  supplementCount?: number;
  publicToken?: string;
}

export async function updateAuditProgress(id: number, patch: AuditProgressPatch): Promise<void> {
  const db = getDb();
  await db
    .update(audits)
    .set({
      ...patch,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(audits.id, id));
}

export async function updateAuditLeadScoring(
  id: number,
  data: {
    leadScore: number;
    leadScoreBreakdown: string;
    leadReason: string;
    leadPriority: LeadPriority;
    consultRequestedAt?: string;
    pilotRequestedAt?: string;
    bookingClickedAt?: string;
  },
): Promise<void> {
  const db = getDb();
  await db
    .update(audits)
    .set({
      ...data,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(audits.id, id));
}

export async function updateAuditAdminFields(
  id: number,
  data: {
    leadPriorityOverride?: LeadPriority | null;
    leadPriorityOverrideReason?: string | null;
    followUpAt?: string | null;
    releaseStatus?: ReleaseStatus;
    auditStatus?: AuditStatus;
    publicToken?: string;
  },
): Promise<void> {
  const db = getDb();
  await db
    .update(audits)
    .set({
      ...data,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(audits.id, id));
}

export async function updateAuditPipelineStage(
  id: number,
  toStage: PipelineStage,
  reason?: string | null,
): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();

  await db.transaction(async (tx) => {
    const existing = await tx.select().from(audits).where(eq(audits.id, id)).limit(1);
    const current = existing[0];
    if (!current) throw new Error('Audit not found');
    if (current.pipelineStage === toStage) return;

    await tx
      .update(audits)
      .set({
        pipelineStage: toStage,
        stageEnteredAt: now,
        updatedAt: now,
      })
      .where(eq(audits.id, id));

    await tx.insert(auditStageHistory).values({
      auditId: id,
      fromStage: current.pipelineStage,
      toStage,
      reason: reason ?? null,
      changedAt: now,
    });

    await tx.insert(auditEvents).values({
      auditId: id,
      eventType: 'STAGE_CHANGED',
      message: `Pipeline stage changed from ${current.pipelineStage} to ${toStage}.`,
      metadata: JSON.stringify({ fromStage: current.pipelineStage, toStage, reason: reason ?? null }),
      createdAt: now,
    });
  });
}

export interface SaveReportInput {
  reportJson: string;
  reportVersion: string;
  promptVersion: string;
  model: string;
  auditStatus: AuditStatus;
  releaseStatus: ReleaseStatus;
  crawlCoverage: CrawlCoverage;
  findings: Array<{
    category: string;
    finding: string;
    priority: string;
    evidenceType: string;
    confidence: string;
    evidence: string;
    recommendation: string;
  }>;
}

export async function saveGeneratedReport(id: number, input: SaveReportInput): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();

  await db.transaction(async (tx) => {
    await tx
      .update(audits)
      .set({
        reportJson: input.reportJson,
        reportVersion: input.reportVersion,
        promptVersion: input.promptVersion,
        model: input.model,
        auditStatus: input.auditStatus,
        releaseStatus: input.releaseStatus,
        crawlCoverage: input.crawlCoverage,
        currentStageIndex: 9,
        currentStageLabel: 'Completed',
        lastError: null,
        heartbeatAt: now,
        updatedAt: now,
      })
      .where(eq(audits.id, id));

    await tx.delete(auditFindings).where(eq(auditFindings.auditId, id));

    if (input.findings.length > 0) {
      await tx.insert(auditFindings).values(
        input.findings.map((f) => ({
          auditId: id,
          category: f.category,
          finding: f.finding,
          priority: f.priority,
          evidenceType: f.evidenceType,
          confidence: f.confidence,
          evidence: f.evidence,
          recommendation: f.recommendation,
        })),
      );
    }
  });
}

export async function recordAuditEvent(
  auditId: number,
  eventType: string,
  message: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const db = getDb();
  await db.insert(auditEvents).values({
    auditId,
    eventType,
    message,
    metadata: metadata ? JSON.stringify(metadata) : null,
    createdAt: new Date().toISOString(),
  });
}

export async function listAuditEvents(auditId: number): Promise<AuditEventRow[]> {
  const db = getDb();
  return db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.auditId, auditId))
    .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id));
}

export interface UpsertPageInput {
  pageLabel: string;
  url: string;
  pageTitle?: string | null;
  httpStatus?: number | null;
  extractedText?: string | null;
  extractedMetadata?: string | null;
  contentHash?: string | null;
  extractionStatus: string;
  fetchedAt: string;
}

export async function replaceAuditPages(auditId: number, pages: UpsertPageInput[]): Promise<void> {
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.delete(auditPages).where(eq(auditPages.auditId, auditId));
    if (pages.length > 0) {
      await tx.insert(auditPages).values(
        pages.map((p) => ({
          auditId,
          pageLabel: p.pageLabel,
          url: p.url,
          pageTitle: p.pageTitle ?? null,
          httpStatus: p.httpStatus ?? null,
          extractedText: p.extractedText ?? null,
          extractedMetadata: p.extractedMetadata ?? null,
          contentHash: p.contentHash ?? null,
          extractionStatus: p.extractionStatus,
          fetchedAt: p.fetchedAt,
        })),
      );
    }
  });
}

export async function listAuditPages(auditId: number): Promise<AuditPageRow[]> {
  const db = getDb();
  return db
    .select()
    .from(auditPages)
    .where(eq(auditPages.auditId, auditId))
    .orderBy(asc(auditPages.pageLabel));
}

export async function listAuditFindings(auditId: number): Promise<AuditFindingRow[]> {
  const db = getDb();
  return db
    .select()
    .from(auditFindings)
    .where(eq(auditFindings.auditId, auditId))
    .orderBy(asc(auditFindings.id));
}

export async function addAuditNote(auditId: number, note: string): Promise<AuditNoteRow> {
  const db = getDb();
  const now = new Date().toISOString();
  const inserted = await db
    .insert(auditNotes)
    .values({
      auditId,
      note,
      createdAt: now,
    })
    .returning();
  const row = inserted[0];
  if (!row) throw new Error('Failed to create note');
  return row;
}

export async function listAuditNotes(auditId: number): Promise<AuditNoteRow[]> {
  const db = getDb();
  return db
    .select()
    .from(auditNotes)
    .where(eq(auditNotes.auditId, auditId))
    .orderBy(desc(auditNotes.createdAt));
}

export async function listAuditStageHistory(auditId: number): Promise<AuditStageHistoryRow[]> {
  const db = getDb();
  return db
    .select()
    .from(auditStageHistory)
    .where(eq(auditStageHistory.auditId, auditId))
    .orderBy(desc(auditStageHistory.changedAt), desc(auditStageHistory.id));
}

export interface AdminAuditListFilters {
  search?: string;
  stages?: PipelineStage[];
  priorities?: LeadPriority[];
  statuses?: AuditStatus[];
  industry?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'leadScore' | 'businessName';
  sortDir?: 'asc' | 'desc';
}

function buildAdminWhereClause(filters: AdminAuditListFilters) {
  const conditions = [];

  if (filters.search && filters.search.trim().length > 0) {
    const q = `%${filters.search.trim()}%`;
    conditions.push(
      or(
        like(audits.businessName, q),
        like(audits.website, q),
        like(audits.normalizedDomain, q),
        like(audits.industry, q),
        like(audits.contactName, q),
        like(audits.contactEmail, q),
      ),
    );
  }

  if (filters.stages && filters.stages.length > 0) {
    conditions.push(inArray(audits.pipelineStage, filters.stages));
  }

  if (filters.priorities && filters.priorities.length > 0) {
    conditions.push(
      or(
        inArray(audits.leadPriorityOverride, filters.priorities),
        and(
          isNull(audits.leadPriorityOverride),
          inArray(audits.leadPriority, filters.priorities),
        ),
      ),
    );
  }

  if (filters.statuses && filters.statuses.length > 0) {
    conditions.push(inArray(audits.auditStatus, filters.statuses));
  }

  if (filters.industry && filters.industry.trim().length > 0) {
    conditions.push(eq(audits.industry, filters.industry.trim()));
  }

  if (filters.dateFrom) {
    conditions.push(gte(audits.createdAt, filters.dateFrom));
  }

  if (filters.dateTo) {
    conditions.push(lte(audits.createdAt, filters.dateTo));
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

export async function listAuditsAdmin(filters: AdminAuditListFilters) {
  const db = getDb();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  const where = buildAdminWhereClause(filters);

  const sortCol =
    filters.sortBy === 'leadScore'
      ? audits.leadScore
      : filters.sortBy === 'businessName'
        ? audits.businessName
        : audits.createdAt;
  const orderExpr = filters.sortDir === 'asc' ? asc(sortCol) : desc(sortCol);

  const [rows, countRows] = await Promise.all([
    db
      .select()
      .from(audits)
      .where(where)
      .orderBy(orderExpr, desc(audits.id))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(audits)
      .where(where),
  ]);

  const total = Number(countRows[0]?.count ?? 0);
  return {
    items: rows,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function exportAuditsAdmin(filters: AdminAuditListFilters): Promise<AuditRow[]> {
  const db = getDb();
  const where = buildAdminWhereClause(filters);
  return db
    .select()
    .from(audits)
    .where(where)
    .orderBy(desc(audits.createdAt), desc(audits.id))
    .limit(5000);
}

export interface AdminStatsData {
  kpis: {
    totalSubmissions: number;
    reportsGenerated: number;
    qualifiedProspects: number;
    consultationRequests: number;
    pilotDiscussions: number;
    convertedClients: number;
    hotLeadsCount: number;
  };
  funnel: Array<{
    key: string;
    label: string;
    count: number;
    stepConversionPct: number | null;
    overallConversionPct: number | null;
  }>;
  recentAudits: AuditRow[];
  needsAttention: {
    hotWithoutFollowUp: AuditRow[];
    failedOrQueued: AuditRow[];
    overdueFollowUps: AuditRow[];
  };
}

export async function getAdminStats(nowIso = new Date().toISOString()): Promise<AdminStatsData> {
  const db = getDb();

  const [allAudits, stageRows] = await Promise.all([
    db.select().from(audits).orderBy(desc(audits.createdAt), desc(audits.id)),
    db.select({ auditId: auditStageHistory.auditId, toStage: auditStageHistory.toStage }).from(auditStageHistory),
  ]);

  const reachedStages = new Map<PipelineStage, Set<number>>();
  for (const s of PIPELINE_STAGES) {
    reachedStages.set(s, new Set<number>());
  }
  for (const row of stageRows) {
    reachedStages.get(row.toStage)?.add(row.auditId);
  }
  // Ensure any audit's current stage is also counted even if seeded directly
  for (const a of allAudits) {
    reachedStages.get(a.pipelineStage)?.add(a.id);
  }

  const totalSubmissions = allAudits.length;
  const reportsGenerated = allAudits.filter(
    (a) => a.reportJson !== null && a.reportJson.length > 0,
  ).length;

  const everQualifiedIds = new Set<number>([
    ...(reachedStages.get('QUALIFIED') ?? []),
    ...(reachedStages.get('CONSULTATION_BOOKED') ?? []),
    ...(reachedStages.get('PILOT_DISCUSSION') ?? []),
    ...(reachedStages.get('PROPOSAL_SENT') ?? []),
    ...(reachedStages.get('CONVERTED') ?? []),
  ]);

  const everConsultationIds = new Set<number>([
    ...(reachedStages.get('CONSULTATION_BOOKED') ?? []),
    ...(reachedStages.get('PILOT_DISCUSSION') ?? []),
    ...(reachedStages.get('PROPOSAL_SENT') ?? []),
    ...(reachedStages.get('CONVERTED') ?? []),
    ...allAudits.filter((a) => a.consultRequestedAt !== null).map((a) => a.id),
  ]);

  const everPilotIds = new Set<number>([
    ...(reachedStages.get('PILOT_DISCUSSION') ?? []),
    ...(reachedStages.get('PROPOSAL_SENT') ?? []),
    ...(reachedStages.get('CONVERTED') ?? []),
    ...allAudits.filter((a) => a.pilotRequestedAt !== null).map((a) => a.id),
  ]);

  const everConvertedIds = new Set<number>([...(reachedStages.get('CONVERTED') ?? [])]);

  const qualifiedProspects = everQualifiedIds.size;
  const consultationRequests = everConsultationIds.size;
  const pilotDiscussions = everPilotIds.size;
  const convertedClients = everConvertedIds.size;

  const hotLeadsCount = allAudits.filter((a) => {
    const effective = a.leadPriorityOverride ?? a.leadPriority;
    return effective === 'HOT';
  }).length;

  const pct = (num: number, den: number): number | null =>
    den > 0 ? Math.round((num / den) * 1000) / 10 : null;

  const funnelRaw = [
    { key: 'SUBMISSIONS', label: 'Audit Submissions', count: totalSubmissions },
    { key: 'QUALIFIED', label: 'Qualified Leads', count: qualifiedProspects },
    { key: 'CONSULTATIONS', label: 'Consultations', count: consultationRequests },
    { key: 'PILOTS', label: 'Pilots', count: pilotDiscussions },
    { key: 'CONVERTED', label: 'Paid Clients', count: convertedClients },
  ];

  const funnel = funnelRaw.map((step, idx) => {
    const prevCount = idx === 0 ? step.count : (funnelRaw[idx - 1]?.count ?? 0);
    return {
      ...step,
      stepConversionPct: idx === 0 ? (totalSubmissions > 0 ? 100 : null) : pct(step.count, prevCount),
      overallConversionPct: pct(step.count, totalSubmissions),
    };
  });

  const hotWithoutFollowUp = allAudits
    .filter((a) => {
      const effective = a.leadPriorityOverride ?? a.leadPriority;
      return (
        effective === 'HOT' &&
        !a.followUpAt &&
        a.pipelineStage !== 'CONVERTED' &&
        a.pipelineStage !== 'NOT_INTERESTED'
      );
    })
    .slice(0, 8);

  const failedOrQueued = allAudits
    .filter((a) =>
      a.auditStatus === 'FAILED' ||
      a.auditStatus === 'QUEUED' ||
      a.auditStatus === 'WAITING_FOR_QUOTA' ||
      a.auditStatus === 'PENDING_REVIEW',
    )
    .slice(0, 8);

  const overdueFollowUps = allAudits
    .filter(
      (a) =>
        a.followUpAt !== null &&
        a.followUpAt < nowIso &&
        a.pipelineStage !== 'CONVERTED' &&
        a.pipelineStage !== 'NOT_INTERESTED',
    )
    .slice(0, 8);

  return {
    kpis: {
      totalSubmissions,
      reportsGenerated,
      qualifiedProspects,
      consultationRequests,
      pilotDiscussions,
      convertedClients,
      hotLeadsCount,
    },
    funnel,
    recentAudits: allAudits.slice(0, 8),
    needsAttention: {
      hotWithoutFollowUp,
      failedOrQueued,
      overdueFollowUps,
    },
  };
}

export async function deleteAuditById(id: number): Promise<boolean> {
  const db = getDb();
  await db.run(sql`PRAGMA foreign_keys = ON;`).catch(() => {});
  return db.transaction(async (tx) => {
    const convs = await tx
      .select({ id: assistantConversations.id })
      .from(assistantConversations)
      .where(eq(assistantConversations.auditId, id));
    if (convs.length > 0) {
      await tx.delete(assistantMessages).where(inArray(assistantMessages.conversationId, convs.map((c) => c.id)));
    }
    await tx.delete(assistantConversations).where(eq(assistantConversations.auditId, id));
    await tx.delete(assistantAnalytics).where(eq(assistantAnalytics.auditId, id));
    await tx.delete(auditRoi).where(eq(auditRoi.auditId, id));
    const res = await tx.delete(audits).where(eq(audits.id, id));
    return Number(res.rowsAffected ?? 0) > 0;
  });
}

export async function deleteAuditByToken(token: string): Promise<boolean> {
  const db = getDb();
  await db.run(sql`PRAGMA foreign_keys = ON;`).catch(() => {});
  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: audits.id })
      .from(audits)
      .where(eq(audits.publicToken, token))
      .limit(1);
    const id = existing[0]?.id;
    if (!id) return false;
    const convs = await tx
      .select({ id: assistantConversations.id })
      .from(assistantConversations)
      .where(eq(assistantConversations.auditId, id));
    if (convs.length > 0) {
      await tx.delete(assistantMessages).where(inArray(assistantMessages.conversationId, convs.map((c) => c.id)));
    }
    await tx.delete(assistantConversations).where(eq(assistantConversations.auditId, id));
    await tx.delete(assistantAnalytics).where(eq(assistantAnalytics.auditId, id));
    await tx.delete(auditRoi).where(eq(auditRoi.auditId, id));
    const res = await tx.delete(audits).where(eq(audits.id, id));
    return Number(res.rowsAffected ?? 0) > 0;
  });
}

export async function purgeExpiredAudits(cutoffIso: string): Promise<number> {
  const db = getDb();
  await db.run(sql`PRAGMA foreign_keys = ON;`).catch(() => {});
  return db.transaction(async (tx) => {
    const expired = await tx
      .select({ id: audits.id })
      .from(audits)
      .where(lt(audits.createdAt, cutoffIso));
    const ids = expired.map((r) => r.id);
    if (ids.length === 0) return 0;
    const convs = await tx
      .select({ id: assistantConversations.id })
      .from(assistantConversations)
      .where(inArray(assistantConversations.auditId, ids));
    if (convs.length > 0) {
      await tx.delete(assistantMessages).where(inArray(assistantMessages.conversationId, convs.map((c) => c.id)));
    }
    await tx.delete(assistantConversations).where(inArray(assistantConversations.auditId, ids));
    await tx.delete(assistantAnalytics).where(inArray(assistantAnalytics.auditId, ids));
    await tx.delete(auditRoi).where(inArray(auditRoi.auditId, ids));
    const res = await tx.delete(audits).where(inArray(audits.id, ids));
    return Number(res.rowsAffected ?? 0);
  });
}

export async function acquireProcessingLock(
  auditId: number,
  maxConcurrent = 2,
  ttlSeconds = 300,
): Promise<boolean> {
  const db = getDb();
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const expiresIso = new Date(nowMs + ttlSeconds * 1000).toISOString();

  return db.transaction(async (tx) => {
    // Clear expired locks first
    await tx.delete(processingLocks).where(lt(processingLocks.expiresAt, nowIso));

    const existingOwn = await tx
      .select()
      .from(processingLocks)
      .where(eq(processingLocks.auditId, auditId))
      .limit(1);
    if (existingOwn.length > 0) {
      // Refresh own lock
      await tx
        .update(processingLocks)
        .set({ acquiredAt: nowIso, expiresAt: expiresIso })
        .where(eq(processingLocks.auditId, auditId));
      return true;
    }

    const active = await tx.select({ count: sql<number>`count(*)` }).from(processingLocks);
    const activeCount = Number(active[0]?.count ?? 0);
    if (activeCount >= maxConcurrent) {
      return false;
    }

    await tx.insert(processingLocks).values({
      auditId,
      acquiredAt: nowIso,
      expiresAt: expiresIso,
    });
    return true;
  });
}

export async function hasActiveProcessingLock(auditId: number): Promise<boolean> {
  const db = getDb();
  const nowIso = new Date().toISOString();
  const rows = await db
    .select({ auditId: processingLocks.auditId, expiresAt: processingLocks.expiresAt })
    .from(processingLocks)
    .where(eq(processingLocks.auditId, auditId))
    .limit(1);
  const row = rows[0];
  return Boolean(row && row.expiresAt >= nowIso);
}

export async function releaseProcessingLock(auditId: number): Promise<void> {
  const db = getDb();
  await db.delete(processingLocks).where(eq(processingLocks.auditId, auditId));
}

export async function findResumableAudits(staleBeforeIso: string, limit = 10): Promise<AuditRow[]> {
  const db = getDb();
  const inProgressStatuses: AuditStatus[] = [
    'VALIDATING',
    'CHECKING_ACCESS',
    'DISCOVERING_PAGES',
    'EXTRACTING',
    'ANALYSING',
    'GENERATING',
    'SAVING',
  ];

  return db
    .select()
    .from(audits)
    .where(
      or(
        inArray(audits.auditStatus, ['QUEUED', 'WAITING_FOR_QUOTA']),
        and(
          inArray(audits.auditStatus, inProgressStatuses),
          or(isNull(audits.heartbeatAt), lt(audits.heartbeatAt, staleBeforeIso)),
        ),
      ),
    )
    .orderBy(asc(audits.createdAt))
    .limit(limit);
}
