import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { precheckWebsite } from '@/lib/extraction/crawler';
import { getClientIpHash } from '@/lib/security/tokens';
import { enforcePrecheckRateLimit } from '@/lib/security/rate-limit';
import { apiError, apiSuccess, createRequestId } from '@/lib/http/api-helpers';

const PrecheckSchema = z.object({
  url: z.string().trim().min(3).max(300),
});

export async function POST(request: NextRequest) {
  const requestId = createRequestId();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('Invalid JSON request body.', 400, requestId);
  }

  const parsed = PrecheckSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('Please provide a valid website URL.', 400, requestId);
  }

  const ipHash = getClientIpHash(request);
  const rl = await enforcePrecheckRateLimit(ipHash);
  if (!rl.allowed) {
    return apiError('Too many website checks this hour. Please wait a moment.', 429, requestId);
  }

  const result = await precheckWebsite(parsed.data.url);
  return apiSuccess(
    {
      reachable: result.reachable,
      normalizedUrl: result.normalizedUrl,
      finalHost: result.finalHost,
      finalRegistrableDomain: result.finalRegistrableDomain,
      redirectedCrossDomain: result.redirectedCrossDomain,
      robotsAllowed: result.robotsAllowed,
      reason: result.reason,
    },
    200,
    requestId,
  );
}

