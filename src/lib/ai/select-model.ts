import { GoogleGenAI } from '@google/genai';
import { getEnv } from '@/lib/env';

let cachedModel: { value: string; fingerprint: string; expiresAt: number } | null = null;

function normalizeModelName(name: string): string {
  return name.startsWith('models/') ? name.slice('models/'.length) : name;
}

/**
 * Selects a Gemini model supporting content generation without adding an uncached
 * `models.list()` round-trip on every invocation.
 */
export async function selectGeminiModel(): Promise<string> {
  const env = getEnv();
  const primary = env.GEMINI_MODEL?.trim();
  const fallback = env.GEMINI_FALLBACK_MODEL?.trim();
  const defaultModel = primary || fallback || 'gemini-2.5-flash';

  if (process.env.NODE_ENV === 'test' || !env.GEMINI_API_KEY?.trim()) {
    return defaultModel;
  }

  const fingerprint = `${primary ?? ''}|${fallback ?? ''}`;
  const now = Date.now();
  if (cachedModel && cachedModel.fingerprint === fingerprint && cachedModel.expiresAt > now) {
    return cachedModel.value;
  }

  // If primary is explicitly configured, return immediately rather than blocking on models.list();
  // runtime fallback handling covers 429/503/404 against GEMINI_FALLBACK_MODEL.
  if (primary) {
    cachedModel = { value: normalizeModelName(primary), fingerprint, expiresAt: now + 10 * 60_000 };
    return cachedModel.value;
  }

  try {
    const client = new GoogleGenAI({
      apiKey: env.GEMINI_API_KEY,
      httpOptions: { timeout: 6000, retryOptions: { attempts: 1 } },
    });
    const modelsPager = await client.models.list();
    for await (const m of modelsPager as AsyncIterable<unknown>) {
      const model = m as { name?: string; supportedActions?: string[] };
      const rawName = typeof model?.name === 'string' ? normalizeModelName(model.name) : '';
      const actions = Array.isArray(model?.supportedActions) ? model.supportedActions : [];
      if (rawName && actions.includes('generateContent') && rawName.includes('gemini')) {
        cachedModel = { value: rawName, fingerprint, expiresAt: now + 10 * 60_000 };
        return rawName;
      }
    }
  } catch {
    // Non-fatal: use configured/default model name
  }

  cachedModel = { value: normalizeModelName(defaultModel), fingerprint, expiresAt: now + 60_000 };
  return cachedModel.value;
}
