import type { Metadata } from 'next';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { AuditProgressClient } from '@/components/audit/audit-progress-client';

export const metadata: Metadata = {
  title: 'Preparing Your AI Business Audit',
  robots: { index: false, follow: false },
};

export default async function AuditProgressPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main id="main-content" className="flex-1 bg-canvas px-4 py-12 sm:px-6">
        <AuditProgressClient token={token} />
      </main>
      <SiteFooter />
    </div>
  );
}

