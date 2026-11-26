import 'server-only';
import {
  checkAndIncrementRateLimit,
  type RateLimitResult,
} from '@/lib/db/repositories/rate-limits.repo';

export async function enforceAuditSubmissionRateLimit(ipHash: string): Promise<{
  allowed: boolean;
  reason?: string;
  resetAt?: number;
}> {
  const hourly = await checkAndIncrementRateLimit(`submit:1h:${ipHash}`, 3600, 3);
  if (!hourly.allowed) {
    return {
      allowed: false,
      reason: 'Too many audit requests from your connection this hour. Please try again later.',
      resetAt: hourly.resetAt,
    };
  }

  const daily = await checkAndIncrementRateLimit(`submit:24h:${ipHash}`, 86400, 10);
  if (!daily.allowed) {
    return {
      allowed: false,
      reason: 'Daily audit submission limit reached for your connection.',
      resetAt: daily.resetAt,
    };
  }

  return { allowed: true };
}

export async function enforcePrecheckRateLimit(ipHash: string): Promise<RateLimitResult> {
  return checkAndIncrementRateLimit(`precheck:1h:${ipHash}`, 3600, 20);
}

export async function enforceAdminLoginRateLimit(ipHash: string): Promise<RateLimitResult> {
  return checkAndIncrementRateLimit(`admin-login:15m:${ipHash}`, 900, 5);
}

export async function enforceIntentRateLimit(publicToken: string): Promise<RateLimitResult> {
  return checkAndIncrementRateLimit(`intent:1h:${publicToken}`, 3600, 5);
}

export async function enforceSupplementRateLimit(publicToken: string): Promise<RateLimitResult> {
  return checkAndIncrementRateLimit(`supplement:1h:${publicToken}`, 3600, 3);
}

export async function enforceRetryRateLimit(publicToken: string): Promise<RateLimitResult> {
  return checkAndIncrementRateLimit(`retry:1h:${publicToken}`, 3600, 5);
}

export async function enforceRoiSaveRateLimit(publicToken: string): Promise<RateLimitResult> {
  return checkAndIncrementRateLimit(`roi-save:1h:${publicToken}`, 3600, 60);
}

