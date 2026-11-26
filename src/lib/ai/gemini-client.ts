import 'server-only';
import { GoogleGenAI } from '@google/genai';
import {
  buildModelCandidateList,
  markModelTransientlyUnhealthy,
  prioritizeHealthyModels,
  RESILIENCE_FLASH_MODELS,
  selectGeminiModel,
} from './select-model';
import { getEnv } from '@/lib/env';


import { AUDIT_SYSTEM_INSTRUCTION, PROMPT_VERSION, REPORT_VERSION } from './audit-system-prompt';
import {
  AuditReportSchema,
  getGeminiResponseJsonSchema,
  type AuditReport,
} from './report-schema';
import {
  buildAiSafeAuditInput,
  serializeAiPromptPayload,
  type RawAuditForAi,
} from './input-builder';
import { applyDeterministicGrounding, type GroundingResult } from './grounding';

export class GeminiQuotaError extends Error {
  public readonly statusCode: number;
  constructor(message: string, statusCode = 429) {
    super(message);
    this.name = 'GeminiQuotaError';
    this.statusCode = statusCode;
  }
}

export class GeminiGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiGenerationError';
  }
}

export interface AiModelClient {
  generateText(params: {
    model: string;
    systemInstruction: string;
    prompt: string;
    responseJsonSchema: Record<string, unknown>;
    temperature: number;
    timeoutMs?: number;
  }): Promise<string>;
}

let testMockAdapter: AiModelClient | null = null;

/**
 * Registers a mock model adapter for automated tests ONLY.
 * Strictly refuses to execute in production.
 */
export function setMockAiAdapterForTesting(adapter: AiModelClient | null): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Mock AI adapter is forbidden when NODE_ENV === "production".');
  }
  testMockAdapter = adapter;
}

function getHttpStatusFromError(err: unknown): number | null {
  if (!err || typeof err !== 'object') return null;
  const anyErr = err as Record<string, unknown>;
  if (typeof anyErr.status === 'number') return anyErr.status;
  if (typeof anyErr.statusCode === 'number') return anyErr.statusCode;
  if (typeof anyErr.code === 'number') return anyErr.code;
  const name = String(anyErr.name || '');
  const msg = String(anyErr.message || '');
  if (/\b429\b|RESOURCE_EXHAUSTED|quota/i.test(msg)) return 429;
  if (/\b503\b|\b504\b|\b502\b|UNAVAILABLE|DEADLINE_EXCEEDED|overloaded|high demand/i.test(msg)) return 503;
  if (/timeout|timed out|abort|ECONNRESET|ETIMEDOUT/i.test(`${name} ${msg}`)) return 503;
  return null;
}

function isTransientAiError(status: number | null): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function createRealGeminiClient(apiKey: string): AiModelClient {
  return {
    async generateText({ model, systemInstruction, prompt, responseJsonSchema, temperature, timeoutMs }) {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          timeout: timeoutMs ?? 20_000,
          retryOptions: { attempts: 1 },
        },
      });
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction,
          temperature,
          responseMimeType: 'application/json',
          responseJsonSchema,
        },
      });
      const text = response.text;
      if (!text || text.trim().length === 0) {
        throw new GeminiGenerationError('Gemini returned an empty response.');
      }
      return text;
    },
  };
}

function stripMarkdownFences(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('```')) {
    return trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }
  return trimmed;
}

