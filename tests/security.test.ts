import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { createClient } from '@libsql/client';
import {
  UrlGuardError,
  validateUrlStatic,
  validateUrlWithDns,
  isPrivateOrReservedIp,
  normalizeUserWebsiteInput,
} from '@/lib/security/url-guard';
import { safeFetch, SafeFetchError } from '@/lib/security/safe-fetch';
import { detectSensitiveFreeText, scrubSensitiveForAi } from '@/lib/security/pii-scrub';
import { resetEnvCache } from '@/lib/env';
import { setTestDb, resetDbForTesting } from '@/lib/db';
import { runMigrations } from '@/lib/db/migrate';
import { checkAndIncrementRateLimit } from '@/lib/db/repositories/rate-limits.repo';
import { signAdminSessionToken, verifyAdminSessionToken } from '@/lib/security/admin-session-token';

describe('URL Guard & SSRF Protection', () => {
  const blockedUrls = [
    'http://localhost/admin',
    'http://localhost./admin',
    'http://127.0.0.1/',
    'http://0.0.0.0/',
    'http://[::1]/',
    'http://[::]/',
    'http://169.254.169.254/latest/meta-data/',
    'http://metadata.google.internal/computeMetadata/v1/',
    'http://100.64.0.1/',
    'http://100.100.100.200/',
    'http://10.0.0.1/',
    'http://172.16.0.1/',
    'http://172.31.255.254/',
    'http://192.168.1.1/',
    'http://2130706433/', // decimal loopback
    'http://0177.0.0.1/', // octal loopback
    'http://0x7f000001/', // hex loopback
    'http://0x7f.0.0.1/',
    'http://127.1/', // shortened dotted
    'http://[::ffff:127.0.0.1]/',
    'http://[::ffff:7f00:1]/',
    'http://[::127.0.0.1]/',
    'http://[fd00:ec2::254]/',
    'http://user:pass@example.com/',
    'https://admin@example.com/',
    'file:///etc/passwd',
    'ftp://example.com/file',
    'gopher://example.com:70/',
    'https://example.com:8443/',
    'http://example.com:8080/',
    'https://service.internal/',
    'https://printer.local/',
    'https://dev.localhost/',
    'https://router.lan/',
    'https://nas.home.arpa/',
    'https://intranet/',
  ];

  it.each(blockedUrls)('rejects unsafe URL: %s', async (badUrl) => {
    await expect(validateUrlWithDns(badUrl)).rejects.toThrow(UrlGuardError);
  });

  it('normalizes user input and handles trailing dots and IDN', () => {
    expect(normalizeUserWebsiteInput('example.com')).toBe('https://example.com');
    const res = validateUrlStatic('https://Example.COM./services#top');
    expect(res.hostname).toBe('example.com');
    expect(res.normalizedUrl).toBe('https://example.com/services');

    const idn = validateUrlStatic('https://münchen.de/');
    expect(idn.hostname).toContain('xn--');
  });

  it('rejects hostnames that resolve via DNS to private IPs', async () => {
    await expect(
      validateUrlWithDns('https://sneaky.example.com/', {
        dnsLookup: async () => [{ address: '10.1.2.3', family: 4 }],
      }),
    ).rejects.toThrow(/private or reserved/i);

    await expect(
      validateUrlWithDns('https://dualstack.example.com/', {
        dnsLookup: async () => [
          { address: '93.184.216.34', family: 4 },
          { address: 'fc00::1', family: 6 },
        ],
      }),
    ).rejects.toThrow(/private or reserved/i);
  });

  it('enforces test-only escape hatch is strictly inert outside NODE_ENV=test', () => {
    const prevEnv = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    try {
      expect(() =>
        validateUrlStatic('http://127.0.0.1:4321/', { allowLocalTestFixture: true }),
      ).toThrow(UrlGuardError);
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = prevEnv;
    }
  });

  it('correctly classifies public vs private/reserved IPs', () => {
    expect(isPrivateOrReservedIp('93.184.216.34')).toBe(false);
    expect(isPrivateOrReservedIp('2606:2800:220:1:248:1893:25c8:1946')).toBe(false);
    expect(isPrivateOrReservedIp('172.15.255.255')).toBe(false);
    expect(isPrivateOrReservedIp('172.16.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('100.64.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('fe80::1')).toBe(true);
  });
});

describe('SafeFetch DNS rebinding, redirects, and size caps', () => {
  let server: http.Server;
  let serverPort = 0;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      if (req.url === '/ok') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<html><body><h1>Hello Clinic</h1></body></html>');
        return;
      }
      if (req.url === '/redirect-private') {
        res.writeHead(302, { Location: 'http://169.254.169.254/latest/meta-data/' });
        res.end();
        return;
      }
      if (req.url === '/redirect-cross-domain') {
        res.writeHead(302, { Location: 'https://other-domain.example/landing' });
        res.end();
        return;
      }
      if (req.url === '/huge') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('A'.repeat(2_000_000));
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('Not found');
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        serverPort = typeof addr === 'object' && addr ? addr.port : 0;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('pins initial validated IP so second DNS lookup returning private IP cannot rebind', async () => {
    let lookupCalls = 0;
    const dnsLookup = async () => {
      lookupCalls += 1;
      if (lookupCalls === 1) {
        return [{ address: '127.0.0.1', family: 4 as const }];
      }
      return [{ address: '169.254.169.254', family: 4 as const }];
    };

    const result = await safeFetch(`http://rebind.test:${serverPort}/ok`, {
      allowLocalTestFixture: true,
      dnsLookup,
    });

    expect(result.status).toBe(200);
    expect(result.body).toContain('Hello Clinic');
    expect(lookupCalls).toBe(1);
  });

  it('blocks redirects to private addresses', async () => {
    await expect(
      safeFetch(`http://127.0.0.1:${serverPort}/redirect-private`, {
        allowLocalTestFixture: true,
        allowCrossDomainRedirect: true,
      }),
    ).rejects.toThrow(UrlGuardError);
  });

  it('blocks cross-domain redirects unless explicitly allowed', async () => {
    await expect(
      safeFetch(`http://127.0.0.1:${serverPort}/redirect-cross-domain`, {
        allowLocalTestFixture: true,
        allowCrossDomainRedirect: false,
        dnsLookup: async () => [{ address: '93.184.216.34', family: 4 as const }],
      }),
    ).rejects.toThrow(SafeFetchError);
  });

  it('aborts oversized responses over 1.5 MB cap', async () => {
    await expect(
      safeFetch(`http://127.0.0.1:${serverPort}/huge`, {
        allowLocalTestFixture: true,
        maxBytes: 1_500_000,
      }),
    ).rejects.toThrow(/maximum allowed size/i);
  });
});

