import { NextResponse, type NextRequest } from 'next/server';
import { exportAuditsAdmin } from '@/lib/db/repositories/audits.repo';
import { buildAuditsCsv } from '@/lib/admin/csv-export';
import { parseAdminAuditFilters } from '@/app/api/admin/audits/route';
import { createRequestId, requireAdminApiAccess } from '@/lib/http/api-helpers';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const requestId = createRequestId();
  const auth = await requireAdminApiAccess(request, requestId);
  if (!auth.ok) return auth.response;

  const filters = parseAdminAuditFilters(request.nextUrl.searchParams);
  const rows = await exportAuditsAdmin(filters);
  const csv = buildAuditsCsv(rows);
  const dateStr = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="amarketing-audits-${dateStr}.csv"`,
      'Cache-Control': 'private, no-store',
      'X-Request-Id': requestId,
    },
  });
}

