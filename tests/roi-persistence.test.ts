// tests/roi-persistence.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createClient } from '@libsql/client';
import { NextRequest } from 'next/server';
import { resetEnvCache } from '@/lib/env';
import { setTestDb, resetDbForTesting, getDb } from '@/lib/db';
import { runMigrations } from '@/lib/db/migrate';
import {
  createAudit,
  deleteAuditById,
  deleteAuditByToken,
  listAuditEvents,
  purgeExpiredAudits,
  saveGeneratedReport,
} from '@/lib/db/repositories/audits.repo';
import { auditRoi } from '@/lib/db/schema';
import { cloneDefaultScenarios } from '@/lib/roi/calculator';
import { mapVolumeRangeMidpoint } from '@/lib/roi/prefill';
import { WILLOW_CREEK_SAMPLE_REPORT } from '@/lib/sample/willow-creek';
import { GET as getRoiRoute, PUT as putRoiRoute } from '@/app/api/reports/[token]/roi/route';
import { POST as intentRoute } from '@/app/api/reports/[token]/intent/route';
import { eq } from 'drizzle-orm';

function req(url: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function seedReleasedAudit(token: string, country = 'IN', enquiryVolume = '100–300 / month', phoneVolume = 'Not sure') {
  const audit = await createAudit({
    publicToken: token,
    businessName: `Biz ${token}`,
    website: `https://${token}.example`,
    normalizedDomain: `${token}.example`,
    industry: 'Dental',
    country,
    businessDescription: 'Dental practice offering appointments.',
    challenges: ['Missed phone calls'],
    goals: ['Reduce repetitive manual work'],
    enquiryVolume,
    phoneVolume,
    contactName: 'Secret Name',
    contactEmail: 'secret@example.com',
    isFreeEmailDomain: false,
    consent: true,
    consentVersion: 'v1',
    consentAt: new Date().toISOString(),
    marketingConsent: false,
    leadScore: 60,
    leadScoreBreakdown: '[]',
    leadReason: 'Warm',
    leadPriority: 'WARM',
    releaseStatus: 'AUTO',
    dedupeKey: `dk_${token}`,
  });

  await saveGeneratedReport(audit.id, {
    reportJson: JSON.stringify(WILLOW_CREEK_SAMPLE_REPORT),
    reportVersion: '1.0',
    promptVersion: 'v1',
    model: 'test',
    auditStatus: 'COMPLETED',
    releaseStatus: 'AUTO',
    crawlCoverage: 'COMPLETE',
    findings: [],
  });
  return audit;
}

describe('ROI Persistence, Prefill, Isolation & Cascade Deletion', () => {
  beforeEach(async () => {
    process.env.DATABASE_URL = 'file::memory:';
    resetEnvCache();
    const client = createClient({ url: ':memory:' });
    const db = setTestDb(client);
    await runMigrations(db);
  });

  afterEach(() => {
    resetDbForTesting();
  });

  it('maps volume range midpoints and leaves Not sure empty', () => {
    expect(mapVolumeRangeMidpoint('Under 25 / month')).toBe(12);
    expect(mapVolumeRangeMidpoint('25–100 / month')).toBe(63);
    expect(mapVolumeRangeMidpoint('100–300 / month')).toBe(200);
    expect(mapVolumeRangeMidpoint('300–1,000 / month')).toBe(650);
    expect(mapVolumeRangeMidpoint('1,000+ / month')).toBe(1000);
    expect(mapVolumeRangeMidpoint('Not sure')).toBeUndefined();
    expect(mapVolumeRangeMidpoint('')).toBeUndefined();
  });

  it('prefills GET, recomputes server-side on PUT, emits ROI_USED once, and isolates audits', async () => {
    const auditA = await seedReleasedAudit('tok_roi_a', 'IN', '100–300 / month', 'Not sure');
    const auditB = await seedReleasedAudit('tok_roi_b', 'GB', '25–100 / month', 'Under 25 / month');

    const getA = await getRoiRoute(req('http://localhost/api/reports/tok_roi_a/roi', 'GET'), {
      params: Promise.resolve({ token: 'tok_roi_a' }),
    });
    expect(getA.status).toBe(200);
    const preA = (await getA.json()) as {
      currency: string;
      inputs: Record<string, unknown>;
      interacted: boolean;
    };
    expect(preA.currency).toBe('INR');
    expect(preA.inputs.monthlyEnquiries).toBe(200);
    expect(preA.inputs.monthlyCalls).toBeUndefined();
    expect(preA.inputs.hourlyCost).toBeUndefined();
    expect(preA.interacted).toBe(false);

    // Save ROI for audit A
    const scenarios = cloneDefaultScenarios();
    scenarios.moderate.adminAutomationPct = 60;
    const putA = await putRoiRoute(
      req('http://localhost/api/reports/tok_roi_a/roi', 'PUT', {
        currency: 'USD',
        selectedScenario: 'moderate',
        inputs: { monthlyAdminTasks: 500, minutesPerAdminTask: 8, hourlyCost: 25 },
        scenarios,
      }),
      { params: Promise.resolve({ token: 'tok_roi_a' }) },
    );
    expect(putA.status).toBe(200);
    const savedA = (await putA.json()) as {
      interacted: boolean;
      outputs: { moderate: { adminHoursReclaimedMonthly: number; capacityValueMonthly: number } };
    };
    expect(savedA.interacted).toBe(true);
    expect(savedA.outputs.moderate.adminHoursReclaimedMonthly).toBeCloseTo(40, 2);
    expect(savedA.outputs.moderate.capacityValueMonthly).toBeCloseTo(1000, 1);

    // Second save must not duplicate ROI_USED
    await putRoiRoute(
      req('http://localhost/api/reports/tok_roi_a/roi', 'PUT', {
        currency: 'USD',
        selectedScenario: 'conservative',
        inputs: { monthlyAdminTasks: 400, minutesPerAdminTask: 8, hourlyCost: 25 },
        scenarios,
      }),
      { params: Promise.resolve({ token: 'tok_roi_a' }) },
    );
    const eventsA = await listAuditEvents(auditA.id);
    expect(eventsA.filter((e) => e.eventType === 'ROI_USED')).toHaveLength(1);

    // Audit B remains untouched and isolated with GBP
    const getB = await getRoiRoute(req('http://localhost/api/reports/tok_roi_b/roi', 'GET'), {
      params: Promise.resolve({ token: 'tok_roi_b' }),
    });
    const preB = (await getB.json()) as { currency: string; interacted: boolean };
    expect(preB.currency).toBe('GBP');
    expect(preB.interacted).toBe(false);
    expect(auditB.id).not.toBe(auditA.id);

    // Record ROI CTA click via intent endpoint
    const ctaRes = await intentRoute(
      req('http://localhost/api/reports/tok_roi_a/intent', 'POST', {
        type: 'CONSULTATION',
        preferredContactMethod: 'email',
        context: { source: 'ROI', scenario: 'moderate' },
      }),
      { params: Promise.resolve({ token: 'tok_roi_a' }) },
    );
    expect(ctaRes.status).toBe(200);
    const eventsAfterCta = await listAuditEvents(auditA.id);
    expect(eventsAfterCta.some((e) => e.eventType === 'ROI_CTA_CLICK')).toBe(true);
  });

  it('cascades AuditRoi deletion on self-service delete, admin delete, and retention purge', async () => {
    const scenarios = cloneDefaultScenarios();
    const saveFor = async (tok: string) => {
      const a = await seedReleasedAudit(tok);
      await putRoiRoute(
        req(`http://localhost/api/reports/${tok}/roi`, 'PUT', {
          currency: 'USD',
          selectedScenario: 'moderate',
          inputs: { monthlyAdminTasks: 100, minutesPerAdminTask: 6, hourlyCost: 20 },
          scenarios,
        }),
        { params: Promise.resolve({ token: tok }) },
      );
      return a;
    };

    const a1 = await saveFor('tok_del_1');
    const a2 = await saveFor('tok_del_2');
    const a3 = await saveFor('tok_del_3');

    const db = getDb();
    expect((await db.select().from(auditRoi)).length).toBe(3);

    await deleteAuditByToken('tok_del_1');
    expect((await db.select().from(auditRoi).where(eq(auditRoi.auditId, a1.id))).length).toBe(0);

    await deleteAuditById(a2.id);
    expect((await db.select().from(auditRoi).where(eq(auditRoi.auditId, a2.id))).length).toBe(0);

    await purgeExpiredAudits(new Date(Date.now() + 60_000).toISOString());
    expect((await db.select().from(auditRoi).where(eq(auditRoi.auditId, a3.id))).length).toBe(0);
  });
});
