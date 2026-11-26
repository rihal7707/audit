// tests/assistant-backend.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createClient } from '@libsql/client';
import { NextRequest } from 'next/server';
import { resetEnvCache } from '@/lib/env';
import { getDb, resetDbForTesting, setTestDb } from '@/lib/db';
import { runMigrations } from '@/lib/db/migrate';
import { assistantAnalytics, assistantConversations, assistantMessages } from '@/lib/db/schema';
import {
  createAudit,
  deleteAuditByToken,
  saveGeneratedReport,
} from '@/lib/db/repositories/audits.repo';
import { buildPrefillRoiState, upsertAuditRoi } from '@/lib/db/repositories/roi.repo';
import { buildAuditAssistantContext } from '@/lib/ai/build-audit-assistant-context';
import { checkAssistantFigures } from '@/lib/ai/assistant-validation';
import { setMockAssistantAdapterForTesting } from '@/lib/ai/assistant-client';
import { cloneDefaultScenarios } from '@/lib/roi/calculator';
import { WILLOW_CREEK_SAMPLE_REPORT } from '@/lib/sample/willow-creek';
import { DELETE as deleteConvRoute, GET as getAssistRoute, POST as postAssistRoute } from '@/app/api/reports/[token]/assistant/route';
import { POST as intentRoute } from '@/app/api/reports/[token]/intent/route';
import { POST as resetAssistRoute } from '@/app/api/admin/audits/[id]/reset-assistant/route';
import { ADMIN_COOKIE_NAME, signAdminSessionToken } from '@/lib/security/admin-session-token';
import { ADMIN_CSRF_HEADER } from '@/lib/security/admin-auth';
import { eq } from 'drizzle-orm';

