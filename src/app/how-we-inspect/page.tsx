import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { Card } from '@/components/ui/card';
import { brandConfig, getCrawlerUserAgent } from '@/lib/config/brand';

export const metadata: Metadata = {
  title: 'How We Inspect Your Website',
  description:
    'Learn how Amarketing’s read-only website inspector works, its strict safety limits, and how robots.txt is respected.',
};

export default function HowWeInspectPage() {
  const userAgent = getCrawlerUserAgent();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main id="main-content" className="mx-auto max-w-3xl flex-1 px-4 py-14 sm:px-6">
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-teal-700 border border-emerald-200">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Crawler Transparency</span>
        </div>

        <h1 className="mt-4 font-serif text-3xl sm:text-4xl font-semibold text-ink">
          How we inspect your website
        </h1>
        <p className="mt-3 text-base text-muted leading-relaxed">
          To make your Free AI Business Audit genuinely useful, our platform inspects publicly
          accessible pages on the website you submit before generating recommendations. Here is
          exactly what our inspector does — and what it strictly avoids.
        </p>

        <div className="mt-8 space-y-5">
          <Card className="p-6 space-y-2">
            <h2 className="text-base font-semibold text-ink">1. Named User-Agent</h2>
            <p className="text-sm text-muted leading-relaxed">
              Every request clearly identifies itself using the following HTTP User-Agent string:
            </p>
            <p className="rounded bg-subtle px-3 py-2 font-mono text-xs text-ink break-all">
              {userAgent}
            </p>
          </Card>

          <Card className="p-6 space-y-2">
            <h2 className="text-base font-semibold text-ink">2. Respects robots.txt &amp; Same Domain Only</h2>
            <p className="text-sm text-muted leading-relaxed">
              Before inspecting your pages, our crawler reads <code className="font-mono">/robots.txt</code>.
              If automated inspection is disallowed for <code className="font-mono">{brandConfig.crawlerUserAgentName}</code> or{' '}
              <code className="font-mono">*</code>, we stop immediately and do not fetch restricted pages. We only
              follow links within your own domain.
            </p>
          </Card>

          <Card className="p-6 space-y-2">
            <h2 className="text-base font-semibold text-ink">3. Strict Page &amp; Rate Limits</h2>
            <p className="text-sm text-muted leading-relaxed">
              We inspect at most <strong>five public HTML pages</strong> per audit (typically the
              homepage plus high-relevance pages like services, about, booking, contact, or FAQ),
              waiting politely between requests and capping response size at 1.5 MB per page.
            </p>
          </Card>

          <Card className="p-6 space-y-2">
            <h2 className="text-base font-semibold text-ink">4. Read-Only, No Scripts, No Forms</h2>
            <p className="text-sm text-muted leading-relaxed">
              Our HTML parser never executes JavaScript from your website, never logs in, never sends
              cookies or authentication credentials, never submits enquiry forms, and never performs
              purchases or security probing.
            </p>
          </Card>

          <Card className="p-6 space-y-2">
            <h2 className="text-base font-semibold text-ink">5. Questions or Removal</h2>
            <p className="text-sm text-muted leading-relaxed">
              If you run an audit and want all stored page excerpts and report data removed, you can
              delete your audit anytime from the report footer or contact us at{' '}
              <a href={`mailto:${brandConfig.contactEmail}`} className="font-medium text-teal-700 hover:underline">
                {brandConfig.contactEmail}
              </a>
              .
            </p>
          </Card>
        </div>

        <div className="mt-10 flex gap-3">
          <Link
            href="/audit"
            className="inline-flex min-h-[44px] items-center rounded bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-navy-950 hover:bg-emerald-400"
          >
            Start My Free Audit
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center rounded border border-border bg-surface px-5 py-2.5 text-sm font-medium text-ink hover:bg-subtle"
          >
            Back to Home
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

