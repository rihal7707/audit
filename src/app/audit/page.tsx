import type { Metadata } from 'next';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { AuditWizard } from '@/components/audit/audit-wizard';
import { getEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Start Your Free AI Business Audit',
  description:
    'Submit your business website and operational goals for a personalised, evidence-backed AI and automation audit.',
};

export default function AuditWizardPage() {
  const env = getEnv();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main id="main-content" className="flex-1 bg-canvas">
        <AuditWizard
          paidTier={env.GEMINI_PAID_TIER}
          turnstileSiteKey={env.TURNSTILE_SITE_KEY ?? null}
        />
      </main>
      <SiteFooter />
    </div>
  );
}

