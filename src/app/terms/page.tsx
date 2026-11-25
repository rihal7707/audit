import type { Metadata } from 'next';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { brandConfig } from '@/lib/config/brand';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms governing use of the AMARKETING Free AI Business Audit platform.',
};

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main id="main-content" className="mx-auto max-w-3xl flex-1 px-4 py-14 sm:px-6 space-y-8">
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-ink">
            Terms of Service
          </h1>
          <p className="mt-2 text-sm text-muted">
            Governing use of the Free AI Business Audit offered by {brandConfig.legalEntityName}.
          </p>
        </div>

        <section className="space-y-2 text-sm leading-relaxed text-muted">
          <h2 className="text-lg font-semibold text-ink">1. Purpose &amp; Authority to Submit</h2>
          <p>
            You may submit only websites that you own or are authorised to have reviewed for a
            business operations audit. You agree not to abuse the service, bypass rate limits, or
            submit private internal network URLs or sensitive personal information.
          </p>
        </section>

        <section className="space-y-2 text-sm leading-relaxed text-muted">
          <h2 className="text-lg font-semibold text-ink">2. Preliminary Advisory Nature</h2>
          <p>
            Audit reports are preliminary, AI-assisted analyses generated from publicly accessible
            website pages and the business context you provide. Reports are offered free of charge
            and create no obligation to purchase services from {brandConfig.legalEntityName}.
          </p>
          <p>
            Reports do not constitute legal, medical, clinical, financial, or regulatory compliance
            advice, and {brandConfig.legalEntityName} makes no guarantee of specific revenue,
            conversion, or cost savings.
          </p>
        </section>

        <section className="space-y-2 text-sm leading-relaxed text-muted">
          <h2 className="text-lg font-semibold text-ink">3. Availability &amp; Contact</h2>
          <p>
            Automated analysis depends on third-party AI availability and target website
            accessibility. We may throttle, queue, or pause audit processing if daily quotas are
            reached. For questions, contact{' '}
            <a href={`mailto:${brandConfig.contactEmail}`} className="font-medium text-teal-700 hover:underline">
              {brandConfig.contactEmail}
            </a>
            .
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