describe('PII Detection, Scrubbing, Rate Limits & Admin Tokens', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = 'file::memory:';
    process.env.ADMIN_SESSION_SECRET = 'test-secret-that-is-at-least-32-characters-long';
    resetEnvCache();
    const client = createClient({ url: ':memory:' });
    const db = setTestDb(client);
    await runMigrations(db);
  });

  afterAll(() => {
    resetDbForTesting();
  });

  it('detects and scrubs sensitive patterns in free text', () => {
    const check = detectSensitiveFreeText('Contact john@clinic.com or call +1 555-234-5678');
    expect(check.hasSensitiveData).toBe(true);
    expect(check.reasons).toContain('email address');
    expect(check.reasons).toContain('phone number');

    const scrubbed = scrubSensitiveForAi(
      'Email jane@acme.com, phone (415) 888-9900, card 4111 1111 1111 1111',
    );
    expect(scrubbed).not.toContain('jane@acme.com');
    expect(scrubbed).not.toContain('888-9900');
    expect(scrubbed).not.toContain('4111 1111');
  });

  it('enforces DB-backed fixed-window rate limits', async () => {
    const key = 'test-limit:1';
    const r1 = await checkAndIncrementRateLimit(key, 3600, 2, 10000);
    const r2 = await checkAndIncrementRateLimit(key, 3600, 2, 10005);
    const r3 = await checkAndIncrementRateLimit(key, 3600, 2, 10010);

    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(false);
    expect(r3.count).toBe(3);
  });

  it('signs and verifies admin session JWT and rejects expired/invalid tokens', async () => {
    const secret = 'super-secret-key-for-testing-at-least-32-chars';
    const token = await signAdminSessionToken(secret, 60);
    const verified = await verifyAdminSessionToken(token, secret);
    expect(verified?.sub).toBe('admin');

    const wrongSecret = await verifyAdminSessionToken(token, 'other-wrong-secret-32-chars-minimum-xx');
    expect(wrongSecret).toBeNull();

    const expired = await signAdminSessionToken(secret, -5);
    expect(await verifyAdminSessionToken(expired, secret)).toBeNull();
  });
});
