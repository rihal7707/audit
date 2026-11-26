'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Globe,
  Loader2,
  Pencil,
  WifiOff,
} from 'lucide-react';
import {
  AUDIT_PROCESSING_NOTICE_TEXT,
  AUDIT_REQUIRED_CONSENT_TEXT,
  AUDIT_SENSITIVE_DATA_WARNING,
  AuditSubmissionSchema,
  type AuditSubmissionInput,
} from '@/lib/validation/audit-submission';
import {
  BUSINESS_SIZE_OPTIONS,
  CHALLENGE_OPTIONS,
  GOAL_OPTIONS,
  INDUSTRIES,
  TIMEFRAME_OPTIONS,
  VOLUME_RANGE_OPTIONS,
} from '@/lib/config/industries';
import { COUNTRIES, isCountryRestrictedForUnpaidGemini } from '@/lib/config/countries';
import { normalizeUserWebsiteInput } from '@/lib/validation/url-normalize';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Select, Textarea } from '@/components/ui/form-fields';
import { Combobox } from '@/components/ui/combobox';
import { Callout, SegmentedControl, Tile } from '@/components/ui/interactive-controls';

const STORAGE_KEY = 'amk_audit_wizard_v1';

const WIZARD_STEPS = [
  {
    number: 1,
    title: 'Business information',
    whyWeAsk: 'Identifies your public website and industry context for targeted inspection.',
  },
  {
    number: 2,
    title: 'Understand your business',
    whyWeAsk: 'Focuses the audit on your real offerings, bottlenecks, and current stack.',
  },
  {
    number: 3,
    title: 'Business goals & scale',
    whyWeAsk: 'Helps prioritise recommendations by operational impact and timeline.',
  },
  {
    number: 4,
    title: 'Contact & privacy',
    whyWeAsk: 'Where to send your private report link — never shared with the AI model.',
  },
  {
    number: 5,
    title: 'Review & generate',
    whyWeAsk: 'Confirm your details before we inspect your website and build your report.',
  },
] as const;

const STEP_FIELDS: Record<number, Array<keyof AuditSubmissionInput>> = {
  1: ['website', 'businessName', 'industry', 'country', 'location', 'businessSize'],
  2: ['businessDescription', 'challenges', 'toolsUsed'],
  3: ['goals', 'enquiryVolume', 'phoneVolume', 'teamSize', 'manualProcesses', 'timeframe'],
  4: [
    'contactName',
    'contactEmail',
    'contactPhone',
    'contactRole',
    'consent',
    'processingNoticeAck',
    'marketingConsent',
  ],
};

interface PrecheckState {
  status: 'idle' | 'checking' | 'done';
  reachable?: boolean;
  urlStatus?: 'URL_INVALID' | 'WEBSITE_ACCESSIBLE' | 'URL_VALID_BUT_UNREACHABLE';
  normalizedUrl?: string;
  finalHost?: string;
  redirectedCrossDomain?: boolean;
  robotsAllowed?: boolean;
  reason?: string;
}