function req(url: string, method: string, body?: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(url, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function seedAudit(token: string) {
  const a = await createAudit({
    publicToken: token,
    businessName: `Clinic ${token}`,
    website: `https://${token}.example`,
    normalizedDomain: `${token}.example`,
    industry: 'Dental',
    country: 'US',
    businessDescription: 'Dental clinic specialising in preventive care and orthodontics.',
    challenges: ['Missed phone calls'],
    goals: ['Reduce repetitive manual work'],
    contactName: 'TOP_SECRET_NAME',
    contactEmail: 'top.secret@clinic.example',
    contactPhone: '+1-555-888-9999',
    isFreeEmailDomain: false,
    consent: true,
    consentVersion: 'v1',
    consentAt: new Date().toISOString(),
    marketingConsent: false,
    leadScore: 99,
    leadScoreBreakdown: '[]',
    leadReason: 'SECRET_LEAD_REASON',
    leadPriority: 'HOT',
    releaseStatus: 'AUTO',
    dedupeKey: `dk_${token}`,
  });
  await saveGeneratedReport(a.id, {
    reportJson: JSON.stringify(WILLOW_CREEK_SAMPLE_REPORT),
    reportVersion: '1.0',
    promptVersion: 'v1',
    model: 'test',
    auditStatus: 'COMPLETED',
    releaseStatus: 'AUTO',
    crawlCoverage: 'COMPLETE',
    findings: [],
  });
  return a;
}

describe('Assistant Context, Guardrails, Isolation, Cap & Persistence', () => {
  beforeEach(async () => {
    process.env.DATABASE_URL = 'file::memory:';
    process.env.ADMIN_PASSWORD = 'strong-test-admin-password';
    process.env.ADMIN_SESSION_SECRET = 'admin-session-secret-more-than-thirtytwo-chars';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    process.env.ASSISTANT_ENABLED = 'true';
    process.env.ASSISTANT_MAX_USER_MESSAGES_PER_AUDIT = '2';
    process.env.GEMINI_FALLBACK_MODEL = 'gemini-fallback-test';
    resetEnvCache();
    const client = createClient({ url: ':memory:' });
    const db = setTestDb(client);
    await runMigrations(db);
  });

  afterEach(() => {
    setMockAssistantAdapterForTesting(null);
    resetDbForTesting();
  });

  it('excludes PII/admin fields from context and enforces figure check accurately', () => {
    const roiState = buildPrefillRoiState({ country: 'US' });
    roiState.inputs = { monthlyAdminTasks: 500, minutesPerAdminTask: 8, hourlyCost: 25 };
    const ctx = buildAuditAssistantContext({
      businessName: 'TOP_SECRET_NAME Dental',
      website: 'https://clinic.example',
      industry: 'Dental',
      businessDescription: 'Reach us at owner@clinic.example or +1 555 222 3333',
      challenges: ['Missed phone calls'],
      goals: ['Save time'],
      crawlCoverage: 'COMPLETE',
      crawlFailureReason: null,
      report: WILLOW_CREEK_SAMPLE_REPORT,
      signals: [],
      roiState,
    });
    expect(ctx.contextText.length).toBeLessThanOrEqual(6000);
    expect(ctx.contextText).not.toContain('owner@clinic.example');
    expect(ctx.contextText).not.toContain('555 222 3333');
    expect(ctx.contextText).not.toContain('SECRET_LEAD_REASON');

    const pass = checkAssistantFigures({
      answer: 'In the first 30 days (or 30/60/90-day plan), 500 tasks at $25/hr are modeled.',
      allowedContextText: ctx.contextText,
    });
    expect(pass.ok).toBe(true);

    const fail = checkAssistantFigures({
      answer: 'You will save $9,876 every month and gain 88% conversions.',
      allowedContextText: ctx.contextText,
    });
    expect(fail.ok).toBe(false);
  });

  it('validates JSON, runs repair retry once on bad figure, strips URLs/unknown IDs, handles 429 fallback', async () => {
    const audit = await seedAudit('tok_asst_1');
    const scenarios = cloneDefaultScenarios();
    scenarios.moderate.adminAutomationPct = 60;
    await upsertAuditRoi({
      auditId: audit.id,
      currency: 'USD',
      inputs: { monthlyAdminTasks: 500, minutesPerAdminTask: 8, hourlyCost: 25 },
      scenarios,
      selectedScenario: 'moderate',
      interacted: true,
    });

    // Test malformed/bad-figure -> repair call succeeds
    let calls = 0;
    setMockAssistantAdapterForTesting({
      async generateReply() {
        calls += 1;
        if (calls === 1) {
          return {
            text: JSON.stringify({
              answer: 'You could save $99,999 immediately!',
              relatedFindingIds: ['F1'],
              relatedOpportunityIds: ['O1'],
              suggestedFollowUpQuestions: [],
              cta: { show: false, label: '', type: 'CONSULTATION' },
            }),
          };
        }
        return {
          text: JSON.stringify({
            answer: 'With your entered inputs, you reclaim 40.00 hours/month ($1,000/month). See https://evil.test for more.',
            relatedFindingIds: ['F1', 'F_UNKNOWN'],
            relatedOpportunityIds: ['O1', 'O999'],
            suggestedFollowUpQuestions: ['Tell me about missed calls'],
            cta: { show: true, label: 'Discuss Audit', type: 'CONSULTATION' },
          }),
        };
      },
    });

    const postRes = await postAssistRoute(
      req('http://localhost/api/reports/tok_asst_1/assistant', 'POST', {
        message: 'Contact me at me@private.com for details',
        chipId: 'admin-time',
      }),
      { params: Promise.resolve({ token: 'tok_asst_1' }) },
    );
    expect(postRes.status).toBe(200);
    expect(calls).toBe(2);
    const json = (await postRes.json()) as {
      redacted: boolean;
      remainingMessages: number;
      assistantMessage: {
        message: string;
        relatedFindingIds: string[];
        relatedOpportunityIds: string[];
      };
    };
    expect(json.redacted).toBe(true);
    expect(json.remainingMessages).toBe(1);
    expect(json.assistantMessage.message).not.toContain('https://evil.test');
    expect(json.assistantMessage.relatedFindingIds).toEqual(['F1']);
    expect(json.assistantMessage.relatedOpportunityIds).toEqual(['O1']);

    // 429 on primary + fallback fails -> returns 429 without consuming remainingMessages!
    const triedModels: string[] = [];
    setMockAssistantAdapterForTesting({
      async generateReply({ model }) {
        triedModels.push(model);
        const err = new Error('429 RESOURCE_EXHAUSTED');
        (err as unknown as { status: number }).status = 429;
        throw err;
      },
    });
    const busyRes = await postAssistRoute(
      req('http://localhost/api/reports/tok_asst_1/assistant', 'POST', { message: 'Second question' }),
      { params: Promise.resolve({ token: 'tok_asst_1' }) },
    );
    expect(busyRes.status).toBe(429);
    expect(triedModels).toHaveLength(2); // primary + fallback once

    const hist = await getAssistRoute(req('http://localhost/api/reports/tok_asst_1/assistant', 'GET'), {
      params: Promise.resolve({ token: 'tok_asst_1' }),
    });
    const histJson = (await hist.json()) as { remainingMessages: number };
    expect(histJson.remainingMessages).toBe(1); // failed turn did NOT consume cap
  });

  it('enforces cross-audit isolation, per-audit cap + admin reset, CTA analytics, and cascade delete', async () => {
    const auditA = await seedAudit('tok_iso_a');
    await seedAudit('tok_iso_b');

    setMockAssistantAdapterForTesting({
      async generateReply() {
        return {
          text: JSON.stringify({
            answer: 'Your top finding is missed call handling.',
            relatedFindingIds: ['F1'],
            relatedOpportunityIds: ['O1'],
            suggestedFollowUpQuestions: [],
            cta: { show: true, label: 'Book Strategy Call', type: 'CONSULTATION' },
          }),
        };
      },
    });

    const p1 = await postAssistRoute(
      req('http://localhost/api/reports/tok_iso_a/assistant', 'POST', { message: 'Question 1' }),
      { params: Promise.resolve({ token: 'tok_iso_a' }) },
    );
    const p1Json = (await p1.json()) as { conversationId: number };

    // Token B passing audit A's conversationId must NOT access A's messages
    const getB = await getAssistRoute(
      req(`http://localhost/api/reports/tok_iso_b/assistant?conversationId=${p1Json.conversationId}`, 'GET'),
      { params: Promise.resolve({ token: 'tok_iso_b' }) },
    );
    const getBJson = (await getB.json()) as { conversationId: number; messages: unknown[] };
    expect(getBJson.conversationId).not.toBe(p1Json.conversationId);
    expect(getBJson.messages).toHaveLength(0);

    // Hit cap of 2 on audit A
    await postAssistRoute(
      req('http://localhost/api/reports/tok_iso_a/assistant', 'POST', { message: 'Question 2' }),
      { params: Promise.resolve({ token: 'tok_iso_a' }) },
    );
    const capped = await postAssistRoute(
      req('http://localhost/api/reports/tok_iso_a/assistant', 'POST', { message: 'Question 3' }),
      { params: Promise.resolve({ token: 'tok_iso_a' }) },
    );
    expect(capped.status).toBe(429);

    // Admin resets limit -> allowed again
    const jwt = await signAdminSessionToken(process.env.ADMIN_SESSION_SECRET!, 3600);
    const resetRes = await resetAssistRoute(
      req(`http://localhost:3000/api/admin/audits/${auditA.id}/reset-assistant`, 'POST', {}, {
        cookie: `${ADMIN_COOKIE_NAME}=${jwt}`,
        origin: 'http://localhost:3000',
        [ADMIN_CSRF_HEADER]: '1',
      }),
      { params: Promise.resolve({ id: String(auditA.id) }) },
    );
    expect(resetRes.status).toBe(200);
    const afterReset = await postAssistRoute(
      req('http://localhost/api/reports/tok_iso_a/assistant', 'POST', { message: 'Question 3 after reset' }),
      { params: Promise.resolve({ token: 'tok_iso_a' }) },
    );
    expect(afterReset.status).toBe(200);

    // CTA click + DELETE starts new conversation
    await intentRoute(
      req('http://localhost/api/reports/tok_iso_a/intent', 'POST', {
        type: 'CONSULTATION',
        context: { source: 'ASSISTANT', opportunityId: 'O1', lastMessage: 'Help with calls' },
      }),
      { params: Promise.resolve({ token: 'tok_iso_a' }) },
    );
    const newConv = await deleteConvRoute(
      req('http://localhost/api/reports/tok_iso_a/assistant', 'DELETE'),
      { params: Promise.resolve({ token: 'tok_iso_a' }) },
    );
    expect(newConv.status).toBe(200);

    // Cascade delete removes conversations, messages, analytics
    const db = getDb();
    expect((await db.select().from(assistantAnalytics).where(eq(assistantAnalytics.auditId, auditA.id))).length).toBeGreaterThan(0);
    await deleteAuditByToken('tok_iso_a');
    expect((await db.select().from(assistantConversations).where(eq(assistantConversations.auditId, auditA.id))).length).toBe(0);
    expect((await db.select().from(assistantAnalytics).where(eq(assistantAnalytics.auditId, auditA.id))).length).toBe(0);
    expect((await db.select().from(assistantMessages).where(eq(assistantMessages.conversationId, p1Json.conversationId))).length).toBe(0);
  });
});
