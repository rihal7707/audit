import type { Metadata } from 'next';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { brandConfig } from '@/lib/config/brand';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Amarketing Advertising handles website and questionnaire data for the Free AI Business Audit.',
};

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main id="main-content" className="mx-auto max-w-3xl flex-1 px-4 py-14 sm:px-6 space-y-8">
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-ink">Privacy Policy</h1>
          <p className="mt-2 text-sm text-muted">
            Effective for the Free AI Business Audit provided by {brandConfig.legalEntityName}.
          </p>
        </div>

        <section className="space-y-2 text-sm leading-relaxed text-muted">
          <h2 className="text-lg font-semibold text-ink">1. Information We Collect</h2>
          <p>
            When you request a Free AI Business Audit, we collect the business website URL and
            operational details you submit (such as industry, challenges, goals, and optional tool
            or volume ranges), along with your contact details (full name, business email, optional
            phone number, and role) and public text extracted from up to five publicly accessible
            pages on your website.
          </p>
          <p>
            Please do not submit patient information, medical records, passwords, financial account
            numbers, or other sensitive personal data.
          </p>
        </section>

        <section className="space-y-2 text-sm leading-relaxed text-muted">
          <h2 className="text-lg font-semibold text-ink">2. How Information Is Used &amp; Third-Party Processors</h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <strong className="text-ink">Google (Gemini API):</strong> Your public website extracts
              and non-contact business context are sent to Google’s Gemini AI service to generate the
              structured audit report. Your contact name, business email, and phone number are never
              sent to Gemini.
            </li>
            <li>
              <strong className="text-ink">Application Hosting &amp; Database Provider:</strong> Stores
              submitted audit inputs, extracted public website snapshots, and generated reports.
            </li>
            <li>
              <strong className="text-ink">Resend (if configured):</strong> Delivers optional report
              ready emails and internal agency notifications.
            </li>
          </ul>
          <p>
            Optional marketing communications are separate, unchecked by default, and sent only if you
            explicitly opt in.
          </p>
        </section>

        <section className="space-y-2 text-sm leading-relaxed text-muted">
          <h2 className="text-lg font-semibold text-ink">3. Access Tokens, Retention &amp; Deletion</h2>
          <p>
            Each report is protected by a high-entropy random link token and marked{' '}
            <code className="font-mono">noindex</code> so search engines do not index customer reports.
            Audits are automatically purged after our configured retention window (default 180 days),
            and public website crawl caches expire automatically (default 24 hours).
          </p>
          <p>
            You may permanently delete your audit report and all stored data directly from the footer
            of your report page at any time, or email{' '}
            <a href={`mailto:${brandConfig.contactEmail}`} className="font-medium text-teal-700 hover:underline">
              {brandConfig.contactEmail}
            </a>
            .
          </p>
        </section>

        <section className="space-y-2 text-sm leading-relaxed text-muted">
          <h2 className="text-lg font-semibold text-ink">4. Security &amp; Regulatory Scope</h2>
          <p>
            We apply transport encryption in production (HTTPS), strict request validation, SSRF
            safeguards, and access controls. This service is not represented as HIPAA-compliant or
            subject to formal third-party compliance certification.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

