import * as cheerio from 'cheerio';
import crypto from 'node:crypto';
import { detectSignalsOnPage, type DetectedSignal } from './signals';
import { getRegistrableDomain } from '@/lib/security/url-guard';

export const MAX_EXTRACTED_TEXT_CHARS = 6000;

export interface ExtractedLink {
  url: string;
  text: string;
}

export interface ExtractedPageMetadata {
  title: string;
  metaDescription: string;
  canonicalUrl: string | null;
  lang: string;
  h1: string[];
  h2: string[];
  navLinks: ExtractedLink[];
  internalLinks: ExtractedLink[];
  externalLinks: ExtractedLink[];
  ctaButtons: string[];
  visiblePhones: string[];
  visibleEmails: string[];
  visibleAddresses: string[];
  servicesMentioned: string[];
  imageAlts: string[];
  testimonialsSnippet: string[];
  bookingAndEnquiryLinks: ExtractedLink[];
  socialLinks: ExtractedLink[];
  jsonLdTypes: string[];
  openGraph: Record<string, string>;
  signals: DetectedSignal[];
  possibleInjection: {
    flagged: boolean;
    matches: string[];
  };
  isJsShell: boolean;
}

export interface ExtractedPageResult {
  pageLabel: string;
  url: string;
  pageTitle: string;
  httpStatus: number;
  extractedText: string;
  metadata: ExtractedPageMetadata;
  contentHash: string;
  extractionStatus: 'OK' | 'JS_SHELL' | 'FAILED';
}

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions?/i,
  /disregard\s+(?:all\s+)?(?:previous|prior|above)\s+instructions?/i,
  /you\s+are\s+now\s+(?:a|an|in)\s+/i,
  /system\s+prompt\s*:/i,
  /new\s+instructions?\s*:/i,
  /<\/?\s*website_content/i,
  /\boverride\s+(?:system|safety|accuracy)\s+rules?\b/i,
];

