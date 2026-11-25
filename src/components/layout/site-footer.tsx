import Link from 'next/link';
import { brandConfig } from '@/lib/config/brand';
import { BrandWordmark } from './site-header';

export function SiteFooter() {
  return (
    <footer className="no-print border-t border-border bg-surface">
      <div className="mx-auto max-w-public px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="space-y-3 md:col-span-1">
            <BrandWordmark />
            <p className="text-sm leading-relaxed text-muted">
              Free AI Business Audit by {brandConfig.legalEntityName}. Evidence-based automation
              assessments built from your public website and operational priorities.
            </p>
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink">Product</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li>
                <Link href="/audit" className="hover:text-ink">
                  Start Free Audit
                </Link>
              </li>
              <li>
                <Link href="/sample-report" className="hover:text-ink">
                  View Sample Report
                </Link>
              </li>
              <li>
                <Link href="/#whats-included" className="hover:text-ink">
                  What&apos;s Included
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink">Company</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li>
                <Link href="/#how-it-works" className="hover:text-ink">
                  How It Works
                </Link>
              </li>
              <li>
                <Link href="/#who-its-for" className="hover:text-ink">
                  Industries Served
                </Link>
              </li>
              <li>
                <Link href="/#faq" className="hover:text-ink">
                  Frequently Asked Questions
                </Link>
              </li>
              <li>
                <a href={`mailto:${brandConfig.contactEmail}`} className="hover:text-ink">
                  {brandConfig.contactEmail}
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink">
              Trust &amp; Legal
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li>
                <Link href="/how-we-inspect" className="hover:text-ink">
                  How we inspect your website
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-ink">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-ink">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-border pt-6 text-xs text-muted sm:flex-row sm:items-center">
          <p>Free AI Business Audit by {brandConfig.legalEntityName}.</p>
          <p>Preliminary advisory analysis — no payment or ongoing commitment required.</p>
        </div>
      </div>
    </footer>
  );
}

