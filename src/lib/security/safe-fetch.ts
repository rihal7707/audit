import 'server-only';
import { Agent, buildConnector, request as undiciRequest } from 'undici';
import type { LookupAddress } from 'node:dns';
import { getCrawlerUserAgent } from '@/lib/config/brand';
import {
  isPrivateOrReservedIp,
  UrlGuardError,
  validateUrlStatic,
  validateUrlWithDns,
  type UrlGuardOptions,
  type ValidatedUrlResult,
} from './url-guard';

export const DEFAULT_CONNECT_TIMEOUT_MS = 5000;
export const DEFAULT_REQUEST_TIMEOUT_MS = 10000;
export const DEFAULT_MAX_BYTES = 1_500_000; // 1.5 MB after decompression
export const DEFAULT_MAX_REDIRECTS = 3;

export interface SafeFetchOptions extends UrlGuardOptions {
  method?: 'GET' | 'HEAD';
  maxRedirects?: number;
  maxBytes?: number;
  stopAtMaxBytes?: boolean;
  connectTimeoutMs?: number;
  requestTimeoutMs?: number;
  allowedContentTypes?: string[];
  allowCrossDomainRedirect?: boolean;
  signal?: AbortSignal;
  userAgent?: string;
}

export interface SafeFetchResult {
  requestedUrl: string;
  finalUrl: string;
  finalHost: string;
  finalRegistrableDomain: string;
  redirectedCrossDomain: boolean;
  status: number;
  contentType: string;
  body: string;
  byteLength: number;
  truncatedByLimit: boolean;
}

export class SafeFetchError extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'SafeFetchError';
    this.code = code;
  }
}

function createPinnedDispatcher(
  validated: ValidatedUrlResult,
  connectTimeoutMs: number,
  allowLocalTestFixture?: boolean,
): Agent {
  const escapeActive = process.env.NODE_ENV === 'test' && allowLocalTestFixture === true;

  const customLookup = (
    hostname: string,
    opts: { all?: boolean },
    cb: (
      err: NodeJS.ErrnoException | null,
      address: string | LookupAddress[],
      family?: number,
    ) => void,
  ) => {
    const cleanTarget = hostname.toLowerCase().replace(/\.+$/, '');
    if (cleanTarget !== validated.hostname) {
      cb(new UrlGuardError('HOSTNAME_MISMATCH', 'Connection hostname mismatch.') as NodeJS.ErrnoException, '');
      return;
    }
    if (!escapeActive && isPrivateOrReservedIp(validated.pinnedIp)) {
      cb(
        new UrlGuardError(
          'REBINDING_BLOCKED',
          'Pinned IP address failed re-validation at connect time.',
        ) as NodeJS.ErrnoException,
        '',
      );
      return;
    }

    if (opts && opts.all) {
      cb(null, [{ address: validated.pinnedIp, family: validated.pinnedFamily }]);
      return;
    }
    cb(null, validated.pinnedIp, validated.pinnedFamily);
  };

  const connector = buildConnector({
    timeout: connectTimeoutMs,
    lookup: customLookup as never,
    autoSelectFamily: false,
  });

  return new Agent({
    connect: connector,
    autoSelectFamily: false,
    allowH2: false,
    connections: 2,
    pipelining: 1,
  });
}

function matchesAllowedContentType(contentTypeHeader: string, allowed: string[]): boolean {
  if (allowed.length === 0) return true;
  const mime = (contentTypeHeader.split(';')[0] ?? '').trim().toLowerCase();
  if (!mime) return false;
  return allowed.some((a) => mime === a.toLowerCase());
}

