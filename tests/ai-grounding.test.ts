import { describe, it, expect, afterEach } from 'vitest';
import {
  AuditReportSchema,
  getGeminiResponseJsonSchema,
} from '@/lib/ai/report-schema';
import {
  buildAiSafeAuditInput,
  MAX_AI_PAYLOAD_CHARS,
  serializeAiPromptPayload,
} from '@/lib/ai/input-builder';
import { applyDeterministicGrounding } from '@/lib/ai/grounding';
import {
  generateGroundedAuditReport,
  GeminiGenerationError,
  GeminiQuotaError,
  setMockAiAdapterForTesting,
} from '@/lib/ai/gemini-client';
import { WILLOW_CREEK_SAMPLE_REPORT } from '@/lib/sample/willow-creek';
import { resetEnvCache } from '@/lib/env';
import type { ExtractedPageResult } from '@/lib/extraction/extract-page';

function makeFixturePage(label = 'P1', url = 'https://dentalclinic.example/'): ExtractedPageResult {
  return {
    pageLabel: label,
    url,
    pageTitle: 'Harbour Dental Studio',
    httpStatus: 200,
    extractedText:
      'Harbour Dental Studio offers family checkups, cosmetic whitening, and emergency appointments. Call our front desk or request an enquiry online.',
    metadata: {
      title: 'Harbour Dental Studio',
      metaDescription: 'Family dental clinic',
      canonicalUrl: url,
      lang: 'en',
      h1: ['Modern Family Dentistry'],
      h2: ['Our Dental Treatments'],
      navLinks: [{ url: `${url}services`, text: 'Services' }],
      internalLinks: [],
      externalLinks: [],
      ctaButtons: ['Request an Enquiry'],
      visiblePhones: ['+1 555 222 3333'],
      visibleEmails: ['desk@dentalclinic.example'],
      visibleAddresses: ['100 Harbour St'],
      servicesMentioned: ['Cosmetic Whitening'],
      imageAlts: ['Dental chair'],
      testimonialsSnippet: [],
      bookingAndEnquiryLinks: [],
      socialLinks: [],
      jsonLdTypes: ['Dentist'],
      openGraph: {},
      signals: [
        {
          id: 'contact_form_present',
          label: 'Website enquiry or contact form',
          category: 'contact',
          found: true,
          evidence: 'Form detected (action/CTA: Request an Enquiry)',
          pageId: label,
        },
      ],
      possibleInjection: { flagged: false, matches: [] },
      isJsShell: false,
    },
    contentHash: 'hash123',
    extractionStatus: 'OK',
  };
}

describe('Report Schema & Sample Dataset', () => {
  it('validates Willow Creek sample report and strips unsupported JSON schema keywords', () => {
    expect(() => AuditReportSchema.parse(WILLOW_CREEK_SAMPLE_REPORT)).not.toThrow();

    const jsonSchema = getGeminiResponseJsonSchema();
    const serialized = JSON.stringify(jsonSchema);
    expect(serialized).not.toContain('"$schema"');
    expect(serialized).not.toContain('"maxLength"');
    expect(serialized).not.toContain('"minLength"');
  });

  it('rejects unknown serviceTag values in schema validation', () => {
    const cloned = structuredClone(WILLOW_CREEK_SAMPLE_REPORT) as Record<string, unknown>;
    const opps = cloned.automationOpportunities as Array<Record<string, unknown>>;
    opps[0]!.serviceTag = 'non-existent-service-id';
    const res = AuditReportSchema.safeParse(cloned);
    expect(res.success).toBe(false);
  });
});

