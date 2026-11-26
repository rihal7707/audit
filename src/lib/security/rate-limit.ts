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

export async function enforceAssistantRateLimits(params: {
  ipHash: string;
  publicToken: string;
  dailyLimit: number;
}): Promise<{ allowed: boolean; reason?: string }> {
  const perIp = await checkAndIncrementRateLimit(`assistant-ip:1h:${params.ipHash}`, 3600, 30);
  if (!perIp.allowed) {
    return { allowed: false, reason: 'Too many assistant requests from your connection. Please try again later.' };
  }
  const perToken = await checkAndIncrementRateLimit(`assistant-tok:10m:${params.publicToken}`, 600, 8);
  if (!perToken.allowed) {
    return { allowed: false, reason: 'Please wait a moment before sending more messages for this report.' };
  }
  if (params.dailyLimit <= 0) {
    return { allowed: false, reason: 'Daily assistant call cap has been reached.' };
  }
  const daily = await checkAndIncrementRateLimit('assistant-global:24h', 86400, params.dailyLimit);
  if (!daily.allowed) {
    return { allowed: false, reason: 'Daily AI assistant capacity has been reached. Please try again tomorrow.' };
  }
  return { allowed: true };
}

