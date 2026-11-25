import Link from 'next/link';
import {
  ArrowRight,
  Bot,
  Briefcase,
  Building2,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Eye,
  FileSearch,
  GraduationCap,
  HeartPulse,
  Layers,
  Lock,
  MessageSquare,
  PhoneCall,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Stethoscope,
  Workflow,
} from 'lucide-react';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { Card } from '@/components/ui/card';
import { AccordionList, type AccordionItemData } from '@/components/ui/overlays';
import { HeroReportPreview } from '@/components/landing/hero-report-preview';
import { brandConfig } from '@/lib/config/brand';

const BENEFITS = [
  {
    icon: FileSearch,
    title: 'Discover operational inefficiencies',
    description:
      'Spot bottlenecks across enquiry intake, manual copy-paste tasks, and fragmented scheduling tools.',
  },
  {
    icon: Workflow,
    title: 'Identify opportunities for AI automation',
    description:
      'Pinpoint practical workflows where automation saves team hours without disrupting daily operations.',
  },
  {
    icon: MessageSquare,
    title: 'Improve customer enquiry management',
    description:
      'Examine how visitors currently reach your business and where faster responses prevent lead drop-off.',
  },
  {
    icon: PhoneCall,
    title: 'Streamline follow-ups',
    description:
      'Replace inconsistent manual callbacks with structured, timely reminders and missed-call recovery.',
  },
  {
    icon: Layers,
    title: 'Explore CRM and workflow improvements',
    description:
      'Connect web forms, phone logs, and booking calendars into a single, reliable prospect pipeline.',
  },
  {
    icon: Bot,
    title: 'Understand where AI agents could help',
    description:
      'See concrete agent workflow diagrams with clear triggers, steps, and human-handoff guardrails.',
  },
];

const HOW_IT_WORKS = [
  {
    step: '1',
    title: 'Submit your website and business details',
    text: 'Share your public URL, core services, operational challenges, and goals in a short 5-step intake.',
  },
  {
    step: '2',
    title: 'Our AI analyses your business',
    text: 'We inspect up to 5 public pages, detect booking and chat signals, and pair findings with your context.',
  },
  {
    step: '3',
    title: 'Receive your personalised audit report',
    text: 'Review grounded observations, automation opportunities, AI agent workflows, and a 30/60/90-day roadmap.',
  },
  {
    step: '4',
    title: 'Discuss the recommendations with our team',
    text: 'Optional strategy call to walk through priorities — valuable even if you implement on your own.',
  },
  {
    step: '5',
    title: 'Implement solutions that make sense',
    text: 'Start small with a focused pilot only if and when the business case is clear for your team.',
  },
];

const INCLUDED_ITEMS = [
  'Website and digital presence analysis',
  'Business messaging and positioning',
  'Lead capture and conversion opportunities',
  'Customer enquiry and follow-up opportunities',
  'Operational automation opportunities',
  'AI agent recommendations with workflow diagrams',
  'CRM and integration opportunities',
  'Prioritised 30 / 60 / 90-day improvement roadmap',
];

const REPORT_TOC_PREVIEW = [
  { num: '01', label: 'Executive Summary & Quick Snapshot' },
  { num: '02', label: 'Digital Presence & Messaging Findings' },
  { num: '03', label: 'Lead Capture & Conversion Signals' },
  { num: '04', label: 'Customer Enquiry & Follow-Up Review' },
  { num: '05', label: 'Prioritised Automation Opportunities' },
  { num: '06', label: 'Recommended AI Agent Workflows' },
  { num: '07', label: '30 / 60 / 90-Day Implementation Roadmap' },
  { num: '08', label: 'Assumptions, Limitations & Next Steps' },
];

const WHO_CAN_BENEFIT = [
  { icon: Stethoscope, label: 'Dental and orthodontic practices' },
  { icon: HeartPulse, label: 'Healthcare and wellness businesses' },
  { icon: Briefcase, label: 'Professional services' },
  { icon: Building2, label: 'Real estate' },
  { icon: ShoppingBag, label: 'E-commerce' },
  { icon: GraduationCap, label: 'Education' },
  { icon: Sparkles, label: 'Small and medium-sized businesses' },
  { icon: RefreshCw, label: 'Service-based companies' },
];

