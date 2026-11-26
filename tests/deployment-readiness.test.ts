// tests/deployment-readiness.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@libsql/client';
import { NextRequest } from 'next/server';
import { getEnv, resetEnvCache } from '@/lib/env';
import { DatabaseNotConfiguredError, getDbClient, resetDbForTesting, setTestDb } from '@/lib/db';
import { runMigrations } from '@/lib/db/migrate';
import { verifyAdminCsrf, ADMIN_CSRF_HEADER } from '@/lib/security/admin-auth';
import { POST as submitAuditRoute, verifySmokeTestHeader } from '@/app/api/audits/route';
import { GET as healthRoute } from '@/app/api/health/route';
import { createAudit, acquireProcessingLock, hasActiveProcessingLock } from '@/lib/db/repositories/audits.repo';
import { classifyAuditSubmitResponse } from '@/components/audit/submit-error';

describe('Deployment Readiness & Serverless Hardening', () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    resetEnvCache();
    resetDbForTesting();
  });

  afterEach(() => {
    process.env = { ...savedEnv };
    resetEnvCache();
    resetDbForTesting();
  });

  it('validates env lazily during build with zero env vars and resolves aliases + Vercel defaults', () => {
    process.env = { NODE_ENV: 'production', NEXT_PHASE: 'phase-production-build' };
    resetEnvCache();
    expect(() => getEnv()).not.toThrow();

    process.env = {
      NODE_ENV: 'production',
      VERCEL: '1',
      DATABASE_URL: 'file:./data/amarketing.db',
      TURSO_DATABASE_URL: 'libsql://prod-db.turso.io',
      TURSO_AUTH_TOKEN: 'turso-tok-val',
    };
    resetEnvCache();
    const resolved = getEnv();
    expect(resolved.DATABASE_URL).toBe('libsql://prod-db.turso.io');
    expect(resolved.DATABASE_AUTH_TOKEN).toBe('turso-tok-val');
    expect(resolved.TRUST_PROXY).toBe(true);
  });

  it('rejects file: DB cleanly on VERCEL without fs writes or crashing, and returns DATABASE_NOT_CONFIGURED on API', async () => {
    process.env = { NODE_ENV: 'production', VERCEL: '1', DATABASE_URL: 'file:./data/amarketing.db', ADMIN_SESSION_SECRET: 'x'.repeat(32) };
    resetEnvCache();
    expect(() => getDbClient()).toThrow(DatabaseNotConfiguredError);

    const res = await submitAuditRoute(
      new NextRequest('https://app.vercel.app/api/audits', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          website: 'https://example.com',
          businessName: 'Test Biz',
          industry: 'Dental',
          country: 'US',
          businessDescription: 'Dental practice offering preventive cleanings and cosmetic treatments.',
          challenges: ['Missed phone calls'],
          goals: ['Automate appointments and bookings'],
          contactName: 'Alice',
          contactEmail: 'alice@example.com',
          consent: true,
          processingNoticeAck: true,
          marketingConsent: false,
          websiteConfirmHp: '',
          formStartedAt: Date.now() - 5000,
        }),
      }),
    );
    expect(res.status).toBe(503);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe('DATABASE_NOT_CONFIGURED');
  });

  it('enforces Origin/CSRF checks across same-host, forwarded-host, and foreign origins', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://prod.example.com';
    process.env.TRUST_PROXY = 'true';
    resetEnvCache();

    const forwardedOk = verifyAdminCsrf(
      new NextRequest('https://internal/api/admin/stats', {
        method: 'POST',
        headers: {
          [ADMIN_CSRF_HEADER]: '1',
          'x-forwarded-host': 'preview-123.vercel.app',
          'x-forwarded-proto': 'https',
          origin: 'https://preview-123.vercel.app',
        },
      }),
    );
    expect(forwardedOk.ok).toBe(true);

    const foreignBlocked = verifyAdminCsrf(
      new NextRequest('https://prod.example.com/api/admin/stats', {
        method: 'POST',
        headers: {
          [ADMIN_CSRF_HEADER]: '1',
          host: 'prod.example.com',
          origin: 'https://evil.attacker',
        },
      }),
    );
    expect(foreignBlocked.ok).toBe(false);
  });

  it('gates smoke-test header constant-time and exposes safe health output with lock-guarded self-heal', async () => {
    const req = new NextRequest('https://app.vercel.app/api/audits', {
      method: 'POST',
      headers: { 'x-smoke-test': 'secret-abc' },
    });
    expect(verifySmokeTestHeader(req, undefined)).toBe(false);
    expect(verifySmokeTestHeader(req, 'wrong-secret')).toBe(false);
    expect(verifySmokeTestHeader(req, 'secret-abc')).toBe(true);

    process.env.DATABASE_URL = 'file::memory:';
    process.env.GEMINI_API_KEY = 'test-gemini-placeholder-never-print-12345';
    process.env.CRON_SECRET = 'cron-secret-value-never-leak-12345';
    resetEnvCache();
    const db = setTestDb(createClient({ url: ':memory:' }));
    await runMigrations(db);

    const audit = await createAudit({
      publicToken: 'tok_lock_check',
      businessName: 'Lock Clinic',
      website: 'https://example.com',
      normalizedDomain: 'example.com',
      industry: 'Dental',
      country: 'US',
      businessDescription: 'Dental practice',
      challenges: ['Missed phone calls'],
      goals: ['Save time'],
      contactName: 'Bob',
      contactEmail: 'bob@example.com',
      isFreeEmailDomain: false,
      consent: true,
      consentVersion: 'v1',
      consentAt: new Date().toISOString(),
      marketingConsent: false,
      leadScore: 50,
      leadScoreBreakdown: '[]',
      leadReason: 'Test',
      leadPriority: 'WARM',
      releaseStatus: 'AUTO',
      dedupeKey: 'dk_lock',
    });
    expect(await acquireProcessingLock(audit.id)).toBe(true);
    expect(await hasActiveProcessingLock(audit.id)).toBe(true);

    const hRes = await healthRoute(new NextRequest('http://localhost:3000/api/health?detail=1'));
    const hText = await hRes.text();
    expect(hRes.status).toBe(200);
    expect(hText).not.toContain('test-gemini-placeholder');
    expect(hText).not.toContain('cron-secret-value');
    const hJson = JSON.parse(hText) as { dbReachable: boolean; schemaOk: boolean; missingOrInvalidEnv?: unknown };
    expect(hJson.dbReachable).toBe(true);
    expect(hJson.schemaOk).toBe(true);
    expect(hJson.missingOrInvalidEnv).toBeUndefined();
  });

  it('classifies submit failures clearly and verifies all API routes declare nodejs runtime', () => {
    const fieldRes = classifyAuditSubmitResponse({
      status: 400,
      rawText: JSON.stringify({ error: 'Invalid input', fieldErrors: { website: 'Bad URL' }, requestId: 'r1' }),
    });
    expect(fieldRes.fieldErrors?.website).toBe('Bad URL');

    const dbErr = classifyAuditSubmitResponse({
      status: 503,
      rawText: JSON.stringify({ error: 'DB missing', code: 'DATABASE_NOT_CONFIGURED', requestId: 'r2' }),
    });
    expect(dbErr.message).toContain('DATABASE_NOT_CONFIGURED');
    expect(dbErr.message).toContain('r2');

    const nonJson = classifyAuditSubmitResponse({ status: 500, rawText: '<html>500 Bad Gateway</html>' });
    expect(nonJson.message).toContain('non-JSON response');
    expect(nonJson.message).not.toContain('Network error');

    const apiDir = path.resolve(process.cwd(), 'src/app/api');
    const walk = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(path.join(dir, e.name)) : e.name === 'route.ts' ? [path.join(dir, e.name)] : [],
      );
    for (const file of walk(apiDir)) {
      const content = fs.readFileSync(file, 'utf8');
      expect(content, `${path.relative(apiDir, file)} missing runtime='nodejs'`).toMatch(
        /export const runtime\s*=\s*['"]nodejs['"]/,
      );
    }
  });
});
