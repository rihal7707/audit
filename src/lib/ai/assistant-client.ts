// src/lib/ai/assistant-client.ts
import 'server-only';
import { GoogleGenAI } from '@google/genai';
import { getEnv } from '@/lib/env';
import {
  buildModelCandidateList,
  RESILIENCE_FLASH_MODELS,
  selectGeminiModel,
} from '@/lib/ai/select-model';
import { AUDIT_ASSISTANT_SYSTEM_PROMPT } from '@/lib/ai/audit-assistant-prompt';
import {
  AssistantResponseSchema,
  checkAssistantFigures,
  getAssistantResponseJsonSchema,
  postValidateAssistantResponse,
} from '@/lib/ai/assistant-validation';
import type { AssistantResponsePayload } from '@/lib/ai/assistant-types';

export class AssistantQuotaError extends Error {
  public readonly statusCode: number;
  constructor(message: string, statusCode = 429) {
    super(message);
    this.name = 'AssistantQuotaError';
    this.statusCode = statusCode;
  }
}

export class AssistantConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssistantConfigError';
  }
}

export class AssistantGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssistantGenerationError';
  }
}

export interface AssistantModelClient {
  generateReply(params: {
    model: string;
    systemInstruction: string;
    prompt: string;
    responseJsonSchema: Record<string, unknown>;
    maxOutputTokens: number;
  }): Promise<{ text: string; finishReason?: string }>;
}

let testMockClient: AssistantModelClient | null = null;

export function setMockAssistantAdapterForTesting(client: AssistantModelClient | null): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Mock assistant adapter cannot be used in production.');
  }
  testMockClient = client;
}

export function hasMockAssistantAdapterForTesting(): boolean {
  return process.env.NODE_ENV !== 'production' && testMockClient !== null;
}

function getHttpStatus(err: unknown): number | null {
  if (!err || typeof err !== 'object') return null;
  const rec = err as Record<string, unknown>;
  if (typeof rec.status === 'number') return rec.status;
  if (typeof rec.statusCode === 'number') return rec.statusCode;
  const msg = String(rec.message || '');
  if (/\b429\b|RESOURCE_EXHAUSTED|quota/i.test(msg)) return 429;
  if (/\b503\b|\b504\b|\b502\b|UNAVAILABLE|DEADLINE_EXCEEDED|overloaded|timeout/i.test(msg)) return 503;
  if (/\b401\b|\b403\b|API_KEY_INVALID|invalid api key|unauthorized/i.test(msg)) return 401;
  return null;
}

function isTransientStatus(status: number | null): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function createRealClient(apiKey: string): AssistantModelClient {
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { timeout: 20_000, retryOptions: { attempts: 1 } },
  });
  return {
    async generateReply({ model, systemInstruction, prompt, responseJsonSchema, maxOutputTokens }) {
      const res = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.2,
          maxOutputTokens,
          responseMimeType: 'application/json',
          responseJsonSchema,
        },
      });
      const finishReason = res.candidates?.[0]?.finishReason;
      const text = res.text ?? '';
      if (!text.trim()) {
        throw new AssistantGenerationError(`Empty assistant response (finishReason=${finishReason ?? 'unknown'})`);
      }
      return { text, finishReason: finishReason ? String(finishReason) : undefined };
    },
  };
}

function stripFences(raw: string): string {
  const t = raw.trim();
  return t.startsWith('```') ? t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim() : t;
}

async function callWithFallback(params: {
  client: AssistantModelClient;
  primaryModel: string;
  fallbackModel?: string;
  extraFallbacks?: string[];
  prompt: string;
  schema: Record<string, unknown>;
  maxOutputTokens: number;
}): Promise<{ text: string; finishReason?: string; usedModel: string }> {
  const invoke = (model: string) =>
    params.client.generateReply({
      model,
      systemInstruction: AUDIT_ASSISTANT_SYSTEM_PROMPT,
      prompt: params.prompt,
      responseJsonSchema: params.schema,
      maxOutputTokens: params.maxOutputTokens,
    });

  const candidates = buildModelCandidateList(
    params.primaryModel,
    params.fallbackModel,
    params.extraFallbacks ?? [],
  );
  let lastErr: unknown = new AssistantGenerationError('No assistant model candidates available.');
  let sawTransient = false;
  let lastTransientStatus = 503;

  for (const model of candidates) {
    try {
      const out = await invoke(model);
      return { ...out, usedModel: model };
    } catch (err) {
      lastErr = err;
      const status = getHttpStatus(err);
      if (status === 401 || status === 403) {
        throw new AssistantConfigError('AI service authentication is unavailable.');
      }
      if (isTransientStatus(status)) {
        sawTransient = true;
        lastTransientStatus = status || 503;
        continue;
      }
      if (status === 404) {
        continue;
      }
      throw err;
    }
  }

  if (sawTransient) {
    throw new AssistantQuotaError('Assistant capacity is temporarily busy.', lastTransientStatus);
  }
  throw lastErr;
}

