import type { Metadata } from 'next';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { CustomerReportClient } from '@/components/report/customer-report-client';

export const metadata: Metadata = {
  title: 'Your Free AI Business Audit Report',
  robots: { index: false, follow: false },
};

export default async function CustomerReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main id="main-content" className="flex-1">
        <CustomerReportClient token={token} />
      </main>
      <SiteFooter />
    </div>
  );
}

