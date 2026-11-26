// scripts/vercel-env-sync.mjs
// Safely syncs non-empty allow-listed variables from .env.vercel to Vercel via stdin (never echoing values).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const envPath = path.resolve(process.cwd(), '.env.vercel');
if (!fs.existsSync(envPath)) {
  console.error('Missing .env.vercel.');
  process.exit(1);
}

const includePreview = process.argv.includes('--preview');

const ALLOW_LIST = new Set([
  'DATABASE_URL',
  'DATABASE_AUTH_TOKEN',
  'TURSO_DATABASE_URL',
  'TURSO_AUTH_TOKEN',
  'GEMINI_API_KEY',
  'GEMINI_MODEL',
  'GEMINI_FALLBACK_MODEL',
  'GEMINI_PAID_TIER',
  'ADMIN_PASSWORD',
  'ADMIN_PASSWORD_HASH',
  'ADMIN_SESSION_SECRET',
  'CRON_SECRET',
  'SMOKE_TEST_SECRET',
  'VERCEL_AUTOMATION_BYPASS_SECRET',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_BOOKING_URL',
  'BUSINESS_CONTACT_EMAIL',
  'TRUST_PROXY',
  'REPORT_RELEASE_MODE',
  'MAX_AUDITS_PER_DAY',
  'DATA_RETENTION_DAYS',
  'CRAWL_CACHE_TTL_HOURS',
  'RESEND_API_KEY',
  'FROM_EMAIL',
  'NOTIFY_WEBHOOK_URL',
  'TURNSTILE_SITE_KEY',
  'TURNSTILE_SECRET_KEY',
  'VIDEO_STORAGE',
  'ASSISTANT_ENABLED',
  'ASSISTANT_MAX_USER_MESSAGES_PER_AUDIT',
  'ASSISTANT_MAX_MESSAGE_CHARS',
  'ASSISTANT_HISTORY_MESSAGES',
  'ASSISTANT_MAX_OUTPUT_TOKENS',
  'ASSISTANT_MAX_CALLS_PER_DAY',
]);

const SENSITIVE = new Set([
  'DATABASE_URL',
  'DATABASE_AUTH_TOKEN',
  'TURSO_DATABASE_URL',
  'TURSO_AUTH_TOKEN',
  'GEMINI_API_KEY',
  'ADMIN_PASSWORD',
  'ADMIN_PASSWORD_HASH',
  'ADMIN_SESSION_SECRET',
  'CRON_SECRET',
  'SMOKE_TEST_SECRET',
  'VERCEL_AUTOMATION_BYPASS_SECRET',
  'RESEND_API_KEY',
  'NOTIFY_WEBHOOK_URL',
  'TURNSTILE_SECRET_KEY',
]);

const parsed = new Map();
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#') || !t.includes('=')) continue;
  const idx = t.indexOf('=');
  const k = t.slice(0, idx).trim();
  const v = t.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
  if (ALLOW_LIST.has(k) && v.length > 0) parsed.set(k, v);
}

if (!parsed.has('TRUST_PROXY')) parsed.set('TRUST_PROXY', 'true');

const vcJsPath = process.platform === 'win32'
  ? path.join(path.dirname(spawnSync('where.exe', ['vercel'], { encoding: 'utf8' }).stdout.split(/\r?\n/)[0] || ''), 'node_modules', 'vercel', 'dist', 'vc.js')
  : '';
const useVcJs = Boolean(vcJsPath && fs.existsSync(vcJsPath));
const targets = includePreview ? ['production', 'preview'] : ['production'];

let failures = 0;
for (const [name, value] of parsed.entries()) {
  if ((name === 'DATABASE_URL' || name === 'TURSO_DATABASE_URL') && value.startsWith('file:')) {
    console.log(`${name}: failed (refused file: URL)`);
    failures += 1;
    continue;
  }
  for (const envName of targets) {
    const addArgs = [
      ...(useVcJs ? [vcJsPath] : []),
      'env',
      'add',
      name,
      '--environment',
      envName,
      '--force',
      '--yes',
      '--non-interactive',
      SENSITIVE.has(name) ? '--sensitive' : '--no-sensitive',
    ];
    const res = spawnSync(useVcJs ? process.execPath : 'vercel', addArgs, {
      input: value,
      encoding: 'utf8',
      timeout: 20000,
      shell: false,
    });
    console.log(`${name} (${envName}): ${res.status === 0 ? 'ok' : 'failed'}`);
    if (res.status !== 0) failures += 1;
  }
}

if (failures > 0) process.exit(1);
