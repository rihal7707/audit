import * as cheerio from 'cheerio';

export interface DetectedSignal {
  id: string;
  label: string;
  category: 'contact' | 'booking' | 'chat' | 'crm' | 'analytics' | 'platform' | 'trust';
  found: boolean;
  evidence: string;
  pageId: string;
}

export const NOT_OBSERVED_TEXT = 'Not observed on the pages we inspected';

const BOOKING_PROVIDERS: Array<{ name: string; patterns: RegExp[] }> = [
  { name: 'Calendly', patterns: [/calendly\.com/i] },
  { name: 'Acuity Scheduling', patterns: [/acuityscheduling\.com/i, /squarespacescheduling\.com/i] },
  { name: 'Cal.com', patterns: [/cal\.com/i] },
  { name: 'Square Appointments', patterns: [/squareup\.com\/appointments/i, /square\.site/i] },
  { name: 'SimplyBook.me', patterns: [/simplybook\.me/i] },
  { name: 'Setmore', patterns: [/setmore\.com/i] },
  { name: 'Zocdoc', patterns: [/zocdoc\.com/i] },
  { name: 'NexHealth', patterns: [/nexhealth\.com/i] },
  { name: 'Jane App', patterns: [/janeapp\.com/i] },
  { name: 'HubSpot Meetings', patterns: [/meetings\.hubspot\.com/i] },
  { name: 'Cliniko', patterns: [/cliniko\.com/i] },
  { name: 'Fresha', patterns: [/fresha\.com/i] },
];

