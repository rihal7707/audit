/* eslint-disable @typescript-eslint/no-explicit-any */
import { GoogleGenAI } from '@google/genai';
import { getEnv } from '@/lib/env';

/**
 * Utility to auto‑select a Gemini model that supports JSON output.
 * It prefers the model specified in GEMINI_MODEL, falling back to GEMINI_FALLBACK_MODEL
 * or the first model that advertises `application/json` response MIME type.
 */
export async function selectGeminiModel(): Promise<string> {
  const env = getEnv();
  const primary = env.GEMINI_MODEL?.trim();
  const fallback = env.GEMINI_FALLBACK_MODEL?.trim();

  const client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY ?? '' });
  // In test environment or without a real API key, skip real model listing
  if (process.env.NODE_ENV === 'test' || !env.GEMINI_API_KEY?.trim()) {
    return primary || fallback || 'gemini-1.5-flash';
  }
  // Retrieve models without using any
  interface ModelInfo { name: string; metadata?: { responseMimeTypes?: string[] } }
  const modelsPager = await client.models.list();
  const models: ModelInfo[] = [];
  for await (const m of modelsPager as AsyncIterable<unknown>) {
    const model = m as Record<string, unknown>;
    const name = typeof model['name'] === 'string' ? model['name'] : '';
    const metadata = typeof model['metadata'] === 'object' && model['metadata'] !== null ? model['metadata'] as { responseMimeTypes?: string[] } : undefined;
    models.push({ name, metadata });
  }

  // Helper to check if a model supports JSON responses
  const supportsJson = (model: any) => {
    const mime = model?.metadata?.responseMimeTypes?.includes('application/json');
    return !!mime;
  };

  // Try primary
  if (primary) {
    const found = models.find((m) => m.name === primary);
    if (found && supportsJson(found)) return primary;
  }

  // Try fallback
  if (fallback) {
    const found = models.find((m) => m.name === fallback);
    if (found && supportsJson(found)) return fallback;
  }

  // Otherwise pick first that supports JSON
  const jsonModel = models.find(supportsJson);
  if (jsonModel) return jsonModel.name;

  // As a last resort return the primary even if it may not support JSON
  return primary || 'gemini-1.5-flash';
}
