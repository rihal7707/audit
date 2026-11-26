'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Clock, ShieldCheck, Trash2 } from 'lucide-react';
import type { PublicReportDto } from '@/lib/reports/public-dto';
import { Card } from '@/components/ui/card';
import { ReportView } from './report-view';

export function CustomerReportClient({ token }: { token: string }) {
  const router = useRouter();
  const [dto, setDto] = React.useState<PublicReportDto | null>(null);
  const [statusCode, setStatusCode] = React.useState<number | null>(null);
  const [deleted, setDeleted] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    fetch(`/api/reports/${token}`, { cache: 'no-store' })
      .then(async (res) => {
        if (!active) return;
        setStatusCode(res.status);
        if (res.ok) {
          const data = (await res.json()) as PublicReportDto;
          setDto(data);
        }
      })
      .catch(() => {
        if (active) setStatusCode(500);
      });
    return () => {
      active = false;
    };
  }, [token]);

  if (deleted) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20">
        <Card className="p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <Trash2 className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-semibold text-ink">Your audit data has been deleted</h1>
          <p className="mt-2 text-sm text-muted">
            Your report, website extraction records, and contact information have been permanently
            removed.
          </p>
          <div className="mt-6">
            <Link
              href="/"
              className="inline-flex min-h-[44px] items-center rounded bg-navy-900 px-5 py-2.5 text-sm font-medium text-white"
            >
              Return to Home
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (statusCode === 404 || statusCode === 410) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20">
        <Card className="p-8 text-center">
          <h1 className="text-xl font-semibold text-ink">
            {statusCode === 410 ? 'Report link revoked' : 'Report not found'}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {statusCode === 410
              ? 'This report link has been revoked by the administrator.'
              : 'This audit report could not be found or may have been deleted.'}
          </p>
          <div className="mt-6">
            <Link
              href="/audit"
              className="inline-flex min-h-[44px] items-center rounded bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-navy-950"
            >
              Request a New Free Audit
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (!dto) {
    return (
      <div className="mx-auto max-w-public px-4 py-12 sm:px-6 space-y-6">
        <div className="h-48 rounded-xl bg-navy-900/15" />
        <div className="h-64 rounded-xl bg-subtle" />
      </div>
    );
  }

  if (dto.releaseStatus === 'PENDING_REVIEW') {
    return (
      <div className="mx-auto max-w-lg px-4 py-20">
        <Card className="p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-700">
            <ShieldCheck className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-semibold text-ink">Report awaiting review</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Your audit for <strong>{dto.businessName}</strong> has been generated and is undergoing a
            brief quality check by our team before release.
          </p>
          <div className="mt-6">
            <Link
              href={`/audit/progress/${token}`}
              className="inline-flex min-h-[44px] items-center rounded border border-border bg-surface px-5 py-2.5 text-sm font-medium text-ink hover:bg-subtle"
            >
              Check Progress Status
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (!dto.report) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20">
        <Card className="p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-subtle text-navy-700">
            <Clock className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-semibold text-ink">Report still being prepared</h1>
          <p className="mt-2 text-sm text-muted">
            Your audit for <strong>{dto.businessName}</strong> is not finished yet.
          </p>
          <div className="mt-6">
            <Link
              href={`/audit/progress/${token}`}
              className="inline-flex min-h-[44px] items-center rounded bg-navy-900 px-5 py-2.5 text-sm font-medium text-white"
            >
              View Live Progress
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <ReportView
      report={dto.report}
      publicToken={dto.publicToken}
      challenges={dto.challenges}
      pagesAttempted={dto.pagesAttempted}
      pagesExtractedOk={dto.pagesExtractedOk}
      inspectedPages={dto.inspectedPages}
      crawlFailureReason={dto.crawlFailureReason}
      consultRequested={dto.consultRequested}
      pilotRequested={dto.pilotRequested}
      onReportDeleted={() => setDeleted(true)}
      onSupplementSubmitted={(progressUrl) => router.push(progressUrl)}
    />
  );
}