const FAQ_ITEMS: AccordionItemData[] = [
  {
    value: 'really-free',
    title: 'Is the audit really free?',
    content:
      'Yes. Generating and viewing your personalised AI Business Audit is completely free, with no upfront payment, card requirement, or hidden fee.',
  },
  {
    value: 'obligation',
    title: 'Do I need to purchase anything?',
    content:
      'No. There is zero obligation to book a call or purchase any implementation service. We aim to make the report practical and useful on its own.',
  },
  {
    value: 'how-ai-analyses',
    title: 'How does the AI analyse my website?',
    content:
      'First, our inspection engine safely reads up to five publicly accessible pages on your domain (respecting robots.txt) and checks deterministic signals such as contact forms, booking tools, and messaging widgets. That extracted public text and your non-contact questionnaire details are then analysed by Google’s Gemini AI service to produce structured, evidence-referenced findings.',
  },
  {
    value: 'personalised',
    title: 'Will I receive a personalised report?',
    content:
      'Yes. Every verified website finding references the specific inspected page and quoted text or detected signal, combined with your stated challenges, tools, and goals.',
  },
  {
    value: 'inaccessible',
    title: 'What if my website cannot be accessed?',
    content:
      'If your site blocks automated crawlers, is temporarily unavailable, or renders primarily via client-side JavaScript, we never invent website findings. Instead, we clearly mark the report as a limited assessment based on your questionnaire, and allow you to paste public copy afterwards to regenerate an enriched version.',
  },
  {
    value: 'security',
    title: 'Is my information secure?',
    content:
      'Your contact details (name, email, phone number) are stored only for Amarketing to share your report and follow up if you ask — they are never sent to the Gemini AI service. Please never submit patient records, passwords, or financial account numbers. You can permanently delete your audit and all associated data directly from your report page at any time.',
  },
  {
    value: 'after-audit',
    title: 'What happens after the audit?',
    content:
      'You can read, print, or save your report as a PDF right away. If you would like help prioritising or piloting any of the recommendations, you can book a strategy call or request a pilot directly from the report.',
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main id="main-content" className="flex-1">
        {/* Hero */}
        <section className="hero-gradient text-white">
          <div className="mx-auto max-w-public px-4 py-16 sm:px-6 lg:py-24">
            <div className="grid items-center gap-12 lg:grid-cols-12">
              <div className="lg:col-span-6 space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/35 bg-emerald-500/15 px-3.5 py-1 text-xs font-semibold tracking-wide text-emerald-300">
                  <span>Free · No obligation</span>
                </div>

                <h1 className="font-serif text-4xl font-semibold tracking-[-0.02em] text-white sm:text-5xl lg:text-[56px] lg:leading-[1.08]">
                  Discover Where AI Can Transform Your Business.
                </h1>

                <p className="max-w-prose text-base sm:text-lg leading-relaxed text-slate-200">
                  Get a personalised, AI-powered analysis of your business and discover
                  opportunities to save time, improve operations and unlock new growth. Completely
                  FREE. No upfront payment. No obligation.
                </p>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center pt-1">
                  <Link
                    href="/audit"
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded bg-emerald-500 px-6 py-3 text-base font-semibold text-navy-950 shadow-sm transition-colors hover:bg-emerald-400"
                  >
                    Get My Free AI Business Audit
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                  <Link
                    href="/sample-report"
                    className="inline-flex min-h-[48px] items-center justify-center rounded border border-white/25 bg-white/10 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-white/20"
                  >
                    View Sample Audit Report
                  </Link>
                </div>

                <ul className="flex flex-wrap gap-x-6 gap-y-2 pt-2 text-xs sm:text-sm text-slate-300">
                  <li className="inline-flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                    No payment required
                  </li>
                  <li className="inline-flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                    Based on your public website
                  </li>
                  <li className="inline-flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                    Takes a few minutes
                  </li>
                </ul>
              </div>

              <div className="lg:col-span-6">
                <HeroReportPreview />
              </div>
            </div>
          </div>
        </section>

        {/* Benefits (6 icon cards) */}
        <section className="py-16 lg:py-24">
          <div className="mx-auto max-w-public px-4 sm:px-6">
            <div className="max-w-2xl">
              <span className="text-xs font-semibold uppercase tracking-wider text-teal-700">
                Practical Business Clarity
              </span>
              <h2 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                Built to uncover real operational leverage — not generic AI hype
              </h2>
              <p className="mt-3 text-base text-muted leading-relaxed">
                Every recommendation is tied to what visitors see on your website and how your team
                handles enquiries, follow-ups, and daily coordination.
              </p>
            </div>

            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {BENEFITS.map((item) => {
                const Icon = item.icon;
                return (
                  <Card key={item.title} className="p-6 hover:border-navy-600/40">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-50 text-teal-700 border border-emerald-200/70">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <h3 className="mt-4 text-base font-semibold text-ink">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{item.description}</p>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* How It Works (5-step timeline) */}
        <section id="how-it-works" className="scroll-mt-20 border-y border-border bg-surface py-16 lg:py-24">
          <div className="mx-auto max-w-public px-4 sm:px-6">
            <div className="max-w-2xl">
              <span className="text-xs font-semibold uppercase tracking-wider text-teal-700">
                How It Works
              </span>
              <h2 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                From your website URL to a structured action plan
              </h2>
            </div>

            <ol className="mt-12 grid gap-6 md:grid-cols-5">
              {HOW_IT_WORKS.map((item) => (
                <li key={item.step} className="relative flex flex-col">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy-900 text-sm font-semibold text-white tabular-nums">
                      {item.step}
                    </span>
                    <div className="hidden h-px flex-1 bg-border md:block" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-ink">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{item.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* What Your Audit Includes */}
        <section id="whats-included" className="scroll-mt-20 py-16 lg:py-24">
          <div className="mx-auto max-w-public px-4 sm:px-6">
            <div className="grid items-start gap-10 lg:grid-cols-12">
              <div className="lg:col-span-6 space-y-5">
                <span className="text-xs font-semibold uppercase tracking-wider text-teal-700">
                  Deliverable Breakdown
                </span>
                <h2 className="font-serif text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                  What will your audit include?
                </h2>
                <p className="text-base leading-relaxed text-muted">
                  Your report reads like an editorial consulting deliverable — never a chat log —
                  clearly distinguishing verified website observations from hypotheses.
                </p>

                <ul className="grid gap-3 pt-2 sm:grid-cols-2">
                  {INCLUDED_ITEMS.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-ink">
                      <CheckCircle2
                        className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"
                        aria-hidden="true"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="lg:col-span-6">
                <Card variant="raised" className="overflow-hidden">
                  <div className="border-b border-border bg-subtle px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ClipboardCheck className="h-4 w-4 text-teal-700" aria-hidden="true" />
                      <span className="text-sm font-semibold text-ink">
                        Audit Report Structure
                      </span>
                    </div>
                    <span className="text-xs font-mono text-muted">A4 Print-Ready</span>
                  </div>
                  <div className="divide-y divide-border px-6 py-2">
                    {REPORT_TOC_PREVIEW.map((row) => (
                      <div key={row.num} className="flex items-center justify-between py-3 text-sm">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs font-semibold text-teal-700">
                            {row.num}
                          </span>
                          <span className="font-medium text-ink">{row.label}</span>
                        </div>
                        <span className="text-xs text-muted">Included</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Who Can Benefit */}
        <section id="who-its-for" className="scroll-mt-20 border-y border-border bg-surface py-16 lg:py-24">
          <div className="mx-auto max-w-public px-4 sm:px-6">
            <div className="max-w-2xl">
              <span className="text-xs font-semibold uppercase tracking-wider text-teal-700">
                Who Can Benefit
              </span>
              <h2 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                Designed for enquiry-driven businesses ready to save time
              </h2>
              <p className="mt-3 text-base text-muted">
                Any business that relies on inbound enquiries, bookings, or follow-ups can surface
                practical automation wins.
              </p>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {WHO_CAN_BENEFIT.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="flex items-center gap-3 rounded-lg border border-border bg-canvas px-4 py-3.5 text-sm font-medium text-ink"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-teal-700" aria-hidden="true" />
                    <span>{item.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* How We Inspect Your Website Transparency Panel */}
        <section className="py-16 lg:py-20">
          <div className="mx-auto max-w-public px-4 sm:px-6">
            <Card className="border-navy-700/15 bg-surface p-6 sm:p-10">
              <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
                <div className="lg:col-span-5 space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-teal-700 border border-emerald-200">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Respectful Website Inspection</span>
                  </div>
                  <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-ink">
                    How we inspect your website
                  </h2>
                  <p className="text-sm leading-relaxed text-muted">
                    Transparency matters. Our crawler behaves like a polite, read-only visitor and
                    never tests security or interacts with forms.
                  </p>
                  <Link
                    href="/how-we-inspect"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:underline pt-1"
                  >
                    Read full crawler documentation
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>

                <div className="lg:col-span-7 grid gap-4 sm:grid-cols-2">
                  {[
                    {
                      icon: Eye,
                      title: 'Identified User-Agent',
                      text: `Identifies clearly as ${brandConfig.crawlerUserAgentName} with a public explanation link.`,
                    },
                    {
                      icon: Clock,
                      title: 'At most 5 public pages',
                      text: 'Reads only public pages on your own domain, with polite delays between requests.',
                    },
                    {
                      icon: ShieldCheck,
                      title: 'Respects robots.txt',
                      text: 'Honours disallow rules automatically and never bypasses access controls.',
                    },
                    {
                      icon: Lock,
                      title: 'Read-only & script-free',
                      text: 'Never logs in, never submits forms, never makes purchases, and never executes site scripts.',
                    },
                  ].map((rule) => {
                    const Icon = rule.icon;
                    return (
                      <div key={rule.title} className="rounded-md border border-border bg-canvas p-4">
                        <Icon className="h-4 w-4 text-teal-700" aria-hidden="true" />
                        <h3 className="mt-2 text-sm font-semibold text-ink">{rule.title}</h3>
                        <p className="mt-1 text-xs leading-relaxed text-muted">{rule.text}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* Sample Report Teaser */}
        <section className="border-y border-border bg-subtle/60 py-16">
          <div className="mx-auto max-w-public px-4 sm:px-6">
            <div className="flex flex-col items-start justify-between gap-6 rounded-xl border border-border bg-surface p-6 sm:p-10 md:flex-row md:items-center">
              <div className="max-w-xl space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-teal-700">
                  Interactive Sample Report
                </span>
                <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-ink">
                  See what a completed audit looks like before you apply
                </h2>
                <p className="text-sm sm:text-base text-muted leading-relaxed">
                  Explore our complete sample audit for Willow Creek Orthodontics (a fictional
                  practice) showing grounded findings, workflow diagrams, and a 90-day plan.
                </p>
              </div>
              <Link
                href="/sample-report"
                className="inline-flex min-h-[48px] shrink-0 items-center gap-2 rounded bg-navy-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-navy-800"
              >
                Explore Sample Audit
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 py-16 lg:py-24">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <div className="text-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-teal-700">
                Questions &amp; Answers
              </span>
              <h2 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                Frequently asked questions
              </h2>
            </div>

            <div className="mt-10">
              <AccordionList items={FAQ_ITEMS} defaultValue="really-free" />
            </div>
          </div>
        </section>

        {/* Final CTA Band */}
        <section className="hero-gradient text-white">
          <div className="mx-auto max-w-public px-4 py-16 text-center sm:px-6 lg:py-20">
            <h2 className="mx-auto max-w-2xl font-serif text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Ready to see where AI and automation fit inside your business?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-slate-200 leading-relaxed">
              Submit your website and operational goals in a few minutes. Receive a practical,
              evidence-backed audit report at zero cost and with zero obligation.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/audit"
                className="inline-flex min-h-[48px] items-center gap-2 rounded bg-emerald-500 px-7 py-3 text-base font-semibold text-navy-950 transition-colors hover:bg-emerald-400"
              >
                Get My Free AI Business Audit
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/sample-report"
                className="inline-flex min-h-[48px] items-center rounded border border-white/25 bg-white/10 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-white/20"
              >
                View Sample Audit Report
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

