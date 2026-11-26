// src/lib/ai/assistant-validation.ts
import { z } from 'zod';
import { stripUnsupportedJsonSchemaKeys } from '@/lib/ai/report-schema';
import type { AssistantResponsePayload } from '@/lib/ai/assistant-types';

export const AssistantCtaSchema = z
  .object({
    show: z.boolean(),
    label: z.string().trim().max(80),
    type: z.enum(['CONSULTATION', 'PILOT', 'BOOKING']),
  })
  .strict();

export const AssistantResponseSchema = z
  .object({
    answer: z.string().trim().min(5).max(3000),
    relatedFindingIds: z.array(z.string().trim().max(30)).max(6),
    relatedOpportunityIds: z.array(z.string().trim().max(30)).max(6),
    suggestedFollowUpQuestions: z.array(z.string().trim().min(3).max(160)).max(3),
    cta: AssistantCtaSchema,
  })
  .strict();

export function getAssistantResponseJsonSchema(): Record<string, unknown> {
  const raw = z.toJSONSchema(AssistantResponseSchema);
  return stripUnsupportedJsonSchemaKeys(raw) as Record<string, unknown>;
}

const URL_REGEX = /\b(?:https?:\/\/[^\s)>\]"']+|www\.[a-z0-9.-]+\.[a-z]{2,}[^\s)>\]"']*)/gi;
const ROADMAP_LABEL_REGEX =
  /\b(?:days?\s*)?(?:30\s*\/\s*60\s*\/\s*90|31\s*[–-]\s*60|61\s*[–-]\s*90|(?:first\s+|within\s+)?(?:30|60|90)[-\s]?days?)\b/gi;

const CURRENCY_PREFIX_NUM = /(?:[$£€₹]|USD|INR|GBP|EUR|AED)\s*(\d[\d,]*(?:\.\d+)?)/gi;
const UNIT_SUFFIX_NUM =
  /(\d[\d,]*(?:\.\d+)?)\s*(?:%|percent\b|USD\b|INR\b|GBP\b|EUR\b|AED\b|hours?\b|hrs?\b|h\b|minutes?\b|mins?\b|customers?\b|clients?\b|enquiries\b|inquiries\b|calls?\b|tasks?\b|months?\b|years?\b|yr\b)/gi;

function normalizeNumericToken(raw: string): string {
  const noComma = raw.replace(/,/g, '').trim();
  const num = Number(noComma);
  if (!Number.isFinite(num)) return noComma;
  return String(num);
}

export function extractAllowedNumbers(contextText: string): Set<string> {
  const set = new Set<string>();
  const matches = contextText.match(/\d[\d,]*(?:\.\d+)?/g) ?? [];
  for (const m of matches) {
    set.add(normalizeNumericToken(m));
    const n = Number(m.replace(/,/g, ''));
    if (Number.isFinite(n)) {
      set.add(String(Math.round(n)));
    }
  }
  return set;
}

export function checkAssistantFigures(params: {
  answer: string;
  allowedContextText: string;
}): { ok: true } | { ok: false; ungroundedFigures: string[] } {
  const allowed = extractAllowedNumbers(params.allowedContextText);
  const scrubbedAnswer = params.answer.replace(ROADMAP_LABEL_REGEX, ' ');

  const bad: string[] = [];
  for (const regex of [CURRENCY_PREFIX_NUM, UNIT_SUFFIX_NUM]) {
    regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(scrubbedAnswer)) !== null) {
      const rawNum = m[1];
      if (!rawNum) continue;
      const norm = normalizeNumericToken(rawNum);
      if (!allowed.has(norm)) {
        bad.push(m[0].trim());
      }
    }
  }

  return bad.length === 0 ? { ok: true } : { ok: false, ungroundedFigures: Array.from(new Set(bad)) };
}

export function stripUrlsFromText(text: string): string {
  return text.replace(URL_REGEX, '[link removed]');
}

const IMPL_INTENT_REGEX = /\b(implement|pilot|book|call|start|pricing|cost|quote|next step|work together)\b/i;

export function postValidateAssistantResponse(params: {
  raw: AssistantResponsePayload;
  validFindingIds: Set<string>;
  validOpportunityIds: Set<string>;
  userMessage: string;
  recentCtaShownCount: number;
}): AssistantResponsePayload {
  const allowCta = params.recentCtaShownCount === 0 || IMPL_INTENT_REGEX.test(params.userMessage);

  return {
    answer: stripUrlsFromText(params.raw.answer).slice(0, 2800),
    relatedFindingIds: params.raw.relatedFindingIds.filter((id) => params.validFindingIds.has(id)).slice(0, 5),
    relatedOpportunityIds: params.raw.relatedOpportunityIds
      .filter((id) => params.validOpportunityIds.has(id))
      .slice(0, 5),
    suggestedFollowUpQuestions: params.raw.suggestedFollowUpQuestions
      .map((q) => stripUrlsFromText(q).slice(0, 140))
      .filter(Boolean)
      .slice(0, 3),
    cta:
      allowCta && params.raw.cta.show
        ? {
            show: true,
            label: params.raw.cta.label.slice(0, 60) || 'Discuss My Audit',
            type: params.raw.cta.type,
          }
        : { show: false, label: '', type: 'CONSULTATION' },
  };
}
