import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const AUDIT_STATUSES = [
  'QUEUED',
  'VALIDATING',
  'CHECKING_ACCESS',
  'DISCOVERING_PAGES',
  'EXTRACTING',
  'ANALYSING',
  'GENERATING',
  'SAVING',
  'WAITING_FOR_QUOTA',
  'PENDING_REVIEW',
  'COMPLETED',
  'COMPLETED_LIMITED',
  'FAILED',
] as const;

export type AuditStatus = (typeof AUDIT_STATUSES)[number];

export const PIPELINE_STAGES = [
  'NEW',
  'ANALYSIS_IN_PROGRESS',
  'REPORT_GENERATED',
  'QUALIFIED',
  'CONSULTATION_BOOKED',
  'PILOT_DISCUSSION',
  'PROPOSAL_SENT',
  'CONVERTED',
  'NOT_INTERESTED',
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const LEAD_PRIORITIES = ['HOT', 'WARM', 'NURTURE'] as const;
export type LeadPriority = (typeof LEAD_PRIORITIES)[number];

export const CRAWL_COVERAGES = ['COMPLETE', 'PARTIAL', 'LIMITED', 'NONE'] as const;
export type CrawlCoverage = (typeof CRAWL_COVERAGES)[number];

export const RELEASE_STATUSES = ['AUTO', 'PENDING_REVIEW', 'RELEASED', 'REVOKED'] as const;
export type ReleaseStatus = (typeof RELEASE_STATUSES)[number];

export const audits = sqliteTable(
  'audits',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    publicToken: text('public_token').notNull(),
    businessName: text('business_name').notNull(),
    website: text('website').notNull(),
    normalizedDomain: text('normalized_domain').notNull(),
    industry: text('industry').notNull(),
    country: text('country').notNull(),
    location: text('location'),
    businessSize: text('business_size'),
    businessDescription: text('business_description').notNull(),
    challenges: text('challenges').notNull(), // JSON string[]
    goals: text('goals').notNull(), // JSON string[]
    toolsUsed: text('tools_used'),
    enquiryVolume: text('enquiry_volume'),
    phoneVolume: text('phone_volume'),
    teamSize: text('team_size'),
    manualProcesses: text('manual_processes'),
    timeframe: text('timeframe'),
    contactName: text('contact_name').notNull(),
    contactEmail: text('contact_email').notNull(),
    contactPhone: text('contact_phone'),
    contactRole: text('contact_role'),
    isFreeEmailDomain: integer('is_free_email_domain', { mode: 'boolean' }).notNull().default(false),
    consent: integer('consent', { mode: 'boolean' }).notNull(),
    consentVersion: text('consent_version').notNull(),
    consentAt: text('consent_at').notNull(),
    marketingConsent: integer('marketing_consent', { mode: 'boolean' }).notNull().default(false),
    auditStatus: text('audit_status').$type<AuditStatus>().notNull().default('QUEUED'),
    currentStageIndex: integer('current_stage_index').notNull().default(0),
    currentStageLabel: text('current_stage_label').notNull().default('Queued'),
    heartbeatAt: text('heartbeat_at'),
    retryCount: integer('retry_count').notNull().default(0),
    lastError: text('last_error'),
    crawlCoverage: text('crawl_coverage').$type<CrawlCoverage>(),
    crawlFailureReason: text('crawl_failure_reason'),
    leadScore: integer('lead_score').notNull().default(0),
    leadScoreBreakdown: text('lead_score_breakdown'), // JSON
    leadReason: text('lead_reason'),
    leadPriority: text('lead_priority').$type<LeadPriority>().notNull().default('NURTURE'),
    leadPriorityOverride: text('lead_priority_override').$type<LeadPriority>(),
    leadPriorityOverrideReason: text('lead_priority_override_reason'),
    pipelineStage: text('pipeline_stage').$type<PipelineStage>().notNull().default('NEW'),
    stageEnteredAt: text('stage_entered_at').notNull(),
    followUpAt: text('follow_up_at'),
    consultRequestedAt: text('consult_requested_at'),
    pilotRequestedAt: text('pilot_requested_at'),
    bookingClickedAt: text('booking_clicked_at'),
    releaseStatus: text('release_status').$type<ReleaseStatus>().notNull().default('AUTO'),
    reportJson: text('report_json'),
    reportVersion: text('report_version'),
    promptVersion: text('prompt_version'),
    model: text('model'),
    supplementText: text('supplement_text'),
    supplementCount: integer('supplement_count').notNull().default(0),
    dedupeKey: text('dedupe_key').notNull(),
    ipHash: text('ip_hash'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('audits_public_token_idx').on(table.publicToken),
    index('audits_pipeline_stage_idx').on(table.pipelineStage),
    index('audits_status_idx').on(table.auditStatus),
    index('audits_created_at_idx').on(table.createdAt),
    index('audits_dedupe_key_idx').on(table.dedupeKey),
  ],
);

export const auditPages = sqliteTable(
  'audit_pages',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    auditId: integer('audit_id')
      .notNull()
      .references(() => audits.id, { onDelete: 'cascade' }),
    pageLabel: text('page_label').notNull(), // P1..P5
    url: text('url').notNull(),
    pageTitle: text('page_title'),
    httpStatus: integer('http_status'),
    extractedText: text('extracted_text'),
    extractedMetadata: text('extracted_metadata'), // JSON
    contentHash: text('content_hash'),
    extractionStatus: text('extraction_status').notNull(), // OK | FAILED | SKIPPED | JS_SHELL
    fetchedAt: text('fetched_at').notNull(),
  },
  (table) => [index('audit_pages_audit_id_idx').on(table.auditId)],
);