export async function safeFetch(
  initialUrl: string,
  options: SafeFetchOptions = {},
): Promise<SafeFetchResult> {
  const method = options.method ?? 'GET';
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const connectTimeoutMs = options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;
  const requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const allowedContentTypes = options.allowedContentTypes ?? [
    'text/html',
    'application/xhtml+xml',
  ];
  const userAgent = options.userAgent ?? getCrawlerUserAgent();

  let currentUrl = initialUrl;
  let initialRegistrableDomain = '';
  let redirectedCrossDomain = false;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const staticCheck = validateUrlStatic(currentUrl, {
      allowLocalTestFixture: options.allowLocalTestFixture,
    });
    if (hop === 0) {
      initialRegistrableDomain = staticCheck.registrableDomain;
    } else if (staticCheck.registrableDomain !== initialRegistrableDomain) {
      redirectedCrossDomain = true;
      if (!options.allowCrossDomainRedirect) {
        throw new SafeFetchError(
          'CROSS_DOMAIN_REDIRECT',
          `Redirected to a different domain (${staticCheck.hostname}).`,
        );
      }
    }

    const validated = await validateUrlWithDns(currentUrl, {
      allowLocalTestFixture: options.allowLocalTestFixture,
      dnsLookup: options.dnsLookup,
    });

    const dispatcher = createPinnedDispatcher(
      validated,
      connectTimeoutMs,
      options.allowLocalTestFixture,
    );

    const requestController = new AbortController();
    const timeoutId = setTimeout(() => requestController.abort(new Error('Request timeout')), requestTimeoutMs);

    const onExternalAbort = () => requestController.abort(options.signal?.reason);
    if (options.signal) {
      if (options.signal.aborted) {
        clearTimeout(timeoutId);
        await dispatcher.close();
        throw new SafeFetchError('ABORTED', 'Crawl budget exceeded or aborted.');
      }
      options.signal.addEventListener('abort', onExternalAbort, { once: true });
    }

    try {
      const response = await undiciRequest(validated.normalizedUrl, {
        method,
        dispatcher,
        headers: {
          'user-agent': userAgent,
          accept:
            allowedContentTypes.includes('text/html')
              ? 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1'
              : 'application/xml,text/xml,text/plain;q=0.9,*/*;q=0.1',
          'accept-language': 'en-US,en;q=0.9',
        },
        signal: requestController.signal,
      });

      const status = response.statusCode;

      if (status >= 300 && status < 400) {
        // Drain redirect body safely
        await response.body.dump().catch(() => {});
        const location = response.headers.location;
        const locationStr = Array.isArray(location) ? location[0] : location;
        if (!locationStr) {
          throw new SafeFetchError('INVALID_REDIRECT', 'Redirect response missing Location header.');
        }
        if (hop === maxRedirects) {
          throw new SafeFetchError('TOO_MANY_REDIRECTS', 'Exceeded maximum redirect limit.');
        }
        currentUrl = new URL(locationStr, validated.normalizedUrl).toString();
        continue;
      }

      const contentTypeHeader = String(response.headers['content-type'] ?? '');
      if (method !== 'HEAD' && status < 400 && !matchesAllowedContentType(contentTypeHeader, allowedContentTypes)) {
        await response.body.dump().catch(() => {});
        throw new SafeFetchError(
          'UNSUPPORTED_CONTENT_TYPE',
          `Unsupported content type: ${contentTypeHeader || 'unknown'}`,
        );
      }

      if (method === 'HEAD') {
        await response.body.dump().catch(() => {});
        return {
          requestedUrl: initialUrl,
          finalUrl: validated.normalizedUrl,
          finalHost: validated.hostname,
          finalRegistrableDomain: validated.registrableDomain,
          redirectedCrossDomain,
          status,
          contentType: contentTypeHeader,
          body: '',
          byteLength: 0,
          truncatedByLimit: false,
        };
      }

      // Stream response body and abort on overflow after decompression
      const chunks: Buffer[] = [];
      let totalBytes = 0;
      let truncatedByLimit = false;

      for await (const chunk of response.body) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        if (totalBytes + buf.length > maxBytes) {
          truncatedByLimit = true;
          if (options.stopAtMaxBytes) {
            const remaining = Math.max(0, maxBytes - totalBytes);
            if (remaining > 0) {
              chunks.push(buf.subarray(0, remaining));
              totalBytes += remaining;
            }
            requestController.abort(new Error('Reached maxBytes cap'));
            break;
          }
          requestController.abort(new Error('Response body size cap exceeded'));
          throw new SafeFetchError(
            'RESPONSE_TOO_LARGE',
            `Page exceeded maximum allowed size (${maxBytes} bytes).`,
          );
        }
        totalBytes += buf.length;
        chunks.push(buf);
      }

      const body = Buffer.concat(chunks).toString('utf8');
      return {
        requestedUrl: initialUrl,
        finalUrl: validated.normalizedUrl,
        finalHost: validated.hostname,
        finalRegistrableDomain: validated.registrableDomain,
        redirectedCrossDomain,
        status,
        contentType: contentTypeHeader,
        body,
        byteLength: totalBytes,
        truncatedByLimit,
      };
    } catch (err) {
      if (err instanceof UrlGuardError || err instanceof SafeFetchError) {
        throw err;
      }
      const message = err instanceof Error ? err.message : 'Network error';
      if (message.toLowerCase().includes('timeout') || message.toLowerCase().includes('abort')) {
        throw new SafeFetchError('TIMEOUT', 'Website took too long to respond.');
      }
      throw new SafeFetchError('FETCH_FAILED', 'Could not reach the website.');
    } finally {
      clearTimeout(timeoutId);
      if (options.signal) {
        options.signal.removeEventListener('abort', onExternalAbort);
      }
      await dispatcher.close().catch(() => {});
    }
  }

  throw new SafeFetchError('TOO_MANY_REDIRECTS', 'Exceeded maximum redirect limit.');
}
