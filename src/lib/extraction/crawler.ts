import 'server-only';
import crypto from 'node:crypto';
import robotsParser from 'robots-parser';
import * as cheerio from 'cheerio';
import { getEnv } from '@/lib/env';
import { getCrawlerUserAgent, brandConfig } from '@/lib/config/brand';
import { safeFetch, SafeFetchError } from '@/lib/security/safe-fetch';
import {
  getRegistrableDomain,
  normalizeUserWebsiteInput,
  UrlGuardError,
  validateUrlWithDns,
  type UrlGuardOptions,
} from '@/lib/security/url-guard';
import { getCachedCrawl, upsertCachedCrawl } from '@/lib/db/repositories/crawl-cache.repo';
import type { CrawlCoverage } from '@/lib/db/schema';
import { extractPageFromHtml, type ExtractedPageResult } from './extract-page';
import { mergeSignalsAcrossPages, type DetectedSignal } from './signals';

export const MAX_CRAWL_PAGES = 5;
export const TOTAL_CRAWL_BUDGET_MS = 18_000;
export const DEFAULT_POLITE_DELAY_MS = 350;

export type PrecheckUrlStatus =
  | 'URL_INVALID'
  | 'WEBSITE_ACCESSIBLE'
  | 'URL_VALID_BUT_UNREACHABLE';

export interface PrecheckResult {
  reachable: boolean;
  urlStatus: PrecheckUrlStatus;
  normalizedUrl: string;
  finalHost: string;
  finalRegistrableDomain: string;
  redirectedCrossDomain: boolean;
  robotsAllowed: boolean;
  reason?: string;
}

export interface CrawlWebsiteResult {
  normalizedUrl: string;
  finalOrigin: string;
  coverage: CrawlCoverage;
  failureReason: string | null;
  pagesAttempted: number;
  pages: ExtractedPageResult[];
  signals: DetectedSignal[];
  fromCache: boolean;
  possibleInjection: boolean;
  siteLanguage: string | null;
}

export interface CrawlOptions extends UrlGuardOptions {
  allowCrossDomainRedirect?: boolean;
  bypassCache?: boolean;
  politeDelayMs?: number;
  onPageProgress?: (attempted: number, totalPlanned: number) => Promise<void> | void;
}

const SKIP_FILE_EXT_REGEX =
  /\.(?:pdf|jpg|jpeg|png|gif|webp|svg|ico|zip|tar|gz|rar|7z|mp4|mp3|wav|avi|mov|doc|docx|xls|xlsx|ppt|pptx|css|js|json|xml)$/i;

const LOW_OR_SKIP_PATH_REGEX =
  /\/(?:wp-admin|wp-login|admin|login|signin|sign-in|signup|register|account|cart|checkout|basket|wishlist|my-account|feed|tag|author|search)\b/i;

const HIGH_VALUE_KEYWORDS = [
  'service',
  'treatment',
  'solution',
  'product',
  'about',
  'team',
  'doctor',
  'dentist',
  'contact',
  'book',
  'appointment',
  'consult',
  'schedule',
  'pricing',
  'fee',
  'plan',
  'location',
  'clinic',
  'faq',
];

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function originHash(origin: string): string {
  return crypto.createHash('sha256').update(origin.toLowerCase()).digest('hex');
}

function scoreCandidateUrl(urlStr: string, anchorText: string): number {
  try {
    const parsed = new URL(urlStr);
    const pathLower = parsed.pathname.toLowerCase();
    const anchorLower = anchorText.toLowerCase();

    if (pathLower === '/' || pathLower === '') return -1000;
    if (SKIP_FILE_EXT_REGEX.test(pathLower)) return -1000;
    if (LOW_OR_SKIP_PATH_REGEX.test(pathLower)) return -1000;
    if (parsed.search.length > 40 || Array.from(parsed.searchParams.keys()).length > 1) {
      return -1000;
    }

    let score = 0;
    for (const kw of HIGH_VALUE_KEYWORDS) {
      if (pathLower.includes(kw)) score += 15;
      if (anchorLower.includes(kw)) score += 10;
    }

    // Prefer concise top-level pages over deep nested blog archives
    const depth = pathLower.split('/').filter(Boolean).length;
    score -= Math.max(0, depth - 2) * 4;
    if (/\/(blog|news|post|article|category|archive)\//i.test(pathLower)) {
      score -= 12;
    }
    if (/\/(privacy|terms|cookie|legal|disclaimer)/i.test(pathLower)) {
      score -= 20;
    }

    return score > 0 ? score : 1;
  } catch {
    return -1000;
  }
}

