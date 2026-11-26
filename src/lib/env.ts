import 'server-only';
import { z } from 'zod';
import { getAppUrl } from '@/lib/config/app-url';

const optionalNonEmpty = z
  .string()
  .optional()
  .transform((v) => (v && v.trim().length > 0 ? v.trim() : undefined));

const emptyToUndefined = (v: unknown) =>
  typeof v === 'string' && v.trim().length === 0 ? undefined : v;

const boolEnv = (fallback: boolean | (() => boolean)) =>
  z.preprocess(
    emptyToUndefined,
    z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v === undefined ? (typeof fallback === 'function' ? fallback() : fallback) : v === 'true')),
  );

const intEnv = (min: number, max: number, fallback: number) =>
  z.preprocess(emptyToUndefined, z.coerce.number().int().min(min).max(max).optional().default(fallback));

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  GEMINI_API_KEY: optionalNonEmpty,
  GEMINI_MODEL: z.preprocess(emptyToUndefined, z.string().trim().min(1).default('gemini-3.8-flash')),
  GEMINI_FALLBACK_MODEL: optionalNonEmpty,
  GEMINI_PAID_TIER: boolEnv(false),
  DATABASE_URL: z.preprocess(emptyToUndefined, z.string().trim().min(1).default('file:./data/amarketing.db')),
  DATABASE_AUTH_TOKEN: optionalNonEmpty,
  ADMIN_PASSWORD: optionalNonEmpty,
  ADMIN_PASSWORD_HASH: optionalNonEmpty,
  ADMIN_SESSION_SECRET: optionalNonEmpty,
  NEXT_PUBLIC_APP_URL: optionalNonEmpty.refine(
    (v) => !v || /^https?:\/\//i.test(v),
    'NEXT_PUBLIC_APP_URL must be an http(s) URL',
  ),
  NEXT_PUBLIC_BOOKING_URL: optionalNonEmpty.refine(
    (v) => !v || /^https?:\/\//i.test(v),
    'NEXT_PUBLIC_BOOKING_URL must be an http(s) URL',
  ),
  BUSINESS_CONTACT_EMAIL: optionalNonEmpty,
  RESEND_API_KEY: optionalNonEmpty,
  FROM_EMAIL: optionalNonEmpty,
  NOTIFY_WEBHOOK_URL: optionalNonEmpty,
  TURNSTILE_SITE_KEY: optionalNonEmpty,
  TURNSTILE_SECRET_KEY: optionalNonEmpty,
  CRON_SECRET: optionalNonEmpty,
  SMOKE_TEST_SECRET: optionalNonEmpty,
  VERCEL_AUTOMATION_BYPASS_SECRET: optionalNonEmpty,
  VIDEO_STORAGE: z.preprocess(emptyToUndefined, z.enum(['local', 'remote', 'disabled']).default('local')),
  REPORT_RELEASE_MODE: z.preprocess(emptyToUndefined, z.enum(['auto', 'review']).default('auto')),
  MAX_AUDITS_PER_DAY: intEnv(0, 10000, 40),
  DATA_RETENTION_DAYS: intEnv(1, 3650, 180),
  CRAWL_CACHE_TTL_HOURS: intEnv(1, 720, 24),
  TRUST_PROXY: boolEnv(() => Boolean(process.env.VERCEL)),
  ASSISTANT_ENABLED: boolEnv(true),
  ASSISTANT_MAX_USER_MESSAGES_PER_AUDIT: intEnv(1, 200, 10),
  ASSISTANT_MAX_MESSAGE_CHARS: intEnv(50, 20000, 3000),
  ASSISTANT_HISTORY_MESSAGES: intEnv(0, 50, 6),
  ASSISTANT_MAX_OUTPUT_TOKENS: intEnv(100, 4096, 800),
  ASSISTANT_MAX_CALLS_PER_DAY: intEnv(0, 100000, 200),
});

export type AppEnv = Omit<z.infer<typeof envSchema>, 'NEXT_PUBLIC_APP_URL'> & {
  NEXT_PUBLIC_APP_URL: string;
};

let cachedEnv: AppEnv | null = null;
let cachedEnvFingerprint: string | null = null;

function resolveRawEnv(source: Record<string, string | undefined> = process.env): Record<string, string | undefined> {
  const raw = { ...source };
  const primaryDb = raw.DATABASE_URL?.trim();
  const tursoDb = raw.TURSO_DATABASE_URL?.trim() || raw.LIBSQL_DATABASE_URL?.trim() || raw.LIBSQL_URL?.trim();
  if ((!primaryDb || primaryDb.startsWith('file:')) && tursoDb) {
    raw.DATABASE_URL = tursoDb;
  }
  const primaryToken = raw.DATABASE_AUTH_TOKEN?.trim();
  const tursoToken = raw.TURSO_AUTH_TOKEN?.trim() || raw.LIBSQL_AUTH_TOKEN?.trim();
  if (!primaryToken && tursoToken) {
    raw.DATABASE_AUTH_TOKEN = tursoToken;
  }
  return raw;
}