describe('AI Safe Input Builder & PII Scrubbing', () => {
  it('never leaks contact details and scrubs free-text identifiers while capping size', () => {
    const rawAuditWithContact = {
      businessName: 'Harbour Dental Studio',
      website: 'https://dentalclinic.example/',
      industry: 'Dental',
      country: 'US',
      location: 'Seattle',
      businessSize: '6–15 team members',
      businessDescription:
        'We offer checkups. Personal contact is secretperson@private-mail.com or 415-888-9999.',
      challenges: ['Missed phone calls'],
      goals: ['Automate appointments and bookings'],
      toolsUsed: 'Spreadsheet and inbox (admin password=Secret123!)',
      enquiryVolume: '100–300 / month',
      phoneVolume: '100–300 / month',
      teamSize: '10',
      manualProcesses: 'Calling back leads manually via +1 206-555-7788',
      timeframe: 'Within 1–3 months',
      crawlCoverage: 'COMPLETE' as const,
      signals: makeFixturePage().metadata.signals,
      pages: [
        {
          ...makeFixturePage('P1'),
          extractedText: 'A'.repeat(12_000),
        },
        {
          ...makeFixturePage('P2', 'https://dentalclinic.example/services'),
          extractedText: 'B'.repeat(12_000),
        },
        {
          ...makeFixturePage('P3', 'https://dentalclinic.example/about'),
          extractedText: 'C'.repeat(12_000),
        },
      ],
      // Extra contact properties that might exist on a broader object in caller code
      contactName: 'Alice SecretOwner',
      contactEmail: 'alice.owner@dentalclinic.example',
      contactPhone: '+1-999-444-1212',
    };

    const safeInput = buildAiSafeAuditInput(rawAuditWithContact);
    const payload = serializeAiPromptPayload(safeInput);

    expect(payload.length).toBeLessThanOrEqual(MAX_AI_PAYLOAD_CHARS);
    expect(payload).toContain('<website_content untrusted="true">');
    expect(payload).not.toContain('Alice SecretOwner');
    expect(payload).not.toContain('alice.owner@dentalclinic.example');
    expect(payload).not.toContain('999-444-1212');
    expect(payload).not.toContain('secretperson@private-mail.com');
    expect(payload).not.toContain('415-888-9999');
    expect(payload).not.toContain('206-555-7788');
    expect(payload).not.toContain('Secret123!');
  });
});

describe('Deterministic Grounding Pass', () => {
  it('resolves valid VERIFIED_OBSERVATION URLs, downgrades ungrounded ones, and removes unsupported absence claims', () => {
    const page1 = makeFixturePage('P1', 'https://dentalclinic.example/');
    const report = structuredClone(WILLOW_CREEK_SAMPLE_REPORT);
    report.auditSections = [
      {
        category: 'Digital Presence',
        status: 'OPPORTUNITIES_IDENTIFIED',
        summary: 'Summary with https://hallucinated.bad/path inside text.',
        findings: [
          {
            title: 'Grounded observation from P1',
            observation: 'The homepage highlights cosmetic whitening and emergency appointments.',
            evidence: 'family checkups, cosmetic whitening, and emergency appointments',
            evidenceRef: 'P1',
            sourceUrl: 'https://model-invented.evil/wrong',
            evidenceType: 'VERIFIED_OBSERVATION',
            businessImpact: 'Clear treatment positioning makes enquiries easier to qualify.',
            recommendation: 'Add a guided enquiry assistant alongside the form.',
            priority: 'MEDIUM',
            confidence: 'HIGH',
            serviceTag: 'website-enquiry-assistant',
          },
          {
            title: 'Hallucinated quote marked verified',
            observation: 'They offer 24/7 drone delivery for retainers.',
            evidence: '24/7 drone delivery across every zip code',
            evidenceRef: 'P1',
            sourceUrl: 'https://model-invented.evil/fake',
            evidenceType: 'VERIFIED_OBSERVATION',
            businessImpact: 'May confuse visitors.',
            recommendation: 'Clarify turnaround times.',
            priority: 'LOW',
            confidence: 'HIGH',
            serviceTag: 'website-enquiry-assistant',
          },
          {
            title: 'Unsupported absence claim',
            observation: 'The clinic has no online booking system on their website.',
            evidence: 'no online booking anywhere',
            evidenceRef: 'P9',
            sourceUrl: 'https://model-invented.evil/no-booking',
            evidenceType: 'VERIFIED_OBSERVATION',
            businessImpact: 'Patients cannot self-book.',
            recommendation: 'Add online booking.',
            priority: 'HIGH',
            confidence: 'HIGH',
            serviceTag: 'appointment-booking-automation',
          },
        ],
      },
      report.auditSections[2]!,
    ];

    const grounded = applyDeterministicGrounding(report, {
      pages: [page1],
      signals: page1.metadata.signals,
      coverage: 'PARTIAL',
      model: 'gemini-3.8-flash',
      promptVersion: '2026.11.v1',
      reportVersion: '1.0',
      generatedAt: '2026-11-26T00:00:00.000Z',
    });

    const findings = grounded.report.auditSections[0]!.findings;
    expect(findings.length).toBe(2);

    // 1st finding stays VERIFIED_OBSERVATION with authoritative crawled URL
    expect(findings[0]?.evidenceType).toBe('VERIFIED_OBSERVATION');
    expect(findings[0]?.sourceUrl).toBe('https://dentalclinic.example/');

    // 2nd finding downgraded to AI_HYPOTHESIS LOW confidence with sourceUrl cleared
    expect(findings[1]?.evidenceType).toBe('AI_HYPOTHESIS');
    expect(findings[1]?.confidence).toBe('LOW');
    expect(findings[1]?.sourceUrl).toBeNull();

    // 3rd finding (unsupported absence claim) removed completely
    expect(grounded.stats.downgradedCount).toBe(2);
    expect(grounded.stats.removedCount).toBe(1);
    expect(grounded.report.auditSections[0]!.summary).not.toContain('https://hallucinated.bad/path');
  });
});