export const auditFindings = sqliteTable(
  'audit_findings',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    auditId: integer('audit_id')
      .notNull()
      .references(() => audits.id, { onDelete: 'cascade' }),
    category: text('category').notNull(),
    finding: text('finding').notNull(),
    priority: text('priority').notNull(),
    evidenceType: text('evidence_type').notNull(),
    confidence: text('confidence').notNull(),
    evidence: text('evidence').notNull(),
    recommendation: text('recommendation').notNull(),
  },
  (table) => [index('audit_findings_audit_id_idx').on(table.auditId)],
);

export const auditNotes = sqliteTable(
  'audit_notes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    auditId: integer('audit_id')
      .notNull()
      .references(() => audits.id, { onDelete: 'cascade' }),
    note: text('note').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('audit_notes_audit_id_idx').on(table.auditId)],
);

export const auditEvents = sqliteTable(
  'audit_events',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    auditId: integer('audit_id')
      .notNull()
      .references(() => audits.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    message: text('message').notNull(),
    metadata: text('metadata'), // JSON
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('audit_events_audit_created_idx').on(table.auditId, table.createdAt)],
);

export const auditStageHistory = sqliteTable(
  'audit_stage_history',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    auditId: integer('audit_id')
      .notNull()
      .references(() => audits.id, { onDelete: 'cascade' }),
    fromStage: text('from_stage').$type<PipelineStage | null>(),
    toStage: text('to_stage').$type<PipelineStage>().notNull(),
    reason: text('reason'),
    changedAt: text('changed_at').notNull(),
  },
  (table) => [index('audit_stage_history_audit_id_idx').on(table.auditId)],
);

export const rateLimits = sqliteTable(
  'rate_limits',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    key: text('key').notNull(),
    windowStart: integer('window_start').notNull(),
    count: integer('count').notNull().default(0),
  },
  (table) => [uniqueIndex('rate_limits_key_window_idx').on(table.key, table.windowStart)],
);

export const crawlCache = sqliteTable(
  'crawl_cache',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    originHash: text('origin_hash').notNull(),
    payloadJson: text('payload_json').notNull(),
    fetchedAt: text('fetched_at').notNull(),
    expiresAt: text('expires_at').notNull(),
  },
  (table) => [uniqueIndex('crawl_cache_origin_hash_idx').on(table.originHash)],
);

export const processingLocks = sqliteTable('processing_locks', {
  auditId: integer('audit_id')
    .primaryKey()
    .references(() => audits.id, { onDelete: 'cascade' }),
  acquiredAt: text('acquired_at').notNull(),
  expiresAt: text('expires_at').notNull(),
});

export const auditRoi = sqliteTable(
  'audit_roi',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    auditId: integer('audit_id')
      .notNull()
      .references(() => audits.id, { onDelete: 'cascade' }),
    currency: text('currency').notNull().default('USD'),
    inputsJson: text('inputs_json').notNull(),
    scenariosJson: text('scenarios_json').notNull(),
    selectedScenario: text('selected_scenario').notNull().default('moderate'),
    outputsJson: text('outputs_json').notNull(),
    calcVersion: text('calc_version').notNull(),
    interacted: integer('interacted', { mode: 'boolean' }).notNull().default(false),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [uniqueIndex('audit_roi_audit_id_idx').on(table.auditId)],
);

