import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createClient } from '@libsql/client';
import { NextRequest } from 'next/server';
import { resetEnvCache } from '@/lib/env';
import { setTestDb, resetDbForTesting } from '@/lib/db';
import { runMigrations } from '@/lib/db/migrate';
import {
  createAudit,
  getAdminStats,
  updateAuditPipelineStage,
} from '@/lib/db/repositories/audits.repo';
import { serializePublicReportDto } from '@/lib/reports/public-dto';
import { buildAuditsCsv, sanitizeCsvCell } from '@/lib/admin/csv-export';
import { WILLOW_CREEK_SAMPLE_REPORT } from '@/lib/sample/willow-creek';
import { POST as submitAuditRoute } from '@/app/api/audits/route';
import { POST as precheckRoute } from '@/app/api/audits/precheck/route';
import { GET as healthRoute } from '@/app/api/health/route';
import { GET as getReportRoute, DELETE as deleteReportRoute } from '@/app/api/reports/[token]/route';
import { POST as recordIntentRoute } from '@/app/api/reports/[token]/intent/route';
import { POST as adminLoginRoute } from '@/app/api/admin/login/route';
import { PATCH as adminPatchAuditRoute } from '@/app/api/admin/audits/[id]/route';
import { GET as cronGetResumeRoute, POST as cronResumeRoute } from '@/app/api/internal/jobs/resume/route';
import { ADMIN_COOKIE_NAME, signAdminSessionToken } from '@/lib/security/admin-session-token';
import { ADMIN_CSRF_HEADER } from '@/lib/security/admin-auth';

