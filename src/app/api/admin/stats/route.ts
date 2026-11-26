import { type NextRequest } from 'next/server';
import { getAdminStats } from '@/lib/db/repositories/audits.repo';
import { getAdminRoiAndAssistantStats } from '@/lib/db/repositories/roi-assistant-analytics.repo';
import { apiSuccess, createRequestId, requireAdminApiAccess } from '@/lib/http/api-helpers';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const requestId = createRequestId();
  const auth = await requireAdminApiAccess(request, requestId);
  if (!auth.ok) return auth.response;

  const [stats, roiAndAssistant] = await Promise.all([
    getAdminStats(),
    getAdminRoiAndAssistantStats(),
  ]);
  return apiSuccess({ ...stats, roiAndAssistant }, 200, requestId);
}

