import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { ReportView } from '@/components/report/report-view';
import {
  WILLOW_CREEK_SAMPLE_CHALLENGES,
  WILLOW_CREEK_SAMPLE_REPORT,
} from '@/lib/sample/willow-creek';

export const metadata: Metadata = {
  title: 'Sample AI Business Audit Report – Willow Creek Orthodontics',
  description:
    'Explore an illustrative sample AI Business Audit report created for the fictional practice Willow Creek Orthodontics.',
};

export default function SampleReportPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main id="main-content" className="flex-1">
        <ReportView
          report={WILLOW_CREEK_SAMPLE_REPORT}
          isSample
          challenges={WILLOW_CREEK_SAMPLE_CHALLENGES}
          pagesAttempted={5}
          pagesExtractedOk={5}
          inspectedPages={[
            {
              pageLabel: 'P1',
              url: 'https://willowcreekortho.example/',
              pageTitle: 'Home (Simulated)',
              extractionStatus: 'OK',
            },
            {
              pageLabel: 'P2',
              url: 'https://willowcreekortho.example/treatments',
              pageTitle: 'Treatments (Simulated)',
              extractionStatus: 'OK',
            },
            {
              pageLabel: 'P3',
              url: 'https://willowcreekortho.example/teen-orthodontics',
              pageTitle: 'Teen Orthodontics (Simulated)',
              extractionStatus: 'OK',
            },
            {
              pageLabel: 'P4',
              url: 'https://willowcreekortho.example/new-patients',
              pageTitle: 'New Patients (Simulated)',
              extractionStatus: 'OK',
            },
            {
              pageLabel: 'P5',
              url: 'https://willowcreekortho.example/contact',
              pageTitle: 'Contact & Locations (Simulated)',
              extractionStatus: 'OK',
            },
          ]}
        />

        <div className="no-print mx-auto max-w-public px-4 pb-12 sm:px-6">
          <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-6 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-semibold text-ink">
                Want this level of analysis for your own business?
              </h2>
              <p className="text-sm text-muted">
                Generate a personalised report tailored to your real website and operational goals.
              </p>
            </div>
            <Link
              href="/audit"
              className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-navy-950 hover:bg-emerald-400"
            >
              Get My Free AI Business Audit
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

