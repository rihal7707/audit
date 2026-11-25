import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import { createClient } from '@libsql/client';
import { qualifyLead } from '@/lib/leads/qualify';
import { resetEnvCache } from '@/lib/env';
import { setTestDb, resetDbForTesting } from '@/lib/db';
import { runMigrations } from '@/lib/db/migrate';
import {
  createAudit,
  findAuditById,
  listAuditEvents,
  listAuditFindings,
  listAuditPages,
} from '@/lib/db/repositories/audits.repo';
import { runAuditPipeline } from '@/lib/pipeline/run-audit';
import { setMockAiAdapterForTesting } from '@/lib/ai/gemini-client';
import { WILLOW_CREEK_SAMPLE_REPORT } from '@/lib/sample/willow-creek';

describe('Lead Qualification Engine', () => {
  it('computes HOT (>= 70), WARM (40-69), and NURTURE (< 40) with detailed breakdown', () => {
    const hot = qualifyLead({
      industry: 'Orthodontics',
      challenges: ['Missed phone calls', 'Slow customer follow-ups', 'Appointment management'],
      goals: ['Automate appointments and bookings'],
      manualProcesses: 'Copy-pasting web leads into calendar spreadsheets',
      contactRole: 'Practice Owner & Principal',
      timeframe: 'As soon as possible',
      consultRequestedAt: '2026-11-25T10:00:00.000Z',
      contactPhone: '+1 555 000 1111',
      crawlCoverage: 'COMPLETE',
      enquiryVolume: '100–300 / month',
      toolsUsed: 'Cliniko + Mailchimp',
    });
    expect(hot.totalScore).toBe(100);
    expect(hot.priority).toBe('HOT');
    expect(hot.breakdown).toHaveLength(6);

    const warm = qualifyLead({
      industry: 'E-commerce',
      challenges: ['Customer support'],
      goals: ['Improve customer experience'],
      manualProcesses: null,
      contactRole: 'Marketing Manager',
      timeframe: 'Within 1–3 months',
      bookingClickedAt: '2026-11-25T10:00:00.000Z',
      crawlCoverage: 'PARTIAL',
      enquiryVolume: 'Not sure',
      toolsUsed: 'Shopify',
    });
    expect(warm.totalScore).toBe(53);
    expect(warm.priority).toBe('WARM');

    const nurture = qualifyLead({
      industry: 'Other',
      challenges: ['Other'],
      goals: ['Scale the business'],
      contactRole: '',
      timeframe: 'Just exploring',
      crawlCoverage: 'NONE',
    });
    expect(nurture.totalScore).toBeLessThan(40);
    expect(nurture.priority).toBe('NURTURE');
  });

  it('recomputes score when customer records booking click or consultation intent', () => {
    const base = qualifyLead({
      industry: 'Dental',
      challenges: ['Managing customer enquiries', 'Missed phone calls'],
      goals: ['Improve enquiry conversion'],
      contactRole: 'Practice Manager',
      timeframe: 'Within 1–3 months',
      crawlCoverage: 'COMPLETE',
    });
    const afterIntent = qualifyLead({
      industry: 'Dental',
      challenges: ['Managing customer enquiries', 'Missed phone calls'],
      goals: ['Improve enquiry conversion'],
      contactRole: 'Practice Manager',
      timeframe: 'Within 1–3 months',
      crawlCoverage: 'COMPLETE',
      consultRequestedAt: new Date().toISOString(),
    });
    expect(afterIntent.totalScore - base.totalScore).toBe(15);
  });
});