const CHAT_WIDGETS: Array<{ name: string; patterns: RegExp[] }> = [
  { name: 'Intercom', patterns: [/widget\.intercom\.io/i, /intercomSettings/i] },
  { name: 'Drift', patterns: [/js\.driftt\.com/i, /drift\.load/i] },
  { name: 'Tidio', patterns: [/code\.tidio\.co/i] },
  { name: 'Crisp', patterns: [/client\.crisp\.chat/i] },
  { name: 'LiveChat', patterns: [/cdn\.livechatinc\.com/i] },
  { name: 'Tawk.to', patterns: [/embed\.tawk\.to/i] },
  { name: 'HubSpot Chat', patterns: [/hs-scripts\.com/i, /HubSpotConversations/i] },
  { name: 'Zendesk Widget', patterns: [/static\.zdassets\.com/i] },
  { name: 'Freshchat', patterns: [/wchat\.freshchat\.com/i] },
  { name: 'WhatsApp Click-to-Chat', patterns: [/wa\.me\//i, /api\.whatsapp\.com\/send/i] },
  { name: 'Facebook Messenger', patterns: [/m\.me\//i, /connect\.facebook\.net.*customerchat/i] },
];

const CRM_FORM_EMBEDS: Array<{ name: string; patterns: RegExp[] }> = [
  { name: 'HubSpot Forms', patterns: [/js\.hsforms\.net/i, /hbspt\.forms\.create/i, /share\.hsforms\.com/i] },
  { name: 'Mailchimp', patterns: [/list-manage\.com\/subscribe/i, /chimpstatic\.com/i] },
  { name: 'Zoho CRM / Forms', patterns: [/forms\.zohopublic\.com/i, /crm\.zoho\.com/i] },
  { name: 'Salesforce Web-to-Lead', patterns: [/webto\.salesforce\.com/i] },
  { name: 'ActiveCampaign', patterns: [/activehosted\.com\/f\//i] },
  { name: 'GoHighLevel / LeadConnector', patterns: [/leadconnectorhq\.com/i, /msgsndr\.com/i] },
];

function truncateEvidence(value: string, max = 160): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

export function detectSignalsOnPage(
  html: string,
  pageId: string,
): DetectedSignal[] {
  const $ = cheerio.load(html);
  const rawHtmlLower = html.toLowerCase();
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const headerText = $('header, nav').first().text().replace(/\s+/g, ' ').trim();

  const scriptAndLinkUrls = [
    ...$('script[src]').map((_, el) => $(el).attr('src') || '').get(),
    ...$('iframe[src]').map((_, el) => $(el).attr('src') || '').get(),
    ...$('a[href]').map((_, el) => $(el).attr('href') || '').get(),
    ...$('form[action]').map((_, el) => $(el).attr('action') || '').get(),
  ].join('\n');

  const inlineScripts = $('script:not([src])')
    .map((_, el) => $(el).html() || '')
    .get()
    .join('\n');

  const combinedTechnicalText = `${scriptAndLinkUrls}\n${inlineScripts}`;

  const signals: DetectedSignal[] = [];

  // 1. tel: links
  const telLinks = $('a[href^="tel:"]')
    .map((_, el) => $(el).attr('href') || '')
    .get()
    .filter(Boolean);
  signals.push({
    id: 'contact_tel_link',
    label: 'Clickable phone (tel:) link',
    category: 'contact',
    found: telLinks.length > 0,
    evidence: telLinks.length > 0 ? truncateEvidence(telLinks[0]!) : NOT_OBSERVED_TEXT,
    pageId,
  });

  // 2. mailto: links
  const mailtoLinks = $('a[href^="mailto:"]')
    .map((_, el) => $(el).attr('href') || '')
    .get()
    .filter(Boolean);
  signals.push({
    id: 'contact_mailto_link',
    label: 'Email (mailto:) link',
    category: 'contact',
    found: mailtoLinks.length > 0,
    evidence: mailtoLinks.length > 0 ? truncateEvidence(mailtoLinks[0]!) : NOT_OBSERVED_TEXT,
    pageId,
  });

  // 3. Contact / enquiry form present
  let contactFormEvidence = '';
  $('form').each((_, formEl) => {
    if (contactFormEvidence) return;
    const form = $(formEl);
    const hasEmailOrPhoneOrMsg =
      form.find(
        'input[type="email"], input[type="tel"], textarea, input[name*="email" i], input[name*="phone" i], input[name*="message" i], input[name*="name" i]',
      ).length > 0;
    const isPureSearch =
      form.attr('role') === 'search' ||
      (form.find('input[type="search"], input[name="s"], input[name="q"]').length > 0 &&
        form.find('textarea, input[type="email"], input[type="tel"]').length === 0);
    if (hasEmailOrPhoneOrMsg && !isPureSearch) {
      const submitText =
        form.find('button[type="submit"], input[type="submit"], button').first().text().trim() ||
        form.find('input[type="submit"]').attr('value') ||
        'Enquiry form';
      contactFormEvidence = `Form detected (action/CTA: ${submitText})`;
    }
  });
  signals.push({
    id: 'contact_form_present',
    label: 'Website enquiry or contact form',
    category: 'contact',
    found: Boolean(contactFormEvidence),
    evidence: contactFormEvidence ? truncateEvidence(contactFormEvidence) : NOT_OBSERVED_TEXT,
    pageId,
  });

  // 4. Visible phone in header
  const headerPhoneMatch = headerText.match(/(?:\+?\d[\d\s().-]{7,16}\d)/);
  signals.push({
    id: 'contact_header_phone',
    label: 'Visible phone number in header',
    category: 'contact',
    found: Boolean(headerPhoneMatch),
    evidence: headerPhoneMatch ? truncateEvidence(headerPhoneMatch[0]) : NOT_OBSERVED_TEXT,
    pageId,
  });

  // 5. Opening hours
  const hoursMatch = bodyText.match(
    /(?:opening hours|business hours|office hours|hours of operation|mon(?:day)?\s*[-–to]+\s*(?:fri|sat|sun)(?:day)?[^.]{0,60}(?:am|pm|\d{1,2}:\d{2}))/i,
  );
  signals.push({
    id: 'contact_opening_hours',
    label: 'Visible opening hours',
    category: 'contact',
    found: Boolean(hoursMatch),
    evidence: hoursMatch ? truncateEvidence(hoursMatch[0]) : NOT_OBSERVED_TEXT,
    pageId,
  });

  // 6. Address
  const addressTag = $('address').first().text().trim();
  const hasSchemaAddress = /"PostalAddress"/i.test(inlineScripts);
  const addressRegexMatch = bodyText.match(
    /\b\d{1,5}\s+[A-Za-z0-9.\s]{2,35}\s(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Suite|Ste)\b/i,
  );
  const addressEvidence = addressTag || (hasSchemaAddress ? 'Structured PostalAddress schema detected' : addressRegexMatch?.[0] || '');
  signals.push({
    id: 'contact_address_present',
    label: 'Visible business address',
    category: 'contact',
    found: Boolean(addressEvidence),
    evidence: addressEvidence ? truncateEvidence(addressEvidence) : NOT_OBSERVED_TEXT,
    pageId,
  });

  // 7. Booking platform or online booking link
  const matchedBookingProviders: string[] = [];
  for (const bp of BOOKING_PROVIDERS) {
    if (bp.patterns.some((p) => p.test(combinedTechnicalText))) {
      matchedBookingProviders.push(bp.name);
    }
  }
  const bookingLinkEls = $('a[href]').filter((_, el) => {
    const href = ($(el).attr('href') || '').toLowerCase();
    const text = $(el).text().toLowerCase();
    return (
      /book|appointment|schedule|consultation|reserve/i.test(href) ||
      /book online|schedule|request appointment|book a consultation/i.test(text)
    );
  });
  const firstBookingText = bookingLinkEls.first().text().trim();
  const bookingFound = matchedBookingProviders.length > 0 || bookingLinkEls.length > 0;
  const bookingEvidence =
    matchedBookingProviders.length > 0
      ? `Detected booking integration: ${matchedBookingProviders.join(', ')}`
      : firstBookingText
        ? `Booking CTA link observed: "${firstBookingText}"`
        : NOT_OBSERVED_TEXT;

  signals.push({
    id: 'booking_platform',
    label: 'Online booking integration or scheduling link',
    category: 'booking',
    found: bookingFound,
    evidence: truncateEvidence(bookingEvidence),
    pageId,
  });

  // 8. Chat / messaging widgets
  const matchedChat = CHAT_WIDGETS.filter((cw) =>
    cw.patterns.some((p) => p.test(combinedTechnicalText)),
  ).map((cw) => cw.name);
  signals.push({
    id: 'chat_widget_present',
    label: 'Live chat or messaging widget',
    category: 'chat',
    found: matchedChat.length > 0,
    evidence:
      matchedChat.length > 0
        ? `Detected messaging widget: ${matchedChat.join(', ')}`
        : NOT_OBSERVED_TEXT,
    pageId,
  });

  // 9. CRM / marketing embeds
  const matchedCrm = CRM_FORM_EMBEDS.filter((c) =>
    c.patterns.some((p) => p.test(combinedTechnicalText)),
  ).map((c) => c.name);
  signals.push({
    id: 'crm_form_embed',
    label: 'CRM or email marketing embed',
    category: 'crm',
    found: matchedCrm.length > 0,
    evidence:
      matchedCrm.length > 0
        ? `Detected embed: ${matchedCrm.join(', ')}`
        : NOT_OBSERVED_TEXT,
    pageId,
  });

  // 10. Analytics tags (presence only)
  const analyticsFound: string[] = [];
  if (/googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]+/i.test(combinedTechnicalText)) {
    analyticsFound.push('Google Tag Manager');
  }
  if (/googletagmanager\.com\/gtag\/js|gtag\(\s*['"]config['"]\s*,\s*['"]G-/i.test(combinedTechnicalText)) {
    analyticsFound.push('Google Analytics (GA4)');
  }
  if (/connect\.facebook\.net.*fbevents\.js|fbq\(\s*['"]init['"]/i.test(combinedTechnicalText)) {
    analyticsFound.push('Meta Pixel');
  }
  signals.push({
    id: 'analytics_tag_present',
    label: 'Analytics / tag snippet presence',
    category: 'analytics',
    found: analyticsFound.length > 0,
    evidence:
      analyticsFound.length > 0
        ? `Tag present: ${analyticsFound.join(', ')}`
        : NOT_OBSERVED_TEXT,
    pageId,
  });

  // 11. Platform hints
  const generator = $('meta[name="generator"]').attr('content') || '';
  const platformHits: string[] = [];
  if (/wordpress/i.test(generator) || /\/wp-content\/|\/wp-includes\//i.test(rawHtmlLower)) {
    platformHits.push('WordPress');
  }
  if (/wix/i.test(generator) || /wixstatic\.com|parastorage\.com/i.test(rawHtmlLower)) {
    platformHits.push('Wix');
  }
  if (/squarespace/i.test(generator) || /squarespace\.com|static1\.squarespace\.com/i.test(rawHtmlLower)) {
    platformHits.push('Squarespace');
  }
  if (/cdn\.shopify\.com|shopify\.theme/i.test(rawHtmlLower)) {
    platformHits.push('Shopify');
  }
  if (/webflow/i.test(generator) || /website-files\.com|data-wf-site/i.test(rawHtmlLower)) {
    platformHits.push('Webflow');
  }
  signals.push({
    id: 'platform_hint',
    label: 'Website platform hint',
    category: 'platform',
    found: platformHits.length > 0,
    evidence:
      platformHits.length > 0
        ? `Platform indicator: ${platformHits.join(', ')}`
        : NOT_OBSERVED_TEXT,
    pageId,
  });

  // 12. FAQ section
  const hasFaqHeading = $('h1, h2, h3, summary')
    .toArray()
    .some((el) => /frequently asked|\bfaq\b/i.test($(el).text()));
  const hasFaqSchema = /"FAQPage"/i.test(inlineScripts);
  signals.push({
    id: 'faq_section_present',
    label: 'FAQ section or schema',
    category: 'trust',
    found: hasFaqHeading || hasFaqSchema,
    evidence: hasFaqSchema
      ? 'FAQPage structured data detected'
      : hasFaqHeading
        ? 'FAQ section heading observed on page'
        : NOT_OBSERVED_TEXT,
    pageId,
  });

  // 13. Testimonials / Reviews section
  const hasReviewsHeading = $('h1, h2, h3, section')
    .toArray()
    .some((el) => /testimonial|patient review|client review|reviews/i.test($(el).text().slice(0, 120)));
  const hasReviewSchema = /"Review"|"AggregateRating"/i.test(inlineScripts);
  signals.push({
    id: 'testimonials_section_present',
    label: 'Testimonials or review section',
    category: 'trust',
    found: hasReviewsHeading || hasReviewSchema,
    evidence: hasReviewSchema
      ? 'Review/AggregateRating structured data detected'
      : hasReviewsHeading
        ? 'Testimonials or reviews section observed'
        : NOT_OBSERVED_TEXT,
    pageId,
  });

  // 14. Schema.org types
  const schemaTypes: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).html() || '';
    const matches = raw.match(/"@type"\s*:\s*"([^"]+)"/g) ?? [];
    for (const m of matches) {
      const val = m.split(':')[1]?.replace(/["\s]/g, '');
      if (val && !schemaTypes.includes(val)) schemaTypes.push(val);
    }
  });
  signals.push({
    id: 'schema_org_present',
    label: 'Structured data (Schema.org)',
    category: 'trust',
    found: schemaTypes.length > 0,
    evidence:
      schemaTypes.length > 0
        ? `Schema types observed: ${schemaTypes.slice(0, 6).join(', ')}`
        : NOT_OBSERVED_TEXT,
    pageId,
  });

  // 15. Social profiles
  const socialHosts = ['facebook.com', 'instagram.com', 'linkedin.com', 'youtube.com', 'tiktok.com', 'x.com', 'twitter.com'];
  const socialFound: string[] = [];
  $('a[href]').each((_, el) => {
    const href = ($(el).attr('href') || '').toLowerCase();
    for (const host of socialHosts) {
      if (href.includes(host) && !socialFound.includes(host)) {
        socialFound.push(host);
      }
    }
  });
  signals.push({
    id: 'social_profiles_present',
    label: 'Linked social media profiles',
    category: 'trust',
    found: socialFound.length > 0,
    evidence:
      socialFound.length > 0
        ? `Social links: ${socialFound.join(', ')}`
        : NOT_OBSERVED_TEXT,
    pageId,
  });

  // 16. Language
  const htmlLang = $('html').attr('lang')?.trim() || '';
  signals.push({
    id: 'site_language',
    label: 'Declared HTML language',
    category: 'platform',
    found: Boolean(htmlLang),
    evidence: htmlLang ? `html lang="${htmlLang}"` : NOT_OBSERVED_TEXT,
    pageId,
  });

  return signals;
}

export function mergeSignalsAcrossPages(allPageSignals: DetectedSignal[][]): DetectedSignal[] {
  const merged = new Map<string, DetectedSignal>();
  for (const pageSignals of allPageSignals) {
    for (const sig of pageSignals) {
      const existing = merged.get(sig.id);
      if (!existing) {
        merged.set(sig.id, sig);
      } else if (!existing.found && sig.found) {
        merged.set(sig.id, sig);
      }
    }
  }
  return Array.from(merged.values());
}

