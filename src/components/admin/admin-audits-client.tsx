'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  Download,
  Inbox,
  Search,
} from 'lucide-react';
import type { AuditRow } from '@/lib/db/repositories/audits.repo';
import {
  LEAD_PRIORITIES,
  PIPELINE_STAGES,
} from '@/lib/db/schema';
import { INDUSTRIES } from '@/lib/config/industries';
import { cn, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  AuditStatusBadge,
  LeadPriorityBadge,
  PipelineStageBadge,
} from '@/components/ui/badges';
import { EmptyState, Skeleton } from '@/components/ui/overlays';

interface AuditsResponse {
  items: AuditRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function AdminAuditsClient() {
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get('search') || '';

  const [search, setSearch] = React.useState(initialSearch);
  const [selectedStages, setSelectedStages] = React.useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = React.useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = React.useState<string[]>([]);
  const [industry, setIndustry] = React.useState('');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [sortBy, setSortBy] = React.useState<'createdAt' | 'leadScore' | 'businessName'>('createdAt');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');
  const [page, setPage] = React.useState(1);
  const [density, setDensity] = React.useState<'comfortable' | 'compact'>('comfortable');

  const [data, setData] = React.useState<AuditsResponse | null>(null);
  const [loading, setLoading] = React.useState(true);

  const buildQueryString = React.useCallback(
    (includePagination = true) => {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (selectedStages.length > 0) params.set('stages', selectedStages.join(','));
      if (selectedPriorities.length > 0) params.set('priorities', selectedPriorities.join(','));
      if (selectedStatuses.length > 0) params.set('statuses', selectedStatuses.join(','));
      if (industry) params.set('industry', industry);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', `${dateTo}T23:59:59.999Z`);
      params.set('sortBy', sortBy);
      params.set('sortDir', sortDir);
      if (includePagination) {
        params.set('page', String(page));
        params.set('pageSize', '20');
      }
      return params.toString();
    },
    [
      search,
      selectedStages,
      selectedPriorities,
      selectedStatuses,
      industry,
      dateFrom,
      dateTo,
      sortBy,
      sortDir,
      page,
    ],
  );

  React.useEffect(() => {
    let active = true;
    const qs = buildQueryString(true);
    fetch(`/api/admin/audits?${qs}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((json: AuditsResponse) => {
        if (active) setData(json);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [buildQueryString]);

  const toggleMulti = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    value: string,
  ) => {
    setPage(1);
    setter((prev) =>
      prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value],
    );
  };

  const toggleSort = (col: 'createdAt' | 'leadScore' | 'businessName') => {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
  };

  const exportUrl = `/api/admin/export?${buildQueryString(false)}`;
  const cellPad = density === 'compact' ? 'py-2' : 'py-3.5';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Audits &amp; Leads</h1>
          <p className="text-sm text-muted">
            Search, filter, update pipeline stages, and export filtered prospects to CSV.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-border bg-surface p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setDensity('comfortable')}
              className={cn(
                'rounded px-2.5 py-1.5 font-medium cursor-pointer',
                density === 'comfortable' ? 'bg-navy-900 text-white' : 'text-muted hover:text-ink',
              )}
            >
              Comfortable
            </button>
            <button
              type="button"
              onClick={() => setDensity('compact')}
              className={cn(
                'rounded px-2.5 py-1.5 font-medium cursor-pointer',
                density === 'compact' ? 'bg-navy-900 text-white' : 'text-muted hover:text-ink',
              )}
            >
              Compact
            </button>
          </div>

          <a
            href={exportUrl}
            className="inline-flex min-h-[40px] items-center gap-2 rounded border border-border bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-subtle"
          >
            <Download className="h-4 w-4 text-teal-700" aria-hidden="true" />
            Export CSV
          </a>
        </div>
      </div>

      {/* Filters Toolbar */}
      <Card className="p-4 space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              placeholder="Search business, website, contact name, or email..."
              aria-label="Filter audits by text"
              className="h-11 w-full rounded border border-border bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-muted focus:border-navy-800 focus:outline-none"
            />
          </div>

          <select
            aria-label="Filter by industry"
            value={industry}
            onChange={(e) => {
              setPage(1);
              setIndustry(e.target.value);
            }}
            className="h-11 rounded border border-border bg-surface px-3 text-sm text-ink"
          >
            <option value="">All industries</option>
            {INDUSTRIES.map((ind) => (
              <option key={ind.value} value={ind.value}>
                {ind.label}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              aria-label="From date"
              value={dateFrom}
              onChange={(e) => {
                setPage(1);
                setDateFrom(e.target.value);
              }}
              className="h-11 rounded border border-border bg-surface px-2.5 text-xs text-ink"
            />
            <input
              type="date"
              aria-label="To date"
              value={dateTo}
              onChange={(e) => {
                setPage(1);
                setDateTo(e.target.value);
              }}
              className="h-11 rounded border border-border bg-surface px-2.5 text-xs text-ink"
            />
          </div>
        </div>

        {/* Multi-select filter chips */}
        <div className="flex flex-wrap items-center gap-4 border-t border-border pt-3 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-muted mr-1">Priority:</span>
            {LEAD_PRIORITIES.map((p) => {
              const active = selectedPriorities.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => toggleMulti(setSelectedPriorities, p)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 font-medium cursor-pointer',
                    active
                      ? 'border-navy-900 bg-navy-900 text-white'
                      : 'border-border bg-canvas text-muted hover:text-ink',
                  )}
                >
                  {p}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-muted mr-1">Stage:</span>
            {PIPELINE_STAGES.map((s) => {
              const active = selectedStages.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleMulti(setSelectedStages, s)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 font-medium cursor-pointer',
                    active
                      ? 'border-navy-900 bg-navy-900 text-white'
                      : 'border-border bg-canvas text-muted hover:text-ink',
                  )}
                >
                  {s.replace(/_/g, ' ')}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-muted mr-1">Status:</span>
            {(['COMPLETED', 'COMPLETED_LIMITED', 'PENDING_REVIEW', 'WAITING_FOR_QUOTA', 'FAILED', 'QUEUED'] as const).map(
              (st) => {
                const active = selectedStatuses.includes(st);
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => toggleMulti(setSelectedStatuses, st)}
                    className={cn(
                      'rounded-full border px-2.5 py-1 font-medium cursor-pointer',
                      active
                        ? 'border-navy-900 bg-navy-900 text-white'
                        : 'border-border bg-canvas text-muted hover:text-ink',
                    )}
                  >
                    {st.replace(/_/g, ' ')}
                  </button>
                );
              },
            )}
          </div>
        </div>
      </Card>

      {/* Results Table (Desktop) & Cards (Mobile) */}
      {loading && !data ? (
        <Skeleton className="h-80 w-full rounded-lg" />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-6 w-6" aria-hidden="true" />}
          title="No audits match these filters"
          description="Try clearing your search or expanding the date and stage filters."
          action={
            <Button
              variant="outline"
              onClick={() => {
                setSearch('');
                setSelectedStages([]);
                setSelectedPriorities([]);
                setSelectedStatuses([]);
                setIndustry('');
                setDateFrom('');
                setDateTo('');
                setPage(1);
              }}
            >
              Reset all filters
            </Button>
          }
        />
      ) : (
        <>
          {/* Desktop sticky-header table */}
          <Card className="hidden md:block overflow-hidden">
            <div className="max-h-[70vh] overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 z-10 border-b border-border bg-subtle text-xs uppercase text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">
                      <button
                        type="button"
                        onClick={() => toggleSort('businessName')}
                        className="inline-flex items-center gap-1 cursor-pointer hover:text-ink"
                      >
                        Business &amp; Website
                        <ArrowDownUp className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </th>
                    <th className="px-3 py-3 font-medium">Contact</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-3 py-3 font-medium">
                      <button
                        type="button"
                        onClick={() => toggleSort('leadScore')}
                        className="inline-flex items-center gap-1 cursor-pointer hover:text-ink"
                      >
                        Lead
                        <ArrowDownUp className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </th>
                    <th className="px-3 py-3 font-medium">Pipeline Stage</th>
                    <th className="px-3 py-3 font-medium">Customer Intent</th>
                    <th className="px-4 py-3 font-medium text-right">
                      <button
                        type="button"
                        onClick={() => toggleSort('createdAt')}
                        className="inline-flex items-center gap-1 cursor-pointer hover:text-ink"
                      >
                        Submitted
                        <ArrowDownUp className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-surface">
                  {data.items.map((a) => {
                    const effectivePriority = a.leadPriorityOverride ?? a.leadPriority;
                    return (
                      <tr key={a.id} className="hover:bg-subtle/40">
                        <td className={cn('px-4 max-w-[240px]', cellPad)}>
                          <Link
                            href={`/admin/audits/${a.id}`}
                            className="font-semibold text-ink hover:text-teal-700 hover:underline block truncate"
                          >
                            {a.businessName}
                          </Link>
                          <div className="flex items-center gap-1.5 text-xs text-muted">
                            <span className="truncate font-mono">{a.normalizedDomain}</span>
                            <span>·</span>
                            <span>{a.industry}</span>
                          </div>
                        </td>
                        <td className={cn('px-3 text-xs', cellPad)}>
                          <p className="font-medium text-ink">{a.contactName}</p>
                          <p className="text-muted truncate max-w-[180px]">{a.contactEmail}</p>
                        </td>
                        <td className={cn('px-3', cellPad)}>
                          <AuditStatusBadge status={a.auditStatus} />
                        </td>
                        <td className={cn('px-3', cellPad)}>
                          <div className="flex items-center gap-1.5">
                            <LeadPriorityBadge priority={effectivePriority} />
                            <span className="text-xs font-medium text-muted tabular-nums">
                              {a.leadScore}
                            </span>
                          </div>
                        </td>
                        <td className={cn('px-3', cellPad)}>
                          <PipelineStageBadge stage={a.pipelineStage} />
                        </td>
                        <td className={cn('px-3 text-xs', cellPad)}>
                          <div className="flex flex-wrap gap-1">
                            {a.consultRequestedAt && (
                              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                                Consult requested
                              </span>
                            )}
                            {a.pilotRequestedAt && (
                              <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-800">
                                Pilot requested
                              </span>
                            )}
                            {!a.consultRequestedAt && !a.pilotRequestedAt && (
                              <span className="text-muted">—</span>
                            )}
                          </div>
                        </td>
                        <td className={cn('px-4 text-right text-xs text-muted tabular-nums', cellPad)}>
                          {formatDate(a.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile Card List */}
          <div className="space-y-3 md:hidden">
            {data.items.map((a) => {
              const effectivePriority = a.leadPriorityOverride ?? a.leadPriority;
              return (
                <Card key={a.id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link
                        href={`/admin/audits/${a.id}`}
                        className="font-semibold text-ink hover:underline"
                      >
                        {a.businessName}
                      </Link>
                      <p className="font-mono text-xs text-muted">{a.normalizedDomain}</p>
                    </div>
                    <LeadPriorityBadge priority={effectivePriority} />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <AuditStatusBadge status={a.auditStatus} />
                    <PipelineStageBadge stage={a.pipelineStage} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted pt-1 border-t border-border">
                    <span>{a.contactName}</span>
                    <span>{formatDate(a.createdAt)}</span>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-xs text-muted">
            <span className="tabular-nums">
              Showing page {data.page} of {data.totalPages} ({data.total} total)
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={data.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={data.page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