describe('Audit Pipeline State Machine & Quota Recovery', () => {
  let server: http.Server;
  let port = 0;
  let fetchCount = 0;

  beforeEach(async () => {
    process.env.DATABASE_URL = 'file::memory:';
    process.env.REPORT_RELEASE_MODE = 'auto';
    process.env.GEMINI_API_KEY = 'test-mock-key-unused';
    resetEnvCache();

    const client = createClient({ url: ':memory:' });
    const db = setTestDb(client);
    await runMigrations(db);

    fetchCount = 0;
    server = http.createServer((req, res) => {
      fetchCount += 1;
      if (req.url === '/robots.txt') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('User-agent: *\nAllow: /\n');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(
        '<html><head><title>Oak Ortho</title></head><body><main><h1>Oak Orthodontics</h1><p>Book Your Free Smile Assessment — Adult Aligners, Teen Braces & Flexible Payment Plans</p><a href="/contact">Contact</a><a href="/services">Services</a></main></body></html>',
      );
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        port = typeof addr === 'object' && addr ? addr.port : 0;
        resolve();
      });
    });
  });

  afterEach(async () => {
    setMockAiAdapterForTesting(null);
    resetDbForTesting();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('runs all 9 stages, persists pages and findings, and handles WAITING_FOR_QUOTA + idempotent resume', async () => {
    const audit = await createAudit({
      publicToken: 'tok_pipeline_test_1',
      businessName: 'Oak Orthodontics',
      website: `http://127.0.0.1:${port}/`,
      normalizedDomain: '127.0.0.1',
      industry: 'Orthodontics',
      country: 'US',
      businessDescription: 'Orthodontic practice providing aligners and braces.',
      challenges: ['Missed phone calls', 'Slow customer follow-ups'],
      goals: ['Automate appointments and bookings'],
      contactName: 'Dr. Sam Oak',
      contactEmail: 'sam@oakortho.example',
      isFreeEmailDomain: false,
      consent: true,
      consentVersion: '2026-11-v1',
      consentAt: new Date().toISOString(),
      marketingConsent: false,
      leadScore: 50,
      leadScoreBreakdown: '[]',
      leadReason: 'Initial',
      leadPriority: 'WARM',
      releaseStatus: 'AUTO',
      dedupeKey: 'dedupe1',
      ipHash: 'iphash1',
    });

    // First run hits 429 quota error after crawling
    setMockAiAdapterForTesting({
      async generateText() {
        const err = new Error('429 Quota exceeded');
        (err as unknown as { status: number }).status = 429;
        throw err;
      },
    });

    const firstRes = await runAuditPipeline(audit.id, {
      crawlOptions: { allowLocalTestFixture: true, politeDelayMs: 0 },
    });
    expect(firstRes.status).toBe('WAITING_FOR_QUOTA');

    const pagesAfterQuota = await listAuditPages(audit.id);
    expect(pagesAfterQuota.length).toBeGreaterThanOrEqual(1);
    const hitsAfterFirstRun = fetchCount;

    // Second run succeeds and reuses stored crawl pages without re-fetching HTTP!
    setMockAiAdapterForTesting({
      async generateText() {
        return JSON.stringify(WILLOW_CREEK_SAMPLE_REPORT);
      },
    });

    const secondRes = await runAuditPipeline(audit.id, {
      skipCrawlIfStored: true,
      crawlOptions: { allowLocalTestFixture: true, politeDelayMs: 0 },
    });
    expect(secondRes.status).toBe('COMPLETED');
    expect(fetchCount).toBe(hitsAfterFirstRun); // Did not re-fetch!

    const updated = await findAuditById(audit.id);
    expect(updated?.auditStatus).toBe('COMPLETED');
    expect(updated?.currentStageIndex).toBe(9);
    expect(updated?.pipelineStage).toBe('REPORT_GENERATED');

    const findings = await listAuditFindings(audit.id);
    expect(findings.length).toBeGreaterThan(0);

    const events = await listAuditEvents(audit.id);
    expect(events.some((e) => e.eventType === 'WAITING_FOR_QUOTA')).toBe(true);
    expect(events.some((e) => e.eventType === 'CRAWL_REUSED')).toBe(true);
    expect(events.some((e) => e.eventType === 'AUDIT_COMPLETED')).toBe(true);
  });
});