describe('Gemini Client Mock Adapter, Repair Retry & Quota Fallback', () => {
  afterEach(() => {
    setMockAiAdapterForTesting(null);
    delete process.env.GEMINI_FALLBACK_MODEL;
    resetEnvCache();
  });

  const baseRaw = {
    businessName: 'Harbour Dental Studio',
    website: 'https://dentalclinic.example/',
    industry: 'Dental',
    country: 'US',
    businessDescription: 'Modern family dental clinic.',
    challenges: ['Missed phone calls'],
    goals: ['Automate appointments and bookings'],
    crawlCoverage: 'PARTIAL' as const,
    signals: makeFixturePage().metadata.signals,
    pages: [makeFixturePage('P1')],
  };

  it('forbids mock adapter when NODE_ENV=production', () => {
    const prev = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    try {
      expect(() =>
        setMockAiAdapterForTesting({
          generateText: async () => '{}',
        }),
      ).toThrow(/forbidden/i);
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = prev;
    }
  });

  it('performs at most one repair retry on malformed JSON and succeeds on second call', async () => {
    let calls = 0;
    setMockAiAdapterForTesting({
      async generateText() {
        calls += 1;
        if (calls === 1) return '{ invalid json';
        return JSON.stringify(WILLOW_CREEK_SAMPLE_REPORT);
      },
    });

    const result = await generateGroundedAuditReport(baseRaw);
    expect(result.callsUsed).toBe(2);
    expect(result.report.meta.coverage).toBe('PARTIAL');
  });

  it('fails cleanly after at most 2 calls if repair also produces invalid schema', async () => {
    let calls = 0;
    setMockAiAdapterForTesting({
      async generateText() {
        calls += 1;
        return JSON.stringify({ broken: true });
      },
    });

    await expect(generateGroundedAuditReport(baseRaw)).rejects.toThrow(GeminiGenerationError);
    expect(calls).toBe(2);
  });

  it('retries fallback model once on 429 and throws GeminiQuotaError when exhausted', async () => {
    process.env.GEMINI_FALLBACK_MODEL = 'gemini-2.5-flash';
    resetEnvCache();

    const triedModels: string[] = [];
    setMockAiAdapterForTesting({
      async generateText({ model }) {
        triedModels.push(model);
        if (triedModels.length === 1) {
          const err = new Error('429 RESOURCE_EXHAUSTED');
          (err as unknown as { status: number }).status = 429;
          throw err;
        }
        return JSON.stringify(WILLOW_CREEK_SAMPLE_REPORT);
      },
    });

    const res = await generateGroundedAuditReport(baseRaw);
    expect(triedModels).toEqual(['gemini-3.8-flash', 'gemini-2.5-flash']);
    expect(res.usedModel).toBe('gemini-2.5-flash');

    // Now simulate both failing with 503
    setMockAiAdapterForTesting({
      async generateText() {
        const err = new Error('503 Service Unavailable');
        (err as unknown as { status: number }).status = 503;
        throw err;
      },
    });
    await expect(generateGroundedAuditReport(baseRaw)).rejects.toThrow(GeminiQuotaError);
  });
});