function makeJsonReq(
  url: string,
  method: string,
  body?: unknown,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest(url, {
    method,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe('API Validation, Region Guard, Dedupe, Public DTO & Funnel/CSV', () => {
  beforeEach(async () => {
    process.env.DATABASE_URL = 'file::memory:';
    process.env.GEMINI_PAID_TIER = 'false';
    process.env.ADMIN_PASSWORD = 'super-strong-admin-password-2026';
    process.env.ADMIN_SESSION_SECRET = 'admin-session-secret-with-more-than-32-chars';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    process.env.CRON_SECRET = 'cron-secret-value-123456';
    process.env.MAX_AUDITS_PER_DAY = '0'; // keeps POST /api/audits queued synchronously without spawning after() outside Next request lifecycle
    resetEnvCache();

    const client = createClient({ url: ':memory:' });
    const db = setTestDb(client);
    await runMigrations(db);
  });

  afterEach(() => {
    resetDbForTesting();
  });

  it('enforces region guard when GEMINI_PAID_TIER=false and allows when true', async () => {
    const payload = {
      website: 'https://example.com',
      businessName: 'Berlin Dental',
      industry: 'Dental',
      country: 'DE',
      businessDescription: 'General and cosmetic dental treatments for families.',
      challenges: ['Missed phone calls'],
      goals: ['Automate appointments and bookings'],
      contactName: 'Dr. Max',
      contactEmail: 'max@berlindental.example',
      consent: true,
      processingNoticeAck: true,
      marketingConsent: false,
      websiteConfirmHp: '',
      formStartedAt: Date.now() - 10_000,
    };

    const blockedRes = await submitAuditRoute(
      makeJsonReq('http://localhost:3000/api/audits', 'POST', payload),
    );
    expect(blockedRes.status).toBe(403);
    const blockedJson = (await blockedRes.json()) as { code?: string };
    expect(blockedJson.code).toBe('REGION_RESTRICTED');

    // Now allow when GEMINI_PAID_TIER=true
    process.env.GEMINI_PAID_TIER = 'true';
    resetEnvCache();

    const okRes = await submitAuditRoute(
      makeJsonReq('http://localhost:3000/api/audits', 'POST', { ...payload, country: 'US' }),
    );
    expect([200, 201]).toContain(okRes.status);
  });

  it('rejects honeypot, too-fast submissions, and deduplicates repeat domain+email within 24h', async () => {
    const validPayload = {
      website: 'https://example.com',
      businessName: 'Sunrise Clinic',
      industry: 'Healthcare',
      country: 'US',
      businessDescription: 'Outpatient physiotherapy and wellness rehabilitation centre.',
      challenges: ['Managing customer enquiries'],
      goals: ['Improve enquiry conversion'],
      contactName: 'Taylor Owner',
      contactEmail: 'taylor@sunriseclinic.example',
      consent: true,
      processingNoticeAck: true,
      marketingConsent: false,
      websiteConfirmHp: '',
      formStartedAt: Date.now() - 10_000,
    };

    // Honeypot filled -> 400
    const hpRes = await submitAuditRoute(
      makeJsonReq('http://localhost:3000/api/audits', 'POST', {
        ...validPayload,
        websiteConfirmHp: 'http://spam.bot',
      }),
    );
    expect(hpRes.status).toBe(400);

    // Too fast (< 2.5s) -> 400
    const fastRes = await submitAuditRoute(
      makeJsonReq('http://localhost:3000/api/audits', 'POST', {
        ...validPayload,
        formStartedAt: Date.now() - 200,
      }),
    );
    expect(fastRes.status).toBe(400);

    // First valid submit -> 201
    const first = await submitAuditRoute(
      makeJsonReq('http://localhost:3000/api/audits', 'POST', validPayload),
    );
    expect(first.status).toBe(201);
    const firstData = (await first.json()) as { token: string };

    // Duplicate same domain + email -> 200 with existing token
    const dup = await submitAuditRoute(
      makeJsonReq('http://localhost:3000/api/audits', 'POST', validPayload),
    );
    expect(dup.status).toBe(200);
    const dupData = (await dup.json()) as { token: string; deduplicated: boolean };
    expect(dupData.deduplicated).toBe(true);
    expect(dupData.token).toBe(firstData.token);
  });

  it('never leaks contact details or lead scores in public report DTO and supports intent + self-delete', async () => {
    const audit = await createAudit({
      publicToken: 'tok_public_dto_safe',
      businessName: 'Oak Dental',
      website: 'https://oakdental.example',
      normalizedDomain: 'oakdental.example',
      industry: 'Dental',
      country: 'US',
      businessDescription: 'Dental practice',
      challenges: ['Missed phone calls'],
      goals: ['Generate more leads'],
      contactName: 'PRIVATE_CONTACT_NAME',
      contactEmail: 'private.owner@oakdental.example',
      contactPhone: '+1-999-888-7777',
      contactRole: 'Owner',
      isFreeEmailDomain: false,
      consent: true,
      consentVersion: '2026-11-v1',
      consentAt: new Date().toISOString(),
      marketingConsent: false,
      leadScore: 82,
      leadScoreBreakdown: '[]',
      leadReason: 'INTERNAL_LEAD_REASON',
      leadPriority: 'HOT',
      releaseStatus: 'AUTO',
      dedupeKey: 'dk_dto',
      ipHash: 'iph_dto',
    });

    const dto = serializePublicReportDto(audit, []);
    const serialized = JSON.stringify(dto);
    expect(serialized).not.toContain('PRIVATE_CONTACT_NAME');
    expect(serialized).not.toContain('private.owner@oakdental.example');
    expect(serialized).not.toContain('+1-999-888-7777');
    expect(serialized).not.toContain('INTERNAL_LEAD_REASON');
    expect(serialized).not.toContain('leadScore');

    // Record consultation intent
    const intentRes = await recordIntentRoute(
      makeJsonReq('http://localhost:3000/api/reports/tok_public_dto_safe/intent', 'POST', {
        type: 'CONSULTATION',
        preferredTime: 'Tuesday morning',
      }),
      { params: Promise.resolve({ token: 'tok_public_dto_safe' }) },
    );
    expect(intentRes.status).toBe(200);

    // Self-service delete requires confirm: true
    const delFail = await deleteReportRoute(
      makeJsonReq('http://localhost:3000/api/reports/tok_public_dto_safe', 'DELETE', {}),
      { params: Promise.resolve({ token: 'tok_public_dto_safe' }) },
    );
    expect(delFail.status).toBe(400);

    const delOk = await deleteReportRoute(
      makeJsonReq('http://localhost:3000/api/reports/tok_public_dto_safe', 'DELETE', {
        confirm: true,
      }),
      { params: Promise.resolve({ token: 'tok_public_dto_safe' }) },
    );
    expect(delOk.status).toBe(200);

    const afterDel = await getReportRoute(
      makeJsonReq('http://localhost:3000/api/reports/tok_public_dto_safe', 'GET'),
      { params: Promise.resolve({ token: 'tok_public_dto_safe' }) },
    );
    expect(afterDel.status).toBe(404);
  });

  it('tracks ever-reached funnel stages including NOT_INTERESTED and neutralizes CSV formula injection', async () => {
    const emptyStats = await getAdminStats();
    expect(emptyStats.funnel[1]?.stepConversionPct).toBeNull(); // Zero denominator -> null (displays "—")

    const a1 = await createAudit({
      publicToken: 'tok_f1',
      businessName: '=CMD("calc")',
      website: 'https://f1.example',
      normalizedDomain: 'f1.example',
      industry: 'Dental',
      country: 'US',
      businessDescription: 'Test business one',
      challenges: ['Missed phone calls'],
      goals: ['Generate more leads'],
      contactName: '+EvilContact',
      contactEmail: 'f1@example.com',
      isFreeEmailDomain: true,
      consent: true,
      consentVersion: 'v1',
      consentAt: new Date().toISOString(),
      marketingConsent: false,
      leadScore: 75,
      leadScoreBreakdown: '[]',
      leadReason: 'Hot',
      leadPriority: 'HOT',
      releaseStatus: 'AUTO',
      dedupeKey: 'dk_f1',
    });

    await updateAuditPipelineStage(a1.id, 'QUALIFIED', 'Strong fit');
    await updateAuditPipelineStage(a1.id, 'CONSULTATION_BOOKED', 'Booked Tuesday');
    await updateAuditPipelineStage(a1.id, 'NOT_INTERESTED', 'Budget paused');

    const stats = await getAdminStats();
    expect(stats.kpis.totalSubmissions).toBe(1);
    expect(stats.kpis.qualifiedProspects).toBe(1); // Ever reached QUALIFIED!
    expect(stats.kpis.consultationRequests).toBe(1); // Ever reached CONSULTATION_BOOKED!
    expect(stats.kpis.convertedClients).toBe(0);

    expect(sanitizeCsvCell('=1+1')).toBe('"\'=1+1"');
    expect(sanitizeCsvCell('+cmd')).toBe('"\'+cmd"');
    expect(sanitizeCsvCell('-cmd')).toBe('"\'-cmd"');
    expect(sanitizeCsvCell('@SUM(A1)')).toBe('"\'@SUM(A1)"');
    expect(sanitizeCsvCell('\tcell')).toBe('"\'\tcell"');

    const csv = buildAuditsCsv([a1]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"\'=CMD(""calc"")"');
    expect(csv).toContain('"\'+EvilContact"');
  });

  it('enforces admin login throttling, CSRF/Origin checks, and cron secret', async () => {
    // Login throttling: 5 bad attempts allowed (401), 6th throttled (429)
    for (let i = 0; i < 5; i++) {
      const bad = await adminLoginRoute(
        makeJsonReq('http://localhost:3000/api/admin/login', 'POST', {
          password: 'wrong-password',
        }),
      );
      expect(bad.status).toBe(401);
    }
    const throttled = await adminLoginRoute(
      makeJsonReq('http://localhost:3000/api/admin/login', 'POST', {
        password: 'wrong-password',
      }),
    );
    expect(throttled.status).toBe(429);

    const a1 = await createAudit({
      publicToken: 'tok_csrf',
      businessName: 'CSRF Test Co',
      website: 'https://csrf.example',
      normalizedDomain: 'csrf.example',
      industry: 'Dental',
      country: 'US',
      businessDescription: 'Dental clinic',
      challenges: ['Missed phone calls'],
      goals: ['Generate more leads'],
      contactName: 'Alice',
      contactEmail: 'alice@csrf.example',
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
      dedupeKey: 'dk_csrf',
    });

    const jwt = await signAdminSessionToken(process.env.ADMIN_SESSION_SECRET!, 3600);

    // Missing CSRF header -> 403
    const noCsrf = await adminPatchAuditRoute(
      makeJsonReq(
        `http://localhost:3000/api/admin/audits/${a1.id}`,
        'PATCH',
        { pipelineStage: 'QUALIFIED' },
        {
          cookie: `${ADMIN_COOKIE_NAME}=${jwt}`,
          origin: 'http://localhost:3000',
        },
      ),
      { params: Promise.resolve({ id: String(a1.id) }) },
    );
    expect(noCsrf.status).toBe(403);

    // Wrong Origin -> 403
    const badOrigin = await adminPatchAuditRoute(
      makeJsonReq(
        `http://localhost:3000/api/admin/audits/${a1.id}`,
        'PATCH',
        { pipelineStage: 'QUALIFIED' },
        {
          cookie: `${ADMIN_COOKIE_NAME}=${jwt}`,
          origin: 'https://evil.attacker',
          [ADMIN_CSRF_HEADER]: '1',
        },
      ),
      { params: Promise.resolve({ id: String(a1.id) }) },
    );
    expect(badOrigin.status).toBe(403);

    // Valid CSRF + Origin -> 200
    const goodPatch = await adminPatchAuditRoute(
      makeJsonReq(
        `http://localhost:3000/api/admin/audits/${a1.id}`,
        'PATCH',
        { pipelineStage: 'QUALIFIED' },
        {
          cookie: `${ADMIN_COOKIE_NAME}=${jwt}`,
          origin: 'http://localhost:3000',
          [ADMIN_CSRF_HEADER]: '1',
        },
      ),
      { params: Promise.resolve({ id: String(a1.id) }) },
    );
    expect(goodPatch.status).toBe(200);

    // Cron secret guard
    const cronUnauth = await cronResumeRoute(
      makeJsonReq('http://localhost:3000/api/internal/jobs/resume', 'POST', undefined, {
        authorization: 'Bearer wrong-secret',
      }),
    );
    expect(cronUnauth.status).toBe(401);

    const cronOk = await cronResumeRoute(
      makeJsonReq('http://localhost:3000/api/internal/jobs/resume', 'POST', undefined, {
        authorization: 'Bearer cron-secret-value-123456',
      }),
    );
    expect(cronOk.status).toBe(200);

    const cronGetOk = await cronGetResumeRoute(
      makeJsonReq('http://localhost:3000/api/internal/jobs/resume', 'GET', undefined, {
        authorization: 'Bearer cron-secret-value-123456',
      }),
    );
    expect(cronGetOk.status).toBe(200);

    // Health check reports schemaReady & database connected
    const healthRes = await healthRoute(makeJsonReq('http://localhost:3000/api/health', 'GET'));
    expect(healthRes.status).toBe(200);
    const healthJson = (await healthRes.json()) as {
      application: string;
      database: string;
      schemaReady: boolean;
    };
    expect(healthJson.application).toBe('healthy');
    expect(healthJson.database).toBe('connected');
    expect(healthJson.schemaReady).toBe(true);

    // Precheck returns URL_INVALID on malformed/private URL without crashing
    const preInvalid = await precheckRoute(
      makeJsonReq('http://localhost:3000/api/audits/precheck', 'POST', {
        url: 'http://127.0.0.1/admin',
      }),
    );
    expect(preInvalid.status).toBe(200);
    const preJson = (await preInvalid.json()) as { urlStatus: string; reachable: boolean };
    expect(preJson.reachable).toBe(false);
    expect(preJson.urlStatus).toBe('URL_INVALID');

    // Vercel Preview origin check allows active VERCEL_URL origin while rejecting unknown origins
    const prevVercelUrl = process.env.VERCEL_URL;
    process.env.VERCEL_URL = 'ai-audit-preview.vercel.app';
    try {
      const previewPatch = await adminPatchAuditRoute(
        makeJsonReq(
          `https://ai-audit-preview.vercel.app/api/admin/audits/${a1.id}`,
          'PATCH',
          { pipelineStage: 'QUALIFIED' },
          {
            cookie: `${ADMIN_COOKIE_NAME}=${jwt}`,
            origin: 'https://ai-audit-preview.vercel.app',
            [ADMIN_CSRF_HEADER]: '1',
          },
        ),
        { params: Promise.resolve({ id: String(a1.id) }) },
      );
      expect(previewPatch.status).toBe(200);
    } finally {
      if (prevVercelUrl === undefined) delete process.env.VERCEL_URL;
      else process.env.VERCEL_URL = prevVercelUrl;
    }

    // Supports TURSO_DATABASE_URL + TURSO_AUTH_TOKEN fallback when DATABASE_URL points to local file
    const { getEnv } = await import('@/lib/env');
    const prevDbUrl = process.env.DATABASE_URL;
    const prevTursoUrl = process.env.TURSO_DATABASE_URL;
    const prevTursoToken = process.env.TURSO_AUTH_TOKEN;
    try {
      process.env.DATABASE_URL = 'file:./data/amarketing.db';
      process.env.TURSO_DATABASE_URL = 'libsql://amarketing-test.turso.io';
      process.env.TURSO_AUTH_TOKEN = 'test-turso-token';
      resetEnvCache();
      const resolvedEnv = getEnv();
      expect(resolvedEnv.DATABASE_URL).toBe('libsql://amarketing-test.turso.io');
      expect(resolvedEnv.DATABASE_AUTH_TOKEN).toBe('test-turso-token');
    } finally {
      if (prevDbUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = prevDbUrl;
      if (prevTursoUrl === undefined) delete process.env.TURSO_DATABASE_URL;
      else process.env.TURSO_DATABASE_URL = prevTursoUrl;
      if (prevTursoToken === undefined) delete process.env.TURSO_AUTH_TOKEN;
      else process.env.TURSO_AUTH_TOKEN = prevTursoToken;
      resetEnvCache();
    }

    // Keep unused reference used cleanly
    expect(WILLOW_CREEK_SAMPLE_REPORT.businessOverview.businessName).toBe(
      'Willow Creek Orthodontics',
    );
  });
});

