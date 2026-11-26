import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';

function loadDotEnvLocal() {
  for (const filename of ['.env.local', '.env']) {
    const filePath = path.resolve(process.cwd(), filename);
    if (!fs.existsSync(filePath)) continue;
    const raw = fs.readFileSync(filePath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

async function tryModel(ai: GoogleGenAI, model: string) {
  console.log(`Verifying minimal Gemini API call using model "${model}"...`);
  const response = await ai.models.generateContent({
    model,
    contents: 'Return JSON: {"status":"ok","service":"amarketing-audit"}',
    config: {
      temperature: 0,
      responseMimeType: 'application/json',
      maxOutputTokens: 64,
    },
  });
  const text = (response.text || '').trim();
  const parsed = JSON.parse(text);
  console.log(`Gemini API verification succeeded on "${model}":`, parsed);
}

async function main() {
  loadDotEnvLocal();

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const model = process.env.GEMINI_MODEL?.trim() || 'gemini-3.8-flash';
  const fallbackModel = process.env.GEMINI_FALLBACK_MODEL?.trim();

  if (!apiKey) {
    console.log('GEMINI_API_KEY is not set. Skipping live Gemini API verification.');
    console.log('Set GEMINI_API_KEY in .env.local and re-run `npm run verify:gemini` to test a live call.');
    return;
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: 60_000,
      retryOptions: { attempts: 3 },
    },
  });

  try {
    await tryModel(ai, model);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown Gemini API error';
    if (fallbackModel && (msg.includes('503') || msg.includes('429'))) {
      console.warn(`Primary model "${model}" returned transient saturation; trying fallback "${fallbackModel}"...`);
      try {
        await tryModel(ai, fallbackModel);
        return;
      } catch (fbErr) {
        const fbMsg = fbErr instanceof Error ? fbErr.message : 'Unknown fallback error';
        console.error('Gemini fallback verification failed:', fbMsg);
        process.exitCode = 1;
        return;
      }
    }
    console.error('Gemini API verification failed:', msg);
    process.exitCode = 1;
  }
}

void main();
