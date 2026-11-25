import { type NextRequest } from 'next/server';
import {
  AUDIT_STATUSES,
  LEAD_PRIORITIES,
  PIPELINE_STAGES,
  type AuditStatus,
  type LeadPriority,
  type PipelineStage,
} from '@/lib/db/schema';
import {
  listAuditsAdmin,
  type AdminAuditListFilters,
} from '@/lib/db/repositories/audits.repo';
import { apiSuccess, createRequestId, requireAdminApiAccess } from '@/lib/http/api-helpers';

export function parseAdminAuditFilters(searchParams: URLSearchParams): AdminAuditListFilters {
  const parseList = <T extends string>(param: string | null, valid: readonly T[]): T[] => {
    if (!param) return [];
    const allowed = new Set<string>(valid);
    return param
      .split(',')
      .map((s) => s.trim())
      .filter((s): s is T => allowed.has(s));
  };

  const page = Number(searchParams.get('page') || '1') || 1;
  const pageSize = Number(searchParams.get('pageSize') || '20') || 20;
  const sortByRaw = searchParams.get('sortBy');
  const sortBy =
    sortByRaw === 'leadScore' || sortByRaw === 'businessName' ? sortByRaw : 'createdAt';
  const sortDir = searchParams.get('sortDir') === 'asc' ? 'asc' : 'desc';

  return {
    search: searchParams.get('search') || undefined,
    stages: parseList<PipelineStage>(searchParams.get('stages'), PIPELINE_STAGES),
    priorities: parseList<LeadPriority>(searchParams.get('priorities'), LEAD_PRIORITIES),
    statuses: parseList<AuditStatus>(searchParams.get('statuses'), AUDIT_STATUSES),
    industry: searchParams.get('industry') || undefined,
    dateFrom: searchParams.get('dateFrom') || undefined,
    dateTo: searchParams.get('dateTo') || undefined,
    page,
    pageSize,
    sortBy,
    sortDir,
  };
}

export async function GET(request: NextRequest) {
  const requestId = createRequestId();
  const auth = await requireAdminApiAccess(request, requestId);
  if (!auth.ok) return auth.response;

  const filters = parseAdminAuditFilters(request.nextUrl.searchParams);
  const result = await listAuditsAdmin(filters);
  return apiSuccess(result, 200, requestId);
}