export async function generateAuditAssistantReply(params: {
  contextText: string;
  history: Array<{ role: 'user' | 'assistant'; message: string }>;
  userMessage: string;
  validFindingIds: Set<string>;
  validOpportunityIds: Set<string>;
  recentCtaShownCount: number;
}): Promise<{ payload: AssistantResponsePayload; usedModel: string; callsUsed: number }> {
  const env = getEnv();
  let client: AssistantModelClient;
  if (testMockClient) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Mock assistant adapter forbidden in production.');
    }
    client = testMockClient;
  } else {
    if (!env.GEMINI_API_KEY) {
      throw new AssistantConfigError('GEMINI_API_KEY is not configured.');
    }
    client = createRealClient(env.GEMINI_API_KEY);
  }

  const primaryModel = await selectGeminiModel();
  const schema = getAssistantResponseJsonSchema();

  const historyBlock = params.history
    .map((h) => `${h.role === 'user' ? 'USER' : 'ASSISTANT'}: ${h.message.slice(0, 600)}`)
    .join('\n');

  const basePrompt = [
    '<audit_context untrusted="true">',
    params.contextText,
    '</audit_context>',
    historyBlock ? `\nRECENT CONVERSATION:\n${historyBlock}` : '',
    '\n<user_message untrusted="true">',
    params.userMessage,
    '</user_message>',
  ].join('\n');

  const validateAndCheck = (rawText: string, finishReason?: string) => {
    if (finishReason === 'SAFETY' || finishReason === 'RECITATION') {
      return { ok: false as const, reason: `Blocked by model finishReason=${finishReason}` };
    }
    try {
      const parsed = JSON.parse(stripFences(rawText));
      const checked = AssistantResponseSchema.safeParse(parsed);
      if (!checked.success) {
        return {
          ok: false as const,
          reason: checked.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        };
      }
      const fig = checkAssistantFigures({
        answer: checked.data.answer,
        allowedContextText: params.contextText,
      });
      if (!fig.ok) {
        return {
          ok: false as const,
          reason: `Ungrounded numeric figures detected (${fig.ungroundedFigures.join(', ')}). Only cite numbers present in <audit_context>.`,
        };
      }
      return { ok: true as const, data: checked.data };
    } catch (e) {
      return { ok: false as const, reason: e instanceof Error ? e.message : 'Invalid JSON' };
    }
  };

  const extraFallbacks = testMockClient ? [] : RESILIENCE_FLASH_MODELS;
  let callsUsed = 1;
  const first = await callWithFallback({
    client,
    primaryModel,
    fallbackModel: env.GEMINI_FALLBACK_MODEL,
    extraFallbacks,
    prompt: basePrompt,
    schema,
    maxOutputTokens: env.ASSISTANT_MAX_OUTPUT_TOKENS,
  });

  let validated = validateAndCheck(first.text, first.finishReason);
  let usedModel = first.usedModel;

  if (!validated.ok) {
    callsUsed += 1;
    const repairPrompt = `${basePrompt}\n\nPREVIOUS OUTPUT FAILED VALIDATION OR FIGURE CHECK:\n${validated.reason}\nFix the issue and return ONLY valid JSON matching the schema without any ungrounded numbers.`;
    const second = await callWithFallback({
      client,
      primaryModel: first.usedModel,
      fallbackModel: env.GEMINI_FALLBACK_MODEL,
      extraFallbacks,
      prompt: repairPrompt,
      schema,
      maxOutputTokens: env.ASSISTANT_MAX_OUTPUT_TOKENS,
    });
    usedModel = second.usedModel;
    validated = validateAndCheck(second.text, second.finishReason);
  }

  if (!validated.ok) {
    throw new AssistantGenerationError(
      `Could not answer reliably from audit data (${validated.reason}).`,
    );
  }

  return {
    usedModel,
    callsUsed,
    payload: postValidateAssistantResponse({
      raw: validated.data,
      validFindingIds: params.validFindingIds,
      validOpportunityIds: params.validOpportunityIds,
      userMessage: params.userMessage,
      recentCtaShownCount: params.recentCtaShownCount,
    }),
  };
}