function cleanText(raw: string): string {
  return raw
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueStrings(items: string[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const cleaned = cleanText(item);
    if (!cleaned || seen.has(cleaned.toLowerCase())) continue;
    seen.add(cleaned.toLowerCase());
    out.push(cleaned);
    if (out.length >= max) break;
  }
  return out;
}

function detectPromptInjection(rawText: string): { flagged: boolean; matches: string[] } {
  const matches: string[] = [];
  for (const pattern of INJECTION_PATTERNS) {
    const m = rawText.match(pattern);
    if (m?.[0]) {
      matches.push(m[0]);
    }
  }
  return {
    flagged: matches.length > 0,
    matches,
  };
}

function detectJsRenderedShell($: cheerio.CheerioAPI, visibleTextLength: number, rawHtml: string): boolean {
  if (visibleTextLength >= 260) return false;

  const hasMountNode =
    $('#root, #app, #__next, #__nuxt, app-root').length > 0;
  const hasBundlerScript =
    $('script[src]').toArray().some((el) => {
      const src = $(el).attr('src') || '';
      return /\/(assets|static\/js|_next\/static|webpack|bundle|main\.[a-f0-9]+|index-[a-f0-9]+)\b/i.test(src);
    });
  const noscriptText = $('noscript').text().toLowerCase();
  const hasEnableJsNoscript =
    noscriptText.includes('enable javascript') ||
    noscriptText.includes('javascript is required') ||
    noscriptText.includes('requires javascript');

  if (hasEnableJsNoscript) return true;
  if (visibleTextLength < 160 && (hasMountNode || hasBundlerScript)) return true;
  if (visibleTextLength < 80 && rawHtml.length > 400) return true;

  return false;
}

export function extractPageFromHtml(
  html: string,
  pageUrl: string,
  httpStatus: number,
  pageLabel: string,
): ExtractedPageResult {
  const signals = detectSignalsOnPage(html, pageLabel);
  const $ = cheerio.load(html);

  const title = cleanText($('title').first().text());
  const metaDescription = cleanText($('meta[name="description"]').attr('content') || '');
  const canonicalRaw = $('link[rel="canonical"]').attr('href')?.trim() || null;
  let canonicalUrl: string | null = null;
  if (canonicalRaw) {
    try {
      canonicalUrl = new URL(canonicalRaw, pageUrl).toString();
    } catch {
      canonicalUrl = null;
    }
  }
  const lang = cleanText($('html').attr('lang') || '');

  // Open Graph & JSON-LD types
  const openGraph: Record<string, string> = {};
  $('meta[property^="og:"]').each((_, el) => {
    const prop = $(el).attr('property');
    const content = $(el).attr('content');
    if (prop && content) {
      openGraph[prop] = cleanText(content);
    }
  });

  const jsonLdTypes: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).html() || '';
    const matches = raw.match(/"@type"\s*:\s*"([^"]+)"/g) ?? [];
    for (const m of matches) {
      const val = m.split(':')[1]?.replace(/["\s]/g, '');
      if (val && !jsonLdTypes.includes(val)) jsonLdTypes.push(val);
    }
  });

  // Extract nav and links before boilerplate stripping
  const baseDomain = getRegistrableDomain(new URL(pageUrl).hostname);
  const navLinks: ExtractedLink[] = [];
  const internalLinks: ExtractedLink[] = [];
  const externalLinks: ExtractedLink[] = [];
  const bookingAndEnquiryLinks: ExtractedLink[] = [];
  const socialLinks: ExtractedLink[] = [];

  const seenUrls = new Set<string>();
  const socialHosts = ['facebook.com', 'instagram.com', 'linkedin.com', 'youtube.com', 'tiktok.com', 'x.com', 'twitter.com'];

  $('nav a[href], header a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = cleanText($(el).text());
    try {
      const resolved = new URL(href, pageUrl);
      if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return;
      resolved.hash = '';
      if (getRegistrableDomain(resolved.hostname) === baseDomain && navLinks.length < 25) {
        navLinks.push({ url: resolved.toString(), text: text || resolved.pathname });
      }
    } catch {
      // Ignore malformed URLs
    }
  });

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = cleanText($(el).text());
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
    try {
      const resolved = new URL(href, pageUrl);
      if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return;
      resolved.hash = '';
      const resolvedStr = resolved.toString();
      const targetDomain = getRegistrableDomain(resolved.hostname);
      const isInternal = targetDomain === baseDomain;

      if (!seenUrls.has(resolvedStr)) {
        seenUrls.add(resolvedStr);
        if (isInternal && internalLinks.length < 80) {
          internalLinks.push({ url: resolvedStr, text: text || resolved.pathname });
        } else if (!isInternal && externalLinks.length < 40) {
          externalLinks.push({ url: resolvedStr, text: text || resolved.hostname });
        }
      }

      if (
        (/book|appointment|schedule|consult|contact|enquir|inquir|quote/i.test(resolvedStr) ||
          /book|appointment|schedule|consult|contact|enquir|inquir|quote/i.test(text)) &&
        bookingAndEnquiryLinks.length < 15
      ) {
        bookingAndEnquiryLinks.push({ url: resolvedStr, text: text || resolved.pathname });
      }

      if (
        socialHosts.some((s) => resolved.hostname.toLowerCase().includes(s)) &&
        socialLinks.length < 12
      ) {
        socialLinks.push({ url: resolvedStr, text: text || resolved.hostname });
      }
    } catch {
      // Ignore malformed URLs
    }
  });

  // Remove scripts/styles/noscript/svg/hidden/cookie banners for visible text extraction
  $('script, style, noscript, svg, template, iframe, [hidden], [aria-hidden="true"]').remove();
  $(
    '[id*="cookie" i]:not(body):not(html):not(main), [class*="cookie-banner" i], [class*="cookie-consent" i], [id*="onetrust" i]',
  ).remove();

  const h1 = uniqueStrings(
    $('h1').map((_, el) => $(el).text()).get(),
    6,
  );
  const h2 = uniqueStrings(
    $('h2').map((_, el) => $(el).text()).get(),
    15,
  );

  const ctaButtons = uniqueStrings(
    [
      ...$('button').map((_, el) => $(el).text()).get(),
      ...$('a[href]')
        .filter((_, el) => {
          const text = $(el).text().trim();
          const cls = ($(el).attr('class') || '').toLowerCase();
          return (
            cls.includes('btn') ||
            cls.includes('button') ||
            cls.includes('cta') ||
            /book|schedule|get started|request|contact|enquire|call|quote|consult/i.test(text)
          );
        })
        .map((_, el) => $(el).text())
        .get(),
    ],
    20,
  );

  const imageAlts = uniqueStrings(
    $('img[alt]').map((_, el) => $(el).attr('alt') || '').get(),
    20,
  );

  const rawBodyText = cleanText($('body').text());
  const isJsShell = detectJsRenderedShell($, rawBodyText.length, html);

  const visiblePhones = uniqueStrings(
    rawBodyText.match(/(?:\+?\d[\d\s().-]{7,16}\d)/g) ?? [],
    8,
  );
  const visibleEmails = uniqueStrings(
    rawBodyText.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi) ?? [],
    8,
  );
  const visibleAddresses = uniqueStrings(
    [
      ...$('address').map((_, el) => $(el).text()).get(),
      ...(rawBodyText.match(
        /\b\d{1,5}\s+[A-Za-z0-9.\s]{2,35}\s(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Suite|Ste)\b/gi,
      ) ?? []),
    ],
    5,
  );

  const servicesMentioned = uniqueStrings(
    $('section, main')
      .find('h2, h3, li')
      .filter((_, el) => {
        const txt = $(el).text().trim();
        return txt.length >= 4 && txt.length <= 80;
      })
      .map((_, el) => $(el).text())
      .get(),
    25,
  );

  const testimonialsSnippet = uniqueStrings(
    $('blockquote, [class*="testimonial" i], [class*="review" i]')
      .map((_, el) => $(el).text().slice(0, 240))
      .get(),
    5,
  );

  // Strip nav/footer boilerplate after capturing nav links when estimating main content,
  // but fallback to full body if main is thin
  const mainClone = $('main, article, [role="main"]').first().text();
  const preferredText = cleanText(mainClone).length >= 200 ? cleanText(mainClone) : rawBodyText;
  const extractedText = preferredText.slice(0, MAX_EXTRACTED_TEXT_CHARS);

  const possibleInjection = detectPromptInjection(`${rawBodyText}\n${html.slice(0, 8000)}`);
  const contentHash = crypto.createHash('sha256').update(extractedText).digest('hex');

  return {
    pageLabel,
    url: pageUrl,
    pageTitle: title || h1[0] || pageUrl,
    httpStatus,
    extractedText,
    metadata: {
      title,
      metaDescription,
      canonicalUrl,
      lang,
      h1,
      h2,
      navLinks,
      internalLinks,
      externalLinks,
      ctaButtons,
      visiblePhones,
      visibleEmails,
      visibleAddresses,
      servicesMentioned,
      imageAlts,
      testimonialsSnippet,
      bookingAndEnquiryLinks,
      socialLinks,
      jsonLdTypes,
      openGraph,
      signals,
      possibleInjection,
      isJsShell,
    },
    contentHash,
    extractionStatus: isJsShell ? 'JS_SHELL' : 'OK',
  };
}