export function extractSitemapUrls(xml: string, allowedDomain: string): string[] {
  const $ = cheerio.load(xml, { xmlMode: true });
  const urls: string[] = [];
  $('url > loc').each((_, el) => {
    const raw = $(el).text().trim();
    if (!raw) return;
    try {
      const u = new URL(raw);
      if (
        (u.protocol === 'http:' || u.protocol === 'https:') &&
        getRegistrableDomain(u.hostname) === allowedDomain
      ) {
        u.hash = '';
        urls.push(u.toString());
      }
    } catch {
      // ignore invalid URL
    }
  });
  return urls.slice(0, 60);
}

async function fetchRobots(
  origin: string,
  options: CrawlOptions,
  signal: AbortSignal,
): Promise<{
  isAllowed: (url: string) => boolean;
  sitemaps: string[];
}> {
  const robotsUrl = `${origin}/robots.txt`;
  try {
    const res = await safeFetch(robotsUrl, {
      allowLocalTestFixture: options.allowLocalTestFixture,
      dnsLookup: options.dnsLookup,
      allowCrossDomainRedirect: false,
      allowedContentTypes: ['text/plain', 'text/html', 'application/octet-stream'],
      maxBytes: 256_000,
      requestTimeoutMs: 5000,
      signal,
    });
    if (res.status >= 200 && res.status < 300 && res.body) {
      const parser = robotsParser(robotsUrl, res.body);
      return {
        isAllowed: (url: string) =>
          parser.isAllowed(url, brandConfig.crawlerUserAgentName) !== false &&
          parser.isAllowed(url, '*') !== false,
        sitemaps: parser.getSitemaps(),
      };
    }
  } catch {
    // Missing or unreachable robots.txt defaults to allowed
  }
  return {
    isAllowed: () => true,
    sitemaps: [],
  };
}

const BOT_CHALLENGE_REGEX =
  /opfcaptcha|validateCaptcha|cf-browser-verification|cf-challenge|Checking your browser before accessing|Just a moment\.\.\.|Attention Required!\s*\|\s*Cloudflare|Access Denied|Are you a robot\?/i;

