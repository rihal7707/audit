import 'server-only';
import { GoogleGenAI } from '@google/genai';
import { selectGeminiModel } from './select-model';
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
  if (/\b503\b|UNAVAILABLE|overloaded|high demand/i.test(msg)) return 503;
  if (/timeout|timed out|abort|ECONNRESET|ETIMEDOUT/i.test(`${name} ${msg}`)) return 503;
  return null;
}

function createRealGeminiClient(apiKey: string): AiModelClient {
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: 26_000,
      retryOptions: { attempts: 1 },
    },
  });
  return {
    async generateText({ model, systemInstruction, prompt, responseJsonSchema, temperature }) {
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
  prompt: string,
  responseJsonSchema: Record<string, unknown>,
): Promise<{ rawText: string; usedModel: string }> {
  try {
    const rawText = await client.generateText({
      model: primaryModel,
      systemInstruction: AUDIT_SYSTEM_INSTRUCTION,
      prompt,
      responseJsonSchema,
      temperature: 0.25,
    });
    return { rawText, usedModel: primaryModel };
  } catch (err) {
    const status = getHttpStatusFromError(err);
    if (status === 429 || status === 503 || status === 404) {
      if (fallbackModel && fallbackModel !== primaryModel) {
        try {
          const rawText = await client.generateText({
            model: fallbackModel,
            systemInstruction: AUDIT_SYSTEM_INSTRUCTION,
            prompt,
            responseJsonSchema,
            temperature: 0.25,
          });
          return { rawText, usedModel: fallbackModel };
        } catch (fallbackErr) {
          const fbStatus = getHttpStatusFromError(fallbackErr);
          if (fbStatus === 429 || fbStatus === 503) {
            throw new GeminiQuotaError('AI capacity temporarily saturated.', fbStatus);
          }
          throw fallbackErr;
        }
      }
      throw new GeminiQuotaError('AI capacity temporarily saturated.', status);
    }
    throw err;
  }
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

  // Call 1: normal generation
  const first = await callModelWithFallback(
    client,
    await selectGeminiModel(),
    env.GEMINI_FALLBACK_MODEL,
    prompt,
    responseJsonSchema,
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
      await selectGeminiModel(),
      env.GEMINI_FALLBACK_MODEL,
      repairPrompt,
      responseJsonSchema,
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

