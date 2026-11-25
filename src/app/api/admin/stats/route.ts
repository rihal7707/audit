import { type NextRequest } from 'next/server';
import { getAdminStats } from '@/lib/db/repositories/audits.repo';
import { apiSuccess, createRequestId, requireAdminApiAccess } from '@/lib/http/api-helpers';

export async function GET(request: NextRequest) {
  const requestId = createRequestId();
  const auth = await requireAdminApiAccess(request, requestId);
  if (!auth.ok) return auth.response;

  const stats = await getAdminStats();
  return apiSuccess(stats, 200, requestId);
}

