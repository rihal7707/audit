// scripts/env-check.mjs
// Validates .env.vercel (without printing secret values) and generates strong random secrets when absent.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const envPath = path.resolve(process.cwd(), '.env.vercel');

function parseEnvLines(raw) {
  const map = new Map();
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const idx = t.indexOf('=');
    const k = t.slice(0, idx).trim();
    const v = t.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    map.set(k, v);
  }
  return map;
}

if (!fs.existsSync(envPath)) {
  console.error('Missing .env.vercel. Copy .env.vercel.example to .env.vercel first.');
  process.exit(1);
}

const raw = fs.readFileSync(envPath, 'utf8');
const env = parseEnvLines(raw);
const generated = [];

function ensureSecret(key, genFn) {
  const cur = env.get(key) || '';
  if (!cur) {
    const val = genFn();
    env.set(key, val);
    generated.push(key);
  }
}

ensureSecret('ADMIN_PASSWORD', () => `AmkProd!${crypto.randomBytes(12).toString('hex')}`);
ensureSecret('ADMIN_SESSION_SECRET', () => crypto.randomBytes(32).toString('hex'));
ensureSecret('CRON_SECRET', () => crypto.randomBytes(24).toString('hex'));
ensureSecret('SMOKE_TEST_SECRET', () => crypto.randomBytes(24).toString('hex'));

if (generated.length > 0) {
  const lines = raw.split(/\r?\n/);
  const updatedSet = new Set();
  const out = lines.map((line) => {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) return line;
    const k = t.slice(0, t.indexOf('=')).trim();
    if (generated.includes(k)) {
      updatedSet.add(k);
      return `${k}=${env.get(k)}`;
    }
    return line;
  });
  for (const k of generated) {
    if (!updatedSet.has(k)) out.push(`${k}=${env.get(k)}`);
  }
  fs.writeFileSync(envPath, out.join('\n').replace(/\n*$/, '\n'), 'utf8');
  console.log(`Generated strong random secrets into .env.vercel for: ${generated.join(', ')}`);
}

const dbUrl = env.get('DATABASE_URL') || env.get('TURSO_DATABASE_URL') || '';
const dbTok = env.get('DATABASE_AUTH_TOKEN') || env.get('TURSO_AUTH_TOKEN') || '';
const adminPass = env.get('ADMIN_PASSWORD') || '';
const adminHash = env.get('ADMIN_PASSWORD_HASH') || '';
const sessionSecret = env.get('ADMIN_SESSION_SECRET') || '';

const issues = [];
if (!dbUrl) issues.push('DATABASE_URL (missing)');
else if (dbUrl.startsWith('file:')) issues.push('DATABASE_URL (file: scheme invalid for production)');
if (!dbTok) issues.push('DATABASE_AUTH_TOKEN (missing)');
if (!env.get('GEMINI_API_KEY')) issues.push('GEMINI_API_KEY (missing)');
if (!adminPass && !adminHash) issues.push('ADMIN_PASSWORD (missing)');
else if (adminPass && adminPass.length < 12) issues.push('ADMIN_PASSWORD (< 12 chars)');
if (!sessionSecret || sessionSecret.length < 32) issues.push('ADMIN_SESSION_SECRET (< 32 chars)');
if (!env.get('CRON_SECRET')) issues.push('CRON_SECRET (missing)');
const appUrl = env.get('NEXT_PUBLIC_APP_URL') || '';
if (appUrl && !/^https?:\/\//i.test(appUrl)) issues.push('NEXT_PUBLIC_APP_URL (invalid URL)');

if (issues.length > 0) {
  console.log('INVALID OR MISSING ENV NAMES:', issues.join(', '));
  process.exit(1);
}

console.log('ENV CHECK OK: All required production variables in .env.vercel passed validation.');