async function callModelWithFallback(
  client: AiModelClient,
  primaryModel: string,
  fallbackModel: string | undefined,
  extraFallbacks: string[],
  prompt: string,
  responseJsonSchema: Record<string, unknown>,
  deadlineMs = Date.now() + 48_000,
): Promise<{ rawText: string; usedModel: string }> {
  const useHealthOrder = extraFallbacks.length > 0;
  const baseCandidates = buildModelCandidateList(primaryModel, fallbackModel, extraFallbacks);
  const candidates = useHealthOrder ? prioritizeHealthyModels(baseCandidates) : baseCandidates;
  let lastErr: unknown = new GeminiGenerationError('No AI model candidates available.');
  let lastTransientStatus = 503;
  let sawTransient = false;
  const attemptsLog: string[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const remainingMs = deadlineMs - Date.now();
    if (i > 0 && remainingMs < 5_000) {
      throw new GeminiQuotaError(`AI capacity temporarily saturated (${attemptsLog.join(', ')}).`, lastTransientStatus);
    }
    const model = candidates[i]!;
    const attemptTimeoutMs =
      i < candidates.length - 1
        ? Math.min(12_500, Math.max(6_000, remainingMs))
        : Math.min(24_000, Math.max(8_000, remainingMs));
    try {
      const rawText = await client.generateText({
        model,
        systemInstruction: AUDIT_SYSTEM_INSTRUCTION,
        prompt,
        responseJsonSchema,
        temperature: 0.25,
        timeoutMs: attemptTimeoutMs,
      });
      return { rawText, usedModel: model };
    } catch (err) {
      lastErr = err;
      const status = getHttpStatusFromError(err);
      attemptsLog.push(`${model}:${status ?? 'err'}`);
      if (isTransientAiError(status)) {
        sawTransient = true;
        lastTransientStatus = status || 503;
        if (useHealthOrder) markModelTransientlyUnhealthy(model);
        continue;
      }
      if (status === 404) {
        if (useHealthOrder) markModelTransientlyUnhealthy(model, 600_000);
        continue;
      }
      throw err;
    }
  }

  if (sawTransient) {
    throw new GeminiQuotaError(`AI capacity temporarily saturated (${attemptsLog.join(', ')}).`, lastTransientStatus);
  }
  throw lastErr;
}

export interface GenerateAuditReportResult extends GroundingResult {
  callsUsed: number;
  usedModel: string;
}

export async function generateGroundedAuditReport(
  rawAudit: RawAuditForAi,
): Promise<GenerateAuditReportResult> {
  const env = getEnv();

  let client: AiModelClient;
  if (testMockAdapter) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Mock AI adapter cannot run in production.');
    }
    client = testMockAdapter;
  } else {
    if (!env.GEMINI_API_KEY) {
      throw new GeminiGenerationError('Gemini API key is not configured.');
    }
    client = createRealGeminiClient(env.GEMINI_API_KEY);
  }

  const safeInput = buildAiSafeAuditInput(rawAudit);
  const prompt = serializeAiPromptPayload(safeInput);
  const responseJsonSchema = getGeminiResponseJsonSchema();

  let callsUsed = 0;

  const parseAndValidate = (rawText: string): { ok: true; data: AuditReport } | { ok: false; reason: string } => {
    try {
      const parsed = JSON.parse(stripMarkdownFences(rawText));
      const checked = AuditReportSchema.safeParse(parsed);
      if (!checked.success) {
        const issues = checked.error.issues
          .slice(0, 8)
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ');
        return { ok: false, reason: issues };
      }
      return { ok: true, data: checked.data };
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : 'Invalid JSON syntax' };
    }
  };

  const extraFallbacks = testMockAdapter ? [] : RESILIENCE_FLASH_MODELS;
  const stageDeadlineMs = Date.now() + 48_000;

  // Call 1: normal generation
  const first = await callModelWithFallback(
    client,
    await selectGeminiModel(),
    env.GEMINI_FALLBACK_MODEL,
    extraFallbacks,
    prompt,
    responseJsonSchema,
    stageDeadlineMs,
  );
  callsUsed += 1;

  let validated = parseAndValidate(first.rawText);
  let finalModel = first.usedModel;

  // Call 2 (at most ONE repair/retry call for the whole audit)
  if (!validated.ok) {
    const repairPrompt = [
      prompt,
      '',
      'PREVIOUS RESPONSE FAILED SCHEMA VALIDATION. FIX ALL ISSUES AND RETURN ONLY VALID JSON:',
      `Validation errors: ${validated.reason}`,
    ].join('\n');

    const second = await callModelWithFallback(
      client,
      first.usedModel,
      env.GEMINI_FALLBACK_MODEL,
      extraFallbacks,
      repairPrompt,
      responseJsonSchema,
      stageDeadlineMs,
    );
    callsUsed += 1;
    finalModel = second.usedModel;
    validated = parseAndValidate(second.rawText);
  }

  if (!validated.ok) {
    throw new GeminiGenerationError(`AI output failed schema validation after retry: ${validated.reason}`);
  }

  const grounded = applyDeterministicGrounding(validated.data, {
    pages: rawAudit.pages,
    signals: rawAudit.signals,
    coverage: rawAudit.crawlCoverage,
    model: finalModel,
    promptVersion: PROMPT_VERSION,
    reportVersion: REPORT_VERSION,
    generatedAt: new Date().toISOString(),
  });

  return {
    ...grounded,
    callsUsed,
    usedModel: finalModel,
  };
}