export async function precheckWebsite(
  rawUrl: string,
  options: CrawlOptions = {},
): Promise<PrecheckResult> {
  const withScheme = normalizeUserWebsiteInput(rawUrl);
  let validated;
  try {
    validated = await validateUrlWithDns(withScheme, {
      allowLocalTestFixture: options.allowLocalTestFixture,
      dnsLookup: options.dnsLookup,
    });
  } catch (err) {
    const isDns = err instanceof UrlGuardError && err.code === 'DNS_RESOLUTION_FAILED';
    const message =
      err instanceof UrlGuardError
        ? isDns
          ? 'Your website URL format is valid, but the domain could not be resolved right now. We will still prepare a limited assessment from your business answers.'
          : err.message
        : 'Please enter a valid website address using HTTP or HTTPS.';
    return {
      reachable: false,
      urlStatus: isDns ? 'URL_VALID_BUT_UNREACHABLE' : 'URL_INVALID',
      normalizedUrl: withScheme,
      finalHost: '',
      finalRegistrableDomain: '',
      redirectedCrossDomain: false,
      robotsAllowed: false,
      reason: message,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const robots = await fetchRobots(validated.origin, options, controller.signal);
    const robotsAllowed = robots.isAllowed(validated.normalizedUrl);

    if (!robotsAllowed) {
      return {
        reachable: false,
        urlStatus: 'URL_VALID_BUT_UNREACHABLE',
        normalizedUrl: validated.normalizedUrl,
        finalHost: validated.hostname,
        finalRegistrableDomain: validated.registrableDomain,
        redirectedCrossDomain: false,
        robotsAllowed: false,
        reason:
          'Your website URL is valid, but site robots.txt disallows automated inspection. We will use your business answers to prepare a limited assessment.',
      };
    }

    const res = await safeFetch(validated.normalizedUrl, {
      method: 'GET',
      allowLocalTestFixture: options.allowLocalTestFixture,
      dnsLookup: options.dnsLookup,
      allowCrossDomainRedirect: true,
      requestTimeoutMs: 7000,
      maxBytes: 128_000,
      stopAtMaxBytes: true,
      signal: controller.signal,
    });

    const okStatus = res.status >= 200 && res.status < 400;
    const challengeBlocked = okStatus && BOT_CHALLENGE_REGEX.test(res.body);
    if (!okStatus || challengeBlocked) {
      return {
        reachable: false,
        urlStatus: 'URL_VALID_BUT_UNREACHABLE',
        normalizedUrl: res.finalUrl,
        finalHost: res.finalHost,
        finalRegistrableDomain: res.finalRegistrableDomain,
        redirectedCrossDomain: res.redirectedCrossDomain,
        robotsAllowed: true,
        reason: challengeBlocked
          ? "Your website URL is valid, but automated access was restricted by bot protection. We'll use the business information you provide to prepare a limited assessment."
          : `Your website URL is valid, but automated access was restricted (HTTP ${res.status}). We'll use the business information you provide to prepare a limited assessment.`,
      };
    }

    return {
      reachable: true,
      urlStatus: 'WEBSITE_ACCESSIBLE',
      normalizedUrl: res.finalUrl,
      finalHost: res.finalHost,
      finalRegistrableDomain: res.finalRegistrableDomain,
      redirectedCrossDomain: res.redirectedCrossDomain,
      robotsAllowed: true,
    };
  } catch (err) {
    const message =
      err instanceof SafeFetchError || err instanceof UrlGuardError
        ? `Your website URL is valid, but automated access could not complete (${err.message}). We'll use your business information to prepare a limited assessment.`
        : "Your website URL is valid, but we couldn't check it automatically; we'll still run a limited assessment from your answers.";
    return {
      reachable: false,
      urlStatus: 'URL_VALID_BUT_UNREACHABLE',
      normalizedUrl: validated.normalizedUrl,
      finalHost: validated.hostname,
      finalRegistrableDomain: validated.registrableDomain,
      redirectedCrossDomain: false,
      robotsAllowed: true,
      reason: message,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function crawlWebsite(
  rawUrl: string,
  options: CrawlOptions = {},
): Promise<CrawlWebsiteResult> {
  const withScheme = normalizeUserWebsiteInput(rawUrl);
  const politeDelayMs = options.politeDelayMs ?? DEFAULT_POLITE_DELAY_MS;
  const userAgent = getCrawlerUserAgent();

  const validated = await validateUrlWithDns(withScheme, {
    allowLocalTestFixture: options.allowLocalTestFixture,
    dnsLookup: options.dnsLookup,
  });

  // Check crawl cache (only public website data)
  if (!options.bypassCache) {
    try {
      const cached = await getCachedCrawl(originHash(validated.origin));
      if (cached) {
        const parsed = JSON.parse(cached.payloadJson) as CrawlWebsiteResult;
        return { ...parsed, fromCache: true };
      }
    } catch {
      // Cache read is best-effort
    }
  }

  const budgetController = new AbortController();
  const budgetTimer = setTimeout(() => budgetController.abort(), TOTAL_CRAWL_BUDGET_MS);

  try {
    const robots = await fetchRobots(validated.origin, options, budgetController.signal);
    if (!robots.isAllowed(validated.normalizedUrl)) {
      return {
        normalizedUrl: validated.normalizedUrl,
        finalOrigin: validated.origin,
        coverage: 'NONE',
        failureReason: 'Website robots.txt disallows automated inspection of the homepage.',
        pagesAttempted: 0,
        pages: [],
        signals: [],
        fromCache: false,
        possibleInjection: false,
        siteLanguage: null,
      };
    }

    // Fetch homepage (P1)
    let homeFetch;
    try {
      homeFetch = await safeFetch(validated.normalizedUrl, {
        method: 'GET',
        allowLocalTestFixture: options.allowLocalTestFixture,
        dnsLookup: options.dnsLookup,
        allowCrossDomainRedirect: options.allowCrossDomainRedirect ?? true,
        requestTimeoutMs: 7000,
        signal: budgetController.signal,
        userAgent,
      });
    } catch (err) {
      const reason =
        err instanceof SafeFetchError || err instanceof UrlGuardError
          ? err.message
          : 'Homepage could not be reached.';
      return {
        normalizedUrl: validated.normalizedUrl,
        finalOrigin: validated.origin,
        coverage: 'NONE',
        failureReason: reason,
        pagesAttempted: 1,
        pages: [],
        signals: [],
        fromCache: false,
        possibleInjection: false,
        siteLanguage: null,
      };
    }

    if (homeFetch.status >= 400) {
      return {
        normalizedUrl: homeFetch.finalUrl,
        finalOrigin: new URL(homeFetch.finalUrl).origin,
        coverage: 'LIMITED',
        failureReason: `Homepage returned HTTP ${homeFetch.status}.`,
        pagesAttempted: 1,
        pages: [],
        signals: [],
        fromCache: false,
        possibleInjection: false,
        siteLanguage: null,
      };
    }

    const homePage = extractPageFromHtml(homeFetch.body, homeFetch.finalUrl, homeFetch.status, 'P1');
    const finalOrigin = new URL(homeFetch.finalUrl).origin;
    const finalDomain = homeFetch.finalRegistrableDomain;

    if (options.onPageProgress) {
      await options.onPageProgress(1, MAX_CRAWL_PAGES);
    }

    // If JS shell, mark LIMITED and return homepage metadata without fabricating more
    if (homePage.extractionStatus === 'JS_SHELL') {
      const result: CrawlWebsiteResult = {
        normalizedUrl: homeFetch.finalUrl,
        finalOrigin,
        coverage: 'LIMITED',
        failureReason:
          'This website appears to rely on client-side JavaScript rendering with very little static HTML text.',
        pagesAttempted: 1,
        pages: [homePage],
        signals: homePage.metadata.signals,
        fromCache: false,
        possibleInjection: homePage.metadata.possibleInjection.flagged,
        siteLanguage: homePage.metadata.lang || null,
      };
      await cacheCrawlResult(validated.origin, result);
      return result;
    }

    // Discover additional candidate URLs from homepage links & sitemap.xml
    const candidateScores = new Map<string, number>();
    const addCandidate = (urlStr: string, anchorText: string) => {
      try {
        const u = new URL(urlStr);
        if (getRegistrableDomain(u.hostname) !== finalDomain) return;
        u.hash = '';
        const clean = u.toString();
        if (clean === homeFetch.finalUrl || clean === `${finalOrigin}/`) return;
        if (!robots.isAllowed(clean)) return;
        const score = scoreCandidateUrl(clean, anchorText);
        if (score <= 0) return;
        const prev = candidateScores.get(clean) ?? -1;
        if (score > prev) candidateScores.set(clean, score);
      } catch {
        // ignore invalid candidate
      }
    };

    for (const link of homePage.metadata.navLinks) {
      addCandidate(link.url, link.text);
    }
    for (const link of homePage.metadata.internalLinks) {
      addCandidate(link.url, link.text);
    }

    // Fetch sitemap.xml if not aborted
    if (!budgetController.signal.aborted) {
      const sitemapUrl = robots.sitemaps[0] || `${finalOrigin}/sitemap.xml`;
      try {
        await sleep(politeDelayMs);
        const smRes = await safeFetch(sitemapUrl, {
          allowLocalTestFixture: options.allowLocalTestFixture,
          dnsLookup: options.dnsLookup,
          allowCrossDomainRedirect: false,
          allowedContentTypes: ['application/xml', 'text/xml', 'text/plain'],
          maxBytes: 1_000_000,
          requestTimeoutMs: 6000,
          signal: budgetController.signal,
          userAgent,
        });
        if (smRes.status >= 200 && smRes.status < 300 && smRes.body) {
          for (const smUrl of extractSitemapUrls(smRes.body, finalDomain)) {
            addCandidate(smUrl, '');
          }
        }
      } catch {
        // Missing sitemap is normal
      }
    }

    const sortedCandidates = Array.from(candidateScores.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([url]) => url)
      .slice(0, MAX_CRAWL_PAGES - 1);

    const pages: ExtractedPageResult[] = [homePage];
    const seenCanonical = new Set<string>(
      [homePage.url, homePage.metadata.canonicalUrl].filter((v): v is string => Boolean(v)),
    );
    let pagesAttempted = 1;

    for (const candidateUrl of sortedCandidates) {
      if (budgetController.signal.aborted || pages.length >= MAX_CRAWL_PAGES) break;
      await sleep(politeDelayMs);
      pagesAttempted += 1;

      const label = `P${pages.length + 1}`;
      try {
        const pageRes = await safeFetch(candidateUrl, {
          allowLocalTestFixture: options.allowLocalTestFixture,
          dnsLookup: options.dnsLookup,
          allowCrossDomainRedirect: false,
          requestTimeoutMs: 5500,
          signal: budgetController.signal,
          userAgent,
        });

        if (pageRes.status >= 200 && pageRes.status < 400) {
          const extracted = extractPageFromHtml(pageRes.body, pageRes.finalUrl, pageRes.status, label);
          const canonical = extracted.metadata.canonicalUrl;
          if (canonical && seenCanonical.has(canonical)) {
            continue;
          }
          seenCanonical.add(extracted.url);
          if (canonical) seenCanonical.add(canonical);
          pages.push(extracted);
        }
      } catch {
        // Individual secondary page failure does not abort entire crawl
      }

      if (options.onPageProgress) {
        await options.onPageProgress(pagesAttempted, 1 + sortedCandidates.length);
      }
    }

    const okPagesCount = pages.filter((p) => p.extractionStatus === 'OK').length;
    const coverage: CrawlCoverage =
      okPagesCount >= 3 ? 'COMPLETE' : okPagesCount >= 1 ? 'PARTIAL' : 'LIMITED';

    const mergedSignals = mergeSignalsAcrossPages(pages.map((p) => p.metadata.signals));
    const possibleInjection = pages.some((p) => p.metadata.possibleInjection.flagged);
    const siteLanguage = homePage.metadata.lang || null;

    const result: CrawlWebsiteResult = {
      normalizedUrl: homeFetch.finalUrl,
      finalOrigin,
      coverage,
      failureReason: null,
      pagesAttempted,
      pages,
      signals: mergedSignals,
      fromCache: false,
      possibleInjection,
      siteLanguage,
    };

    await cacheCrawlResult(validated.origin, result);
    return result;
  } finally {
    clearTimeout(budgetTimer);
  }
}

async function cacheCrawlResult(origin: string, result: CrawlWebsiteResult): Promise<void> {
  try {
    const env = getEnv();
    const now = new Date();
    const expires = new Date(now.getTime() + env.CRAWL_CACHE_TTL_HOURS * 3600 * 1000);
    await upsertCachedCrawl(
      originHash(origin),
      JSON.stringify({ ...result, fromCache: false }),
      now.toISOString(),
      expires.toISOString(),
    );
  } catch {
    // Cache persistence is best-effort
  }
}

