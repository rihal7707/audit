import { NextResponse, type NextRequest } from 'next/server';
import { ADMIN_COOKIE_NAME } from '@/lib/security/admin-session-token';
import { shouldUseSecureAdminCookie, verifyAdminCsrf } from '@/lib/security/admin-auth';
import { apiError, createRequestId } from '@/lib/http/api-helpers';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const requestId = createRequestId();
  const csrf = verifyAdminCsrf(request);
  if (!csrf.ok) {
    return apiError(csrf.reason || 'CSRF check failed.', 403, requestId);
  }

  const response = NextResponse.json(
    { authenticated: false },
    { status: 200, headers: { 'Cache-Control': 'no-store', 'X-Request-Id': requestId } },
  );

  response.cookies.set(ADMIN_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'strict',
    secure: shouldUseSecureAdminCookie(),
    path: '/',
    maxAge: 0,
  });

  return response;
}

