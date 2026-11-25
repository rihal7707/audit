import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getAdminConfigStatus } from '@/lib/env';
import {
  createAdminCookieValue,
  shouldUseSecureAdminCookie,
  verifyAdminPassword,
} from '@/lib/security/admin-auth';
import { ADMIN_COOKIE_NAME, ADMIN_SESSION_TTL_SECONDS } from '@/lib/security/admin-session-token';
import { enforceAdminLoginRateLimit } from '@/lib/security/rate-limit';
import { getClientIpHash } from '@/lib/security/tokens';
import { apiError, createRequestId } from '@/lib/http/api-helpers';

const LoginSchema = z.object({
  password: z.string().min(1, 'Password is required.'),
});

export async function POST(request: NextRequest) {
  const requestId = createRequestId();
  const configStatus = getAdminConfigStatus();
  if (!configStatus.configured) {
    return apiError(configStatus.reason || 'Admin portal is not configured.', 503, requestId);
  }

  const ipHash = getClientIpHash(request);
  const rl = await enforceAdminLoginRateLimit(ipHash);
  if (!rl.allowed) {
    return apiError(
      'Too many login attempts. Please wait 15 minutes before trying again.',
      429,
      requestId,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('Invalid JSON request body.', 400, requestId);
  }

  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('Please enter your admin password.', 400, requestId);
  }

  const valid = verifyAdminPassword(parsed.data.password);
  if (!valid) {
    // Incremental delay on invalid login attempt
    const delayMs = Math.min(1500, rl.count * 250);
    await new Promise((r) => setTimeout(r, delayMs));
    return apiError('Invalid credentials.', 401, requestId);
  }

  const token = await createAdminCookieValue();
  const response = NextResponse.json(
    { authenticated: true },
    { status: 200, headers: { 'Cache-Control': 'no-store', 'X-Request-Id': requestId } },
  );

  response.cookies.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: shouldUseSecureAdminCookie(),
    path: '/',
    maxAge: ADMIN_SESSION_TTL_SECONDS,
  });

  return response;
}

