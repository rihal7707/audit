import 'server-only';
import crypto from 'node:crypto';
import type { NextRequest } from 'next/server';
import { getEnv } from '@/lib/env';

export function generatePublicToken(): string {
  return crypto.randomBytes(24).toString('base64url'); // 192 bits >= 128 bits
}

export function getHashSecret(): string {
  const env = getEnv();
  return (
    env.ADMIN_SESSION_SECRET ||
    env.CRON_SECRET ||
    `amarketing-fallback-salt:${env.DATABASE_URL}`
  );
}

export function hashIdentifier(value: string): string {
  return crypto.createHmac('sha256', getHashSecret()).update(value).digest('hex');
}

export function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function getClientIp(request: Request | NextRequest): string {
  const env = getEnv();
  if (env.TRUST_PROXY) {
    const xff = request.headers.get('x-forwarded-for');
    if (xff) {
      const first = xff.split(',')[0]?.trim();
      if (first) return first;
    }
    const realIp = request.headers.get('x-real-ip')?.trim();
    if (realIp) return realIp;
  }
  const direct = request.headers.get('x-amk-direct-ip')?.trim();
  return direct || 'untrusted-client';
}

export function getClientIpHash(request: Request | NextRequest): string {
  return hashIdentifier(`ip:${getClientIp(request)}`);
}

export function buildDedupeKey(normalizedDomain: string, email: string): string {
  const cleanDomain = normalizedDomain.trim().toLowerCase();
  const cleanEmail = email.trim().toLowerCase();
  return sha256Hex(`${cleanDomain}::${cleanEmail}`);
}

