// tests/roi-assistant-ui-and-sample.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createClient } from '@libsql/client';
import { resetEnvCache } from '@/lib/env';
import { resetDbForTesting, setTestDb } from '@/lib/db';
import { runMigrations } from '@/lib/db/migrate';
import {
  getLandingIncludedSections,
  getTocEntries,
  getVisibleBodySections,
} from '@/lib/report/section-config';
import { getWillowCreekSampleReply } from '@/lib/sample/willow-creek-assistant';
import {
  getWillowCreekSampleRoiOutputs,
  WILLOW_CREEK_SAMPLE_REPORT,
  WILLOW_CREEK_SAMPLE_ROI_INPUTS,
  WILLOW_CREEK_SAMPLE_SCENARIOS,
} from '@/lib/sample/willow-creek';
import { calculateAllScenarios } from '@/lib/roi/calculator';
import { getAdminRoiAndAssistantStats } from '@/lib/db/repositories/roi-assistant-analytics.repo';
import { enforceAssistantRateLimits, enforceRoiSaveRateLimit } from '@/lib/security/rate-limit';
import { AssistantMarkdown } from '@/components/assistant/assistant-markdown';

describe('Section Config, Sample Assistant, Markdown Security & Admin Analytics', () => {
  beforeEach(async () => {
    process.env.DATABASE_URL = 'file::memory:';
    resetEnvCache();
    const client = createClient({ url: ':memory:' });
    const db = setTestDb(client);
    await runMigrations(db);
  });

  afterEach(() => {
    resetDbForTesting();
  });

  it('drives body, TOC, and landing lists sequentially from section-config including ROI and Assistant', () => {
    const body = getVisibleBodySections(WILLOW_CREEK_SAMPLE_REPORT);
    expect(body.map((s) => s.number)).toEqual(body.map((_, i) => i + 1));
    expect(body[5]?.id).toBe('roi');
    expect(body[5]?.title).toBe('Calculate Your Automation Potential');

    const toc = getTocEntries(WILLOW_CREEK_SAMPLE_REPORT);
    expect(toc.some((t) => t.id === 'roi' && t.label.includes('ROI Simulator'))).toBe(true);
    expect(toc.some((t) => t.id === 'assistant' && t.label === 'Ask Your AI Consultant')).toBe(true);

    const landing = getLandingIncludedSections();
    expect(landing.some((l) => l.id === 'roi')).toBe(true);
    expect(landing.some((l) => l.id === 'assistant')).toBe(true);
    expect(landing.map((l) => Number(l.num))).toEqual(landing.map((_, i) => i + 1));
  });

  it('answers all 7 sample topics offline and dynamically tracks sample ROI state', () => {
    const queries = [
      'What is our biggest automation opportunity?',
      'How much admin time could we reclaim?',
      'How would an AI receptionist work?',
      'How do missed-call follow-ups work?',
      'What should we implement first?',
      'Explain the ROI calculation and formulas',
      'What happens in the first 30 days?',
    ];
    for (const q of queries) {
      const res = getWillowCreekSampleReply(q);
      expect(res.topic).not.toBe('unsupported');
      expect(res.payload.answer.length).toBeGreaterThan(30);
    }

    // Dynamic update when sample ROI inputs change
    const modified = getWillowCreekSampleReply('How much admin time could we reclaim?', {
      roiInputs: { ...WILLOW_CREEK_SAMPLE_ROI_INPUTS, monthlyAdminTasks: 1000, minutesPerAdminTask: 6 },
      scenarios: WILLOW_CREEK_SAMPLE_SCENARIOS,
      selectedScenario: 'moderate',
    });
    expect(modified.payload.answer).toContain('60.00 hours/month');

    const fallback = getWillowCreekSampleReply('What is the weather on Mars?');
    expect(fallback.topic).toBe('unsupported');
    expect(fallback.payload.answer).toContain('DEMO ASSISTANT – SAMPLE BUSINESS AND SIMULATED RESPONSES.');

    // Landing and sample report share exact calculator outputs
    const helperOut = getWillowCreekSampleRoiOutputs();
    const directOut = calculateAllScenarios(WILLOW_CREEK_SAMPLE_ROI_INPUTS, WILLOW_CREEK_SAMPLE_SCENARIOS);
    expect(helperOut.moderate.capacityValueAnnual).toBe(directOut.moderate.capacityValueAnnual);
  });

  it('strips raw HTML, images, and javascript: links in AssistantMarkdown', () => {
    const html = renderToStaticMarkup(
      React.createElement(AssistantMarkdown, {
        content:
          'Safe **bold** text [ok](https://example.com) [bad](javascript:alert(1)) ![img](https://evil.test/a.png) <script>alert(1)</script><div>raw</div>',
      }),
    );
    expect(html).toContain('Safe');
    expect(html).toMatch(/<strong[^>]*>bold<\/strong>/);
    expect(html).toContain('https://example.com');
    expect(html).toContain('nofollow');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<div>');
  });

  it('returns null/zero (no sample leakage) in admin analytics when DB has no live usage, and enforces rate limits', async () => {
    const stats = await getAdminRoiAndAssistantStats();
    expect(stats.roi.reportsUsedCount).toBe(0);
    expect(stats.roi.avgMonthlyAdminTasks.avg).toBeNull();
    expect(stats.assistant.totalCustomerMessages).toBe(0);
    expect(stats.assistant.assistantToConsultConversionPct).toBeNull();

    for (let i = 0; i < 60; i++) {
      const ok = await enforceRoiSaveRateLimit('tok_rl');
      expect(ok.allowed).toBe(true);
    }
    const overRoi = await enforceRoiSaveRateLimit('tok_rl');
    expect(overRoi.allowed).toBe(false);

    for (let i = 0; i < 8; i++) {
      const ok = await enforceAssistantRateLimits({
        ipHash: 'ip_1',
        publicToken: 'tok_asst_rl',
        dailyLimit: 200,
      });
      expect(ok.allowed).toBe(true);
    }
    const overAsst = await enforceAssistantRateLimits({
      ipHash: 'ip_1',
      publicToken: 'tok_asst_rl',
      dailyLimit: 200,
    });
    expect(overAsst.allowed).toBe(false);
  });
});