function computeEnvFingerprint(): string {
  return [
    process.env.NODE_ENV,
    process.env.NEXT_PHASE,
    process.env.VERCEL,
    process.env.VERCEL_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_MODEL,
    process.env.GEMINI_FALLBACK_MODEL,
    process.env.GEMINI_PAID_TIER,
    process.env.DATABASE_URL,
    process.env.DATABASE_AUTH_TOKEN,
    process.env.TURSO_DATABASE_URL,
    process.env.TURSO_AUTH_TOKEN,
    process.env.ADMIN_PASSWORD,
    process.env.ADMIN_PASSWORD_HASH,
    process.env.ADMIN_SESSION_SECRET,
    process.env.MAX_AUDITS_PER_DAY,
    process.env.REPORT_RELEASE_MODE,
    process.env.CRON_SECRET,
    process.env.SMOKE_TEST_SECRET,
    process.env.TRUST_PROXY,
    process.env.VIDEO_STORAGE,
    process.env.ASSISTANT_ENABLED,
  ].join('|');
}

export function getEnv(): AppEnv {
  const fp = computeEnvFingerprint();
  if (cachedEnv && cachedEnvFingerprint === fp) return cachedEnv;

  const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';
  const raw = resolveRawEnv();
  const parsed = envSchema.safeParse(raw);

  if (!parsed.success) {
    if (isBuildPhase) {
      return {
        ...(envSchema.parse({})),
        NEXT_PUBLIC_APP_URL: getAppUrl(),
      };
    }
    const issueSummary = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${issueSummary}`);
  }

  cachedEnv = {
    ...parsed.data,
    NEXT_PUBLIC_APP_URL: parsed.data.NEXT_PUBLIC_APP_URL ?? getAppUrl(),
  };
  cachedEnvFingerprint = fp;
  return cachedEnv;
}

export function resetEnvCache(): void {
  cachedEnv = null;
  cachedEnvFingerprint = null;
}

export function isGeminiConfigured(): boolean {
  return Boolean(getEnv().GEMINI_API_KEY);
}

export interface AdminConfigStatus {
  configured: boolean;
  reason?: string;
}

export function getAdminConfigStatus(): AdminConfigStatus {
  const e = getEnv();
  if (!e.ADMIN_PASSWORD && !e.ADMIN_PASSWORD_HASH) {
    return { configured: false, reason: 'Set ADMIN_PASSWORD (or ADMIN_PASSWORD_HASH) to enable the admin portal.' };
  }
  if (!e.ADMIN_SESSION_SECRET) {
    return { configured: false, reason: 'Set ADMIN_SESSION_SECRET (minimum 32 characters) to enable the admin portal.' };
  }
  if (e.NODE_ENV === 'production') {
    if (e.ADMIN_PASSWORD && e.ADMIN_PASSWORD.length < 12) {
      return { configured: false, reason: 'In production, ADMIN_PASSWORD must be at least 12 characters long.' };
    }
    if (e.ADMIN_SESSION_SECRET.length < 32) {
      return { configured: false, reason: 'In production, ADMIN_SESSION_SECRET must be at least 32 characters long.' };
    }
  }
  return { configured: true };
}

export function isEmailConfigured(): boolean {
  const e = getEnv();
  return Boolean(e.RESEND_API_KEY && e.FROM_EMAIL);
}

export function isTurnstileConfigured(): boolean {
  const e = getEnv();
  return Boolean(e.TURNSTILE_SITE_KEY && e.TURNSTILE_SECRET_KEY);
}

export function getVideoRuntimeStatus(): { enabled: boolean; reason?: string } {
  const e = getEnv();
  if (e.VIDEO_STORAGE === 'disabled') return { enabled: false, reason: 'video disabled' };
  if (process.env.VERCEL && e.VIDEO_STORAGE === 'local') {
    return { enabled: false, reason: 'local storage unavailable on Vercel' };
  }
  return { enabled: true };
}

export function getAssistantConfigStatus(): { configured: boolean; enabled: boolean; reason?: string } {
  const e = getEnv();
  if (!e.ASSISTANT_ENABLED) {
    return { configured: false, enabled: false, reason: 'Assistant is currently disabled by site settings.' };
  }
  if (!e.GEMINI_API_KEY) {
    return { configured: false, enabled: true, reason: 'Assistant not available yet — AI service key is not configured.' };
  }
  return { configured: true, enabled: true };
}

export function getMissingOrInvalidEnvNames(): string[] {
  const e = getEnv();
  const missing: string[] = [];
  if (process.env.VERCEL && e.DATABASE_URL.startsWith('file:')) missing.push('DATABASE_URL');
  if (!e.DATABASE_URL.startsWith('file:') && !e.DATABASE_AUTH_TOKEN) missing.push('DATABASE_AUTH_TOKEN');
  if (!e.GEMINI_API_KEY) missing.push('GEMINI_API_KEY');
  if (!e.CRON_SECRET) missing.push('CRON_SECRET');
  if (!getAdminConfigStatus().configured) {
    if (!e.ADMIN_PASSWORD && !e.ADMIN_PASSWORD_HASH) missing.push('ADMIN_PASSWORD');
    if (!e.ADMIN_SESSION_SECRET || (e.NODE_ENV === 'production' && e.ADMIN_SESSION_SECRET.length < 32)) {
      missing.push('ADMIN_SESSION_SECRET');
    }
  }
  return missing;
}
