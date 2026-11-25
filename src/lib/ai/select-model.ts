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
  const modelsPager = await client.models.list();
  const models = Array.from(modelsPager as any) as any[]; // Convert Pager to array

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
