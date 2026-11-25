import 'server-only';
import crypto from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { getAdminConfigStatus } from '@/lib/env';
import {
  getAuthenticatedAdminSession,
  verifyAdminCsrf,
} from '@/lib/security/admin-auth';

export function createRequestId(): string {
  return crypto.randomUUID();
}

export function apiError(
  message: string,
  status: number,
  requestId: string,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json(
    {
      error: message,
      requestId,
      ...extra,
    },
    {
      status,
      headers: {
        'X-Request-Id': requestId,
        'Cache-Control': 'no-store',
      },
    },
  );
}

export function apiSuccess<T>(data: T, status = 200, requestId?: string, cacheControl = 'no-store') {
  const headers: Record<string, string> = {
    'Cache-Control': cacheControl,
  };
  if (requestId) headers['X-Request-Id'] = requestId;
  return NextResponse.json(data, { status, headers });
}

export async function requireAdminApiAccess(
  request: NextRequest,
  requestId: string,
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const config = getAdminConfigStatus();
  if (!config.configured) {
    return {
      ok: false,
      response: apiError(config.reason || 'Admin portal is not configured.', 503, requestId),
    };
  }

  const session = await getAuthenticatedAdminSession(request);
  if (!session) {
    return {
      ok: false,
      response: apiError('Authentication required.', 401, requestId),
    };
  }

  const csrf = verifyAdminCsrf(request);
  if (!csrf.ok) {
    return {
      ok: false,
      response: apiError(csrf.reason || 'CSRF validation failed.', 403, requestId),
    };
  }

  return { ok: true };
}

