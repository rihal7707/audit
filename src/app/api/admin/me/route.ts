import { type NextRequest } from 'next/server';
import { getAdminConfigStatus } from '@/lib/env';
import { getAuthenticatedAdminSession } from '@/lib/security/admin-auth';
import { apiSuccess, createRequestId } from '@/lib/http/api-helpers';

export async function GET(request: NextRequest) {
  const requestId = createRequestId();
  const config = getAdminConfigStatus();
  if (!config.configured) {
    return apiSuccess(
      { authenticated: false, configured: false, reason: config.reason },
      200,
      requestId,
    );
  }
  const session = await getAuthenticatedAdminSession(request);
  return apiSuccess(
    {
      authenticated: Boolean(session),
      configured: true,
    },
    200,
    requestId,
  );
}