export function AuditWizard({
  paidTier,
  turnstileSiteKey,
}: {
  paidTier: boolean;
  turnstileSiteKey: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = React.useState(1);
  const [isOnline, setIsOnline] = React.useState(true);
  const [precheck, setPrecheck] = React.useState<PrecheckState>({ status: 'idle' });
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [stepErrorSummary, setStepErrorSummary] = React.useState<string[]>([]);
  const [announcement, setAnnouncement] = React.useState('');
  const stepHeadingRef = React.useRef<HTMLHeadingElement>(null);

  const form = useForm<AuditSubmissionInput>({
    resolver: zodResolver(AuditSubmissionSchema) as never,
    mode: 'onBlur',
    defaultValues: {
      website: '',
      businessName: '',
      industry: 'Dental',
      country: 'US',
      location: '',
      businessSize: '',
      businessDescription: '',
      challenges: [],
      toolsUsed: '',
      goals: [],
      enquiryVolume: '',
      phoneVolume: '',
      teamSize: '',
      manualProcesses: '',
      timeframe: '',
      contactName: '',
      contactEmail: '',
      contactPhone: '',
      contactRole: '',
      consent: undefined as unknown as true,
      processingNoticeAck: undefined as unknown as true,
      marketingConsent: false,
      websiteConfirmHp: '',
      formStartedAt: Date.now(),
      turnstileToken: '',
      allowCrossDomainRedirect: true,
    },
  });

  const watchedValues = form.watch();
  const selectedCountry = watchedValues.country;
  const regionBlocked = !paidTier && isCountryRestrictedForUnpaidGemini(selectedCountry || '');
  const normalizedPreview = React.useMemo(
    () => (watchedValues.website ? normalizeUserWebsiteInput(watchedValues.website) : ''),
    [watchedValues.website],
  );

  // Online/offline monitoring
  React.useEffect(() => {
    setIsOnline(navigator.onLine);
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Restore draft from sessionStorage on mount
  React.useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as Partial<AuditSubmissionInput>;
      form.reset({
        ...form.getValues(),
        ...parsed,
        formStartedAt: Date.now(),
        websiteConfirmHp: '',
      });
    } catch {
      // Ignore malformed draft
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave draft to sessionStorage
  React.useEffect(() => {
    const subscription = form.watch((values) => {
      try {
        const toSave = { ...values };
        delete toSave.formStartedAt;
        delete toSave.turnstileToken;
        delete toSave.websiteConfirmHp;
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      } catch {
        // Ignore storage quota issues
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Turnstile script loader if configured
  React.useEffect(() => {
    if (!turnstileSiteKey || step !== 4) return;
    if (document.getElementById('cf-turnstile-script')) return;
    const script = document.createElement('script');
    script.id = 'cf-turnstile-script';
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    document.head.appendChild(script);
  }, [turnstileSiteKey, step]);

  const moveToStep = (nextStep: number) => {
    setStep(nextStep);
    setStepErrorSummary([]);
    setSubmitError(null);
    const meta = WIZARD_STEPS[nextStep - 1];
    if (meta) {
      setAnnouncement(`Step ${nextStep} of 5: ${meta.title}`);
    }
    setTimeout(() => {
      stepHeadingRef.current?.focus();
    }, 10);
  };

  const runWebsitePrecheck = async (rawWebsite: string) => {
    const trimmed = rawWebsite.trim();
    if (!trimmed || trimmed.length < 4) {
      setPrecheck({ status: 'idle' });
      return;
    }
    setPrecheck({ status: 'checking' });
    try {
      const res = await fetch('/api/audits/precheck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => null)) as { error?: string } | null;
        setPrecheck({
          status: 'done',
          reachable: false,
          urlStatus: res.status === 400 ? 'URL_INVALID' : 'URL_VALID_BUT_UNREACHABLE',
          reason:
            errBody?.error ||
            "We couldn't check this URL automatically; we'll still run a limited assessment.",
        });
        return;
      }
      const data = await res.json();
      setPrecheck({ status: 'done', ...data });
    } catch {
      setPrecheck({
        status: 'done',
        reachable: false,
        urlStatus: 'URL_VALID_BUT_UNREACHABLE',
        reason: "We couldn't reach the site right now; we'll still run a limited assessment.",
      });
    }
  };

  const handleContinue = async () => {
    if (step === 1 && regionBlocked) {
      setStepErrorSummary(['The free audit is not yet available in the selected region.']);
      return;
    }

    const fields = STEP_FIELDS[step] ?? [];
    const valid = await form.trigger(fields);
    if (!valid) {
      const errors = form.formState.errors;
      const messages = fields
        .map((f) => errors[f]?.message)
        .filter((m): m is string => Boolean(m));
      setStepErrorSummary(messages.length > 0 ? messages : ['Please fix the highlighted fields.']);
      return;
    }
    moveToStep(Math.min(5, step + 1));
  };

  const handleKeyDownOnForm = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== 'Enter') return;
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'TEXTAREA' || tag === 'BUTTON') return;
    if (step < 5) {
      e.preventDefault();
      void handleContinue();
    }
  };

  const handleFinalSubmit = form.handleSubmit(async (data) => {
    setSubmitError(null);
    if (regionBlocked) {
      setSubmitError('The free audit is not yet available in your region.');
      return;
    }

    // Grab turnstile token from DOM widget if present
    const tsInput = document.querySelector<HTMLInputElement>('input[name="cf-turnstile-response"]');
    const payload: AuditSubmissionInput = {
      ...data,
      turnstileToken: tsInput?.value || data.turnstileToken || undefined,
    };

    let res: Response;
    try {
      res = await fetch('/api/audits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      setSubmitError(
        'Network error while reaching the audit server. Please check your connection and retry.',
      );
      return;
    }

    const rawText = await res.text().catch(() => '');
    let json: Record<string, unknown> | null = null;
    if (rawText) {
      try {
        json = JSON.parse(rawText) as Record<string, unknown>;
      } catch {
        json = null;
      }
    }

    if (!res.ok) {
      const reqId = typeof json?.requestId === 'string' ? json.requestId : res.headers.get('X-Request-Id');
      const serverMsg = typeof json?.error === 'string' ? json.error : null;

      if (json?.fieldErrors && typeof json.fieldErrors === 'object') {
        let earliestStep = 5;
        for (const [fieldName, msg] of Object.entries(json.fieldErrors as Record<string, string>)) {
          form.setError(fieldName as keyof AuditSubmissionInput, { message: msg });
          for (const [sNum, sFields] of Object.entries(STEP_FIELDS)) {
            if (sFields.includes(fieldName as keyof AuditSubmissionInput)) {
              earliestStep = Math.min(earliestStep, Number(sNum));
            }
          }
        }
        if (earliestStep < 5) {
          moveToStep(earliestStep);
        }
        setSubmitError(serverMsg || 'Please review the highlighted fields before submitting.');
        return;
      }

      if (!json) {
        setSubmitError(
          `Server error while submitting your audit (HTTP ${res.status}, non-JSON response). Please check server logs and retry.`,
        );
        return;
      }

      if (res.status >= 500) {
        setSubmitError(
          `${serverMsg || 'Server error while preparing your audit.'}${reqId ? ` (Request ID: ${reqId})` : ` (HTTP ${res.status})`}`,
        );
        return;
      }

      setSubmitError(
        `${serverMsg || `Could not submit your audit (HTTP ${res.status}).`}${reqId ? ` (Request ID: ${reqId})` : ''}`,
      );
      return;
    }

    const progressUrl = typeof json?.progressUrl === 'string' ? json.progressUrl : null;
    if (!progressUrl) {
      setSubmitError('Unexpected server response while starting your audit. Please retry.');
      return;
    }

    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    router.push(progressUrl);
  });

  const toggleArrayValue = (field: 'challenges' | 'goals', value: string) => {
    const current = form.getValues(field) as string[];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    form.setValue(field, next as never, { shouldValidate: true });
  };

  const currentMeta = WIZARD_STEPS[step - 1]!;

  return (
    <div className="mx-auto max-w-public px-4 py-8 sm:px-6 lg:py-12">
      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>

      {!isOnline && (
        <div className="mb-6 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            You appear to be offline. Your progress is saved locally and can be submitted once
            reconnected.
          </span>
        </div>
      )}

      {/* Mobile compact step header */}
      <div className="mb-6 lg:hidden">
        <div className="flex items-center justify-between text-xs font-medium text-muted">
          <span>
            Step {step} of {WIZARD_STEPS.length}
          </span>
          <span>{currentMeta.title}</span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-subtle">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${(step / WIZARD_STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex flex-col items-start justify-center gap-8 lg:flex-row">
        {/* Desktop 280px Progress Rail */}
        <aside className="hidden w-[280px] shrink-0 lg:block">
          <Card className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              Free AI Business Audit
            </p>
            <ol className="mt-4 space-y-4">
              {WIZARD_STEPS.map((s) => {
                const isDone = s.number < step;
                const isCurrent = s.number === step;
                return (
                  <li key={s.number} className="flex items-start gap-3">
                    <span
                      className={cn(
                        'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums',
                        isDone
                          ? 'bg-emerald-500 text-navy-950'
                          : isCurrent
                            ? 'bg-navy-900 text-white'
                            : 'border border-border bg-subtle text-muted',
                      )}
                    >
                      {isDone ? <Check className="h-3.5 w-3.5 stroke-[2.5]" /> : s.number}
                    </span>
                    <div className="min-w-0">
                      <button
                        type="button"
                        disabled={!isDone}
                        onClick={() => isDone && moveToStep(s.number)}
                        className={cn(
                          'text-left text-sm font-semibold',
                          isCurrent ? 'text-ink' : isDone ? 'text-teal-700 hover:underline cursor-pointer' : 'text-muted',
                        )}
                      >
                        {s.title}
                      </button>
                      <p className="mt-0.5 text-xs leading-snug text-muted">{s.whyWeAsk}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>
        </aside>

        {/* Main Wizard Card (max 640px) */}
        <div className="w-full max-w-[640px]">
          <Card variant="raised" className="p-6 sm:p-8">
            <form onSubmit={handleFinalSubmit} onKeyDown={handleKeyDownOnForm} noValidate>
              {/* Hidden honeypot */}
              <div className="sr-only" aria-hidden="true">
                <label htmlFor="websiteConfirmHp">Leave blank</label>
                <input
                  id="websiteConfirmHp"
                  tabIndex={-1}
                  autoComplete="off"
                  {...form.register('websiteConfirmHp')}
                />
              </div>

              <div className="border-b border-border pb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-teal-700">
                  Step {step} of 5
                </span>
                <h1
                  ref={stepHeadingRef}
                  tabIndex={-1}
                  className="mt-1 text-2xl font-semibold text-ink focus:outline-none"
                >
                  {currentMeta.title}
                </h1>
                <p className="mt-1 text-sm text-muted">{currentMeta.whyWeAsk}</p>
              </div>

              {stepErrorSummary.length > 0 && (
                <div
                  role="alert"
                  className="mt-5 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800"
                >
                  <p className="font-semibold">Please check the following before continuing:</p>
                  <ul className="mt-1.5 list-disc pl-5 space-y-1 text-xs">
                    {stepErrorSummary.map((msg, idx) => (
                      <li key={idx}>{msg}</li>
                    ))}
                  </ul>
                </div>
              )}

              {submitError && (
                <div
                  role="alert"
                  className="mt-5 flex flex-wrap items-start justify-between gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800"
                >
                  <div className="flex flex-1 items-start gap-2.5 min-w-[200px]">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <p>{submitError}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={form.formState.isSubmitting}
                    onClick={() => void handleFinalSubmit()}
                    className="shrink-0 bg-white"
                  >
                    Retry
                  </Button>
                </div>
              )}

              {/* STEP 1 */}
              {step === 1 && (
                <div className="mt-6 space-y-5">
                  <div>
                    <Input
                      label="Business website URL"
                      required
                      placeholder="example.com"
                      helperText={
                        normalizedPreview && normalizedPreview !== watchedValues.website
                          ? `Will inspect: ${normalizedPreview}`
                          : 'Enter your main public website domain (http or https).'
                      }
                      error={form.formState.errors.website?.message}
                      {...form.register('website', {
                        onBlur: (e) => {
                          void runWebsitePrecheck(e.target.value);
                        },
                      })}
                    />

                    {/* Precheck feedback */}
                    {precheck.status === 'checking' && (
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        Checking website reachability...
                      </p>
                    )}

                    {precheck.status === 'done' && precheck.reachable && (
                      <div className="mt-2 space-y-2">
                        <p className="flex items-center gap-1.5 text-xs font-medium text-teal-700">
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Website accessible ({precheck.finalHost || precheck.normalizedUrl}) — we&apos;ll analyse your website and business information.
                        </p>
                        {precheck.redirectedCrossDomain && (
                          <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                            <p className="font-medium">
                              Your URL redirects to a different domain ({precheck.finalHost}).
                            </p>
                            <label className="mt-2 flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={Boolean(watchedValues.allowCrossDomainRedirect)}
                                onChange={(e) =>
                                  form.setValue('allowCrossDomainRedirect', e.target.checked)
                                }
                              />
                              <span>Proceed with inspecting {precheck.finalHost}</span>
                            </label>
                          </div>
                        )}
                      </div>
                    )}

                    {precheck.status === 'done' && !precheck.reachable && (
                      <p
                        className={cn(
                          'mt-2 flex items-start gap-1.5 rounded border px-3 py-2 text-xs',
                          precheck.urlStatus === 'URL_INVALID'
                            ? 'border-red-200 bg-red-50 text-red-800'
                            : 'border-amber-200 bg-amber-50 text-amber-900',
                        )}
                      >
                        {precheck.urlStatus === 'URL_INVALID' ? (
                          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        ) : (
                          <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        )}
                        <span>
                          {precheck.reason ||
                            (precheck.urlStatus === 'URL_INVALID'
                              ? 'Please enter a valid website address using HTTP or HTTPS.'
                              : "Your website URL is valid, but automated access was restricted. We'll use the business information you provide to prepare a limited assessment.")}
                        </span>
                      </p>
                    )}
                  </div>

                  <Input
                    label="Business name"
                    required
                    placeholder="e.g. Harbour Dental Studio"
                    error={form.formState.errors.businessName?.message}
                    {...form.register('businessName')}
                  />

                  <Controller
                    control={form.control}
                    name="industry"
                    render={({ field }) => (
                      <Combobox
                        label="Industry / category"
                        required
                        options={INDUSTRIES.map((i) => ({ value: i.value, label: i.label }))}
                        value={field.value}
                        onChange={field.onChange}
                        error={form.formState.errors.industry?.message}
                        searchPlaceholder="Search industry..."
                      />
                    )}
                  />

                  <Controller
                    control={form.control}
                    name="country"
                    render={({ field }) => (
                      <Combobox
                        label="Country"
                        required
                        options={COUNTRIES.map((c) => ({ value: c.code, label: c.name }))}
                        value={field.value}
                        onChange={field.onChange}
                        helperText="Determines regional AI data-processing availability."
                        error={form.formState.errors.country?.message}
                        searchPlaceholder="Search country..."
                      />
                    )}
                  />

                  {regionBlocked && (
                    <Callout variant="warning" title="Regional availability notice">
                      The free audit is not yet available in your region on our standard quota tier.
                      Please contact our team directly for regional availability.
                    </Callout>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="City / region (optional)"
                      placeholder="e.g. Austin, TX"
                      error={form.formState.errors.location?.message}
                      {...form.register('location')}
                    />
                    <Select
                      label="Business size (optional)"
                      placeholder="Select team size"
                      options={BUSINESS_SIZE_OPTIONS.map((s) => ({ value: s, label: s }))}
                      error={form.formState.errors.businessSize?.message}
                      {...form.register('businessSize')}
                    />
                  </div>
                </div>
              )}

              {/* STEP 2 */}
              {step === 2 && (
                <div className="mt-6 space-y-6">
                  <Textarea
                    label="What does your business primarily offer?"
                    required
                    rows={4}
                    placeholder="Briefly describe your core services, products, or who you serve (avoid personal or patient data)."
                    error={form.formState.errors.businessDescription?.message}
                    {...form.register('businessDescription')}
                  />

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-ink">
                        What are your biggest operational challenges?{' '}
                        <span className="text-red-700">*</span>
                      </label>
                      <span className="text-xs text-muted">Select all that apply</span>
                    </div>
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      {CHALLENGE_OPTIONS.map((option) => (
                        <Tile
                          key={option}
                          label={option}
                          selected={watchedValues.challenges.includes(option)}
                          onToggle={() => toggleArrayValue('challenges', option)}
                        />
                      ))}
                    </div>
                    {form.formState.errors.challenges?.message && (
                      <p role="alert" className="text-xs font-medium text-red-700">
                        {form.formState.errors.challenges.message}
                      </p>
                    )}
                  </div>

                  <Input
                    label="What tools are you currently using? (optional)"
                    placeholder="e.g. HubSpot, Google Calendar, Calendly, Xero, spreadsheets..."
                    helperText="Mentioning software helps tailor integration ideas (do not paste passwords)."
                    error={form.formState.errors.toolsUsed?.message}
                    {...form.register('toolsUsed')}
                  />
                </div>
              )}

              {/* STEP 3 */}
              {step === 3 && (
                <div className="mt-6 space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-ink">
                        What would you most like to improve?{' '}
                        <span className="text-red-700">*</span>
                      </label>
                      <span className="text-xs text-muted">Select all that apply</span>
                    </div>
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      {GOAL_OPTIONS.map((option) => (
                        <Tile
                          key={option}
                          label={option}
                          selected={watchedValues.goals.includes(option)}
                          onToggle={() => toggleArrayValue('goals', option)}
                        />
                      ))}
                    </div>
                    {form.formState.errors.goals?.message && (
                      <p role="alert" className="text-xs font-medium text-red-700">
                        {form.formState.errors.goals.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-ink">
                      Approximate monthly enquiries (optional)
                    </label>
                    <Controller
                      control={form.control}
                      name="enquiryVolume"
                      render={({ field }) => (
                        <SegmentedControl
                          ariaLabel="Approximate monthly enquiries"
                          options={VOLUME_RANGE_OPTIONS}
                          value={field.value || ''}
                          onChange={field.onChange}
                        />
                      )}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-ink">
                      Approximate monthly phone calls (optional)
                    </label>
                    <Controller
                      control={form.control}
                      name="phoneVolume"
                      render={({ field }) => (
                        <SegmentedControl
                          ariaLabel="Approximate monthly phone calls"
                          options={VOLUME_RANGE_OPTIONS}
                          value={field.value || ''}
                          onChange={field.onChange}
                        />
                      )}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Team size handling enquiries (optional)"
                      placeholder="e.g. 2 front-desk staff"
                      error={form.formState.errors.teamSize?.message}
                      {...form.register('teamSize')}
                    />
                  </div>

                  <Textarea
                    label="Current manual processes (optional)"
                    rows={3}
                    placeholder="e.g. Staff manually reply to contact forms and copy details into spreadsheets..."
                    error={form.formState.errors.manualProcesses?.message}
                    {...form.register('manualProcesses')}
                  />

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-ink">
                      Expected implementation timeframe (optional)
                    </label>
                    <Controller
                      control={form.control}
                      name="timeframe"
                      render={({ field }) => (
                        <SegmentedControl
                          ariaLabel="Expected implementation timeframe"
                          options={TIMEFRAME_OPTIONS}
                          value={field.value || ''}
                          onChange={field.onChange}
                        />
                      )}
                    />
                  </div>
                </div>
              )}

              {/* STEP 4 */}
              {step === 4 && (
                <div className="mt-6 space-y-5">
                  <Callout variant="privacy" title="Private contact handling">
                    Your name, email and phone number are used only by Amarketing to contact you.
                    They are never sent to the AI service.
                  </Callout>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Full name"
                      required
                      placeholder="Jordan Taylor"
                      error={form.formState.errors.contactName?.message}
                      {...form.register('contactName')}
                    />
                    <Input
                      label="Business email"
                      type="email"
                      required
                      placeholder="jordan@company.com"
                      error={form.formState.errors.contactEmail?.message}
                      {...form.register('contactEmail')}
                    />
                    <Input
                      label="Phone number (optional)"
                      type="tel"
                      placeholder="+1 (555) 234-5678"
                      error={form.formState.errors.contactPhone?.message}
                      {...form.register('contactPhone')}
                    />
                    <Input
                      label="Your role / position (optional)"
                      placeholder="e.g. Owner, Practice Manager"
                      error={form.formState.errors.contactRole?.message}
                      {...form.register('contactRole')}
                    />
                  </div>

                  <Callout variant="warning" title="Important data protection reminder">
                    {AUDIT_SENSITIVE_DATA_WARNING}
                  </Callout>

                  <div className="space-y-3 rounded-md border border-border bg-subtle/40 p-4">
                    <label className="flex items-start gap-3 text-sm text-ink cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-border accent-emerald-500"
                        {...form.register('consent')}
                      />
                      <span>
                        {AUDIT_REQUIRED_CONSENT_TEXT}{' '}
                        <span className="text-red-700" aria-hidden="true">
                          *
                        </span>
                      </span>
                    </label>
                    {form.formState.errors.consent?.message && (
                      <p role="alert" className="text-xs font-medium text-red-700">
                        {form.formState.errors.consent.message}
                      </p>
                    )}

                    <label className="flex items-start gap-3 border-t border-border pt-3 text-sm text-ink cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-border accent-emerald-500"
                        {...form.register('processingNoticeAck')}
                      />
                      <span>
                        {AUDIT_PROCESSING_NOTICE_TEXT}{' '}
                        <span className="text-red-700" aria-hidden="true">
                          *
                        </span>
                      </span>
                    </label>
                    {form.formState.errors.processingNoticeAck?.message && (
                      <p role="alert" className="text-xs font-medium text-red-700">
                        {form.formState.errors.processingNoticeAck.message}
                      </p>
                    )}
                  </div>

                  {/* Separate optional marketing consent */}
                  <div className="rounded-md border border-border bg-surface p-4">
                    <label className="flex items-start gap-3 text-sm text-muted cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-border accent-emerald-500"
                        {...form.register('marketingConsent')}
                      />
                      <span>
                        Optional: Send me occasional AI automation guides and updates from
                        Amarketing Advertising (you can unsubscribe at any time).
                      </span>
                    </label>
                  </div>

                  {turnstileSiteKey && (
                    <div className="pt-1">
                      <div className="cf-turnstile" data-sitekey={turnstileSiteKey} />
                    </div>
                  )}
                </div>
              )}

              {/* STEP 5 */}
              {step === 5 && (
                <div className="mt-6 space-y-5">
                  <div className="rounded-md border border-border bg-subtle/50 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-ink">1. Business Information</h2>
                      <button
                        type="button"
                        onClick={() => moveToStep(1)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
                      >
                        <Pencil className="h-3 w-3" aria-hidden="true" /> Edit
                      </button>
                    </div>
                    <p className="text-sm text-ink font-medium">{watchedValues.businessName}</p>
                    <p className="font-mono text-xs text-muted">{normalizedPreview}</p>
                    <p className="text-xs text-muted">
                      {watchedValues.industry} · {watchedValues.country}
                      {watchedValues.location ? ` · ${watchedValues.location}` : ''}
                    </p>
                  </div>

                  <div className="rounded-md border border-border bg-subtle/50 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-ink">2. Business Context</h2>
                      <button
                        type="button"
                        onClick={() => moveToStep(2)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
                      >
                        <Pencil className="h-3 w-3" aria-hidden="true" /> Edit
                      </button>
                    </div>
                    <p className="text-xs leading-relaxed text-muted">
                      {watchedValues.businessDescription}
                    </p>
                    <p className="text-xs text-ink">
                      <span className="font-medium">Challenges:</span>{' '}
                      {watchedValues.challenges.join(', ')}
                    </p>
                    {watchedValues.toolsUsed && (
                      <p className="text-xs text-muted">Tools: {watchedValues.toolsUsed}</p>
                    )}
                  </div>

                  <div className="rounded-md border border-border bg-subtle/50 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-ink">3. Goals &amp; Scale</h2>
                      <button
                        type="button"
                        onClick={() => moveToStep(3)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
                      >
                        <Pencil className="h-3 w-3" aria-hidden="true" /> Edit
                      </button>
                    </div>
                    <p className="text-xs text-ink">
                      <span className="font-medium">Goals:</span> {watchedValues.goals.join(', ')}
                    </p>
                    <p className="text-xs text-muted">
                      Timeframe: {watchedValues.timeframe || 'Not specified'} · Enquiries:{' '}
                      {watchedValues.enquiryVolume || 'Not specified'}
                    </p>
                  </div>

                  <div className="rounded-md border border-border bg-subtle/50 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-ink">4. Contact &amp; Consent</h2>
                      <button
                        type="button"
                        onClick={() => moveToStep(4)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
                      >
                        <Pencil className="h-3 w-3" aria-hidden="true" /> Edit
                      </button>
                    </div>
                    <p className="text-xs text-ink">
                      {watchedValues.contactName} ({watchedValues.contactEmail})
                      {watchedValues.contactRole ? ` — ${watchedValues.contactRole}` : ''}
                    </p>
                    <p className="text-xs text-teal-700">
                      Audit consent &amp; AI processing notice confirmed
                    </p>
                  </div>

                  {regionBlocked && (
                    <div className="flex items-center gap-2 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>The free audit is not yet available in your selected region.</span>
                    </div>
                  )}
                </div>
              )}

              {/* Desktop / Sticky Mobile Action Bar */}
              <div className="sticky bottom-0 z-20 -mx-6 mt-8 border-t border-border bg-surface/95 px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-6">
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                  {step > 1 ? (
                    <Button
                      variant="outline"
                      onClick={() => moveToStep(step - 1)}
                      disabled={form.formState.isSubmitting}
                      className="w-full sm:w-auto"
                    >
                      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                      Previous
                    </Button>
                  ) : (
                    <div />
                  )}

                  {step < 5 ? (
                    <Button
                      key="wizard-continue-btn"
                      type="button"
                      variant="primary"
                      onClick={(e) => {
                        e.preventDefault();
                        void handleContinue();
                      }}
                      disabled={step === 1 && regionBlocked}
                      className="w-full sm:w-auto"
                    >
                      Continue
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  ) : (
                    <Button
                      key="wizard-submit-btn"
                      type="submit"
                      variant="cta"
                      size="lg"
                      loading={form.formState.isSubmitting}
                      disabled={regionBlocked}
                      className="w-full sm:w-auto"
                    >
                      Generate My Free AI Business Audit
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
