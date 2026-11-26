import 'server-only';
import { z } from 'zod';

const optionalNonEmpty = z
  .string()
  .optional()
  .transform((v) => (v && v.trim().length > 0 ? v.trim() : undefined));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  GEMINI_API_KEY: optionalNonEmpty,
  GEMINI_MODEL: z.string().trim().min(1).default('gemini-3.8-flash'),
  GEMINI_FALLBACK_MODEL: optionalNonEmpty,
  GEMINI_PAID_TIER: z
    .enum(['true', 'false'])
    .optional()
    .default('false')
    .transform((v) => v === 'true'),
  DATABASE_URL: z.string().trim().min(1).default('file:./data/amarketing.db'),
  DATABASE_AUTH_TOKEN: optionalNonEmpty,
  ADMIN_PASSWORD: optionalNonEmpty,
  ADMIN_PASSWORD_HASH: optionalNonEmpty,
  ADMIN_SESSION_SECRET: optionalNonEmpty,
  NEXT_PUBLIC_APP_URL: z.string().trim().url().default('http://localhost:3000'),
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
  REPORT_RELEASE_MODE: z.enum(['auto', 'review']).default('auto'),
  MAX_AUDITS_PER_DAY: z.coerce.number().int().nonnegative().max(10000).default(40),
  DATA_RETENTION_DAYS: z.coerce.number().int().positive().max(3650).default(180),
  CRAWL_CACHE_TTL_HOURS: z.coerce.number().int().positive().max(720).default(24),
  TRUST_PROXY: z
    .enum(['true', 'false'])
    .optional()
    .default('false')
    .transform((v) => v === 'true'),
  ASSISTANT_ENABLED: z
    .enum(['true', 'false'])
    .optional()
    .default('true')
    .transform((v) => v === 'true'),
  ASSISTANT_MAX_USER_MESSAGES_PER_AUDIT: z.coerce.number().int().min(1).max(200).default(10),
  ASSISTANT_MAX_MESSAGE_CHARS: z.coerce.number().int().min(50).max(20000).default(3000),
  ASSISTANT_HISTORY_MESSAGES: z.coerce.number().int().min(0).max(50).default(6),
  ASSISTANT_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(100).max(4096).default(800),
  ASSISTANT_MAX_CALLS_PER_DAY: z.coerce.number().int().min(0).max(100000).default(200),
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | null = null;
let cachedEnvFingerprint: string | null = null;

function computeEnvFingerprint(): string {
  return [
    process.env.NODE_ENV,
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_MODEL,
    process.env.GEMINI_FALLBACK_MODEL,
    process.env.GEMINI_PAID_TIER,
    process.env.DATABASE_URL,
    process.env.ADMIN_PASSWORD,
    process.env.ADMIN_PASSWORD_HASH,
    process.env.ADMIN_SESSION_SECRET,
    process.env.MAX_AUDITS_PER_DAY,
    process.env.REPORT_RELEASE_MODE,
    process.env.CRON_SECRET,
    process.env.ASSISTANT_ENABLED,
    process.env.ASSISTANT_MAX_USER_MESSAGES_PER_AUDIT,
    process.env.ASSISTANT_MAX_MESSAGE_CHARS,
    process.env.ASSISTANT_HISTORY_MESSAGES,
    process.env.ASSISTANT_MAX_OUTPUT_TOKENS,
    process.env.ASSISTANT_MAX_CALLS_PER_DAY,
  ].join('|');
}

export function getEnv(): AppEnv {
  const fp = computeEnvFingerprint();
  if (cachedEnv && cachedEnvFingerprint === fp) return cachedEnv;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issueSummary = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${issueSummary}`);
  }
  cachedEnv = parsed.data;
  cachedEnvFingerprint = fp;
  return cachedEnv;
}

export function resetEnvCache(): void {
  cachedEnv = null;
  cachedEnvFingerprint = null;
}

export function isGeminiConfigured(): boolean {
  const e = getEnv();
  return Boolean(e.GEMINI_API_KEY);
}

export interface AdminConfigStatus {
  configured: boolean;
  reason?: string;
}

export function getAdminConfigStatus(): AdminConfigStatus {
  const e = getEnv();
  const hasPassword = Boolean(e.ADMIN_PASSWORD || e.ADMIN_PASSWORD_HASH);
  if (!hasPassword) {
    return {
      configured: false,
      reason: 'Set ADMIN_PASSWORD (or ADMIN_PASSWORD_HASH) in your environment to enable the admin portal.',
    };
  }
  if (!e.ADMIN_SESSION_SECRET) {
    return {
      configured: false,
      reason: 'Set ADMIN_SESSION_SECRET (minimum 32 characters) in your environment to enable the admin portal.',
    };
  }
  if (e.NODE_ENV === 'production') {
    if (e.ADMIN_PASSWORD && e.ADMIN_PASSWORD.length < 12) {
      return {
        configured: false,
        reason: 'In production, ADMIN_PASSWORD must be at least 12 characters long.',
      };
    }
    if (e.ADMIN_SESSION_SECRET.length < 32) {
      return {
        configured: false,
        reason: 'In production, ADMIN_SESSION_SECRET must be at least 32 characters long.',
      };
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

export function getAssistantConfigStatus(): { configured: boolean; enabled: boolean; reason?: string } {
  const e = getEnv();
  if (!e.ASSISTANT_ENABLED) {
    return { configured: false, enabled: false, reason: 'Assistant is currently disabled by site settings.' };
  }
  if (!e.GEMINI_API_KEY) {
    return {
      configured: false,
      enabled: true,
      reason: 'Assistant not available yet — AI service key is not configured.',
    };
  }
  return { configured: true, enabled: true };
}
