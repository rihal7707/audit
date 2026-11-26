import 'server-only';
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { getAdminConfigStatus, getEnv } from '@/lib/env';
import {
  ADMIN_COOKIE_NAME,
  ADMIN_CSRF_HEADER,
  ADMIN_SESSION_TTL_SECONDS,
  signAdminSessionToken,
  verifyAdminSessionToken,
  type AdminSessionPayload,
} from './admin-session-token';

export { ADMIN_CSRF_HEADER };

export function verifyAdminPassword(candidate: string): boolean {
  const status = getAdminConfigStatus();
  if (!status.configured) return false;
  const env = getEnv();

  if (env.ADMIN_PASSWORD_HASH) {
    // Supported hash formats:
    // 1) scrypt:<saltHex>:<derivedHex>
    // 2) sha256:<hex>
    const hash = env.ADMIN_PASSWORD_HASH;
    if (hash.startsWith('scrypt:')) {
      const [, saltHex, keyHex] = hash.split(':');
      if (!saltHex || !keyHex) return false;
      const keyBuf = Buffer.from(keyHex, 'hex');
      const derived = crypto.scryptSync(candidate, Buffer.from(saltHex, 'hex'), keyBuf.length);
      if (derived.length !== keyBuf.length) return false;
      return crypto.timingSafeEqual(derived, keyBuf);
    }
    if (hash.startsWith('sha256:')) {
      const hex = hash.slice('sha256:'.length);
      const expected = Buffer.from(hex, 'hex');
      const actual = crypto.createHash('sha256').update(candidate).digest();
      if (actual.length !== expected.length) return false;
      return crypto.timingSafeEqual(actual, expected);
    }
    return false;
  }

  if (!env.ADMIN_PASSWORD) return false;
  const actualDigest = crypto.createHash('sha256').update(candidate).digest();
  const expectedDigest = crypto.createHash('sha256').update(env.ADMIN_PASSWORD).digest();
  return crypto.timingSafeEqual(actualDigest, expectedDigest);
}

export function shouldUseSecureAdminCookie(): boolean {
  const env = getEnv();
  return (
    env.NODE_ENV === 'production' ||
    env.NEXT_PUBLIC_APP_URL.startsWith('https://') ||
    env.NEXT_PUBLIC_APP_URL.includes('localhost')
  );
}

export async function createAdminCookieValue(): Promise<string> {
  const env = getEnv();
  if (!env.ADMIN_SESSION_SECRET) {
    throw new Error('ADMIN_SESSION_SECRET is not configured');
  }
  return signAdminSessionToken(env.ADMIN_SESSION_SECRET, ADMIN_SESSION_TTL_SECONDS);
}

export async function getAuthenticatedAdminSession(
  request?: Request | NextRequest,
): Promise<AdminSessionPayload | null> {
  const status = getAdminConfigStatus();
  if (!status.configured) return null;
  const env = getEnv();

  let token: string | undefined;
  if (request && 'cookies' in request && typeof request.cookies?.get === 'function') {
    token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  } else if (request) {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${ADMIN_COOKIE_NAME}=`));
    token = match ? decodeURIComponent(match.slice(ADMIN_COOKIE_NAME.length + 1)) : undefined;
  } else {
    const store = await cookies();
    token = store.get(ADMIN_COOKIE_NAME)?.value;
  }

  return verifyAdminSessionToken(token, env.ADMIN_SESSION_SECRET);
}

export function verifyAdminCsrf(request: Request | NextRequest): {
  ok: boolean;
  reason?: string;
} {
  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return { ok: true };
  }

  const csrfHeader = request.headers.get(ADMIN_CSRF_HEADER);
  if (csrfHeader !== '1') {
    return { ok: false, reason: 'Missing required CSRF verification header.' };
  }

  const env = getEnv();
  const allowedOrigins = new Set<string>();
  try {
    allowedOrigins.add(new URL(env.NEXT_PUBLIC_APP_URL).origin);
  } catch {
    return { ok: false, reason: 'Server origin configuration is invalid.' };
  }
  for (const vercelHost of [
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ]) {
    if (vercelHost && vercelHost.trim().length > 0) {
      allowedOrigins.add(`https://${vercelHost.trim().replace(/^https?:\/\//i, '')}`);
    }
  }

  // Also accept request's own host origin (respecting x-forwarded-host only when TRUST_PROXY is enabled)
  const reqHost =
    (env.TRUST_PROXY ? request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() : undefined) ||
    request.headers.get('host')?.trim();
  if (reqHost) {
    const reqProto =
      (env.TRUST_PROXY ? request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() : undefined) ||
      (reqHost.startsWith('localhost') || reqHost.startsWith('127.0.0.1') ? 'http' : 'https');
    allowedOrigins.add(`${reqProto}://${reqHost}`);
  }

  const origin = request.headers.get('origin');
  if (origin) {
    if (!allowedOrigins.has(origin)) {
      return { ok: false, reason: 'Request origin mismatch.' };
    }
    return { ok: true };
  }

  const referer = request.headers.get('referer');
  if (referer) {
    try {
      if (allowedOrigins.has(new URL(referer).origin)) {
        return { ok: true };
      }
    } catch {
      return { ok: false, reason: 'Invalid referer header.' };
    }
  }

  return { ok: false, reason: 'Origin header is required for state-changing admin requests.' };
}
