import 'server-only';
import { getEnv, isTurnstileConfigured } from '@/lib/env';

export async function verifyTurnstileToken(
  token: string | undefined,
  remoteIp?: string,
): Promise<{ success: boolean; error?: string }> {
  if (!isTurnstileConfigured()) {
    return { success: true };
  }

  if (!token || token.trim().length === 0) {
    return { success: false, error: 'Please complete the human verification challenge.' };
  }

  const env = getEnv();
  const body = new URLSearchParams();
  body.set('secret', env.TURNSTILE_SECRET_KEY!);
  body.set('response', token.trim());
  if (remoteIp && remoteIp !== 'untrusted-client') {
    body.set('remoteip', remoteIp);
  }

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return { success: false, error: 'Verification service temporarily unavailable.' };
    }
    const data = (await res.json()) as { success?: boolean };
    if (!data.success) {
      return { success: false, error: 'Verification check failed. Please try again.' };
    }
    return { success: true };
  } catch {
    return { success: false, error: 'Verification check timed out. Please try again.' };
  }
}

