const FREE_EMAIL_DOMAINS = new Set<string>([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'ymail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'gmx.com',
  'mail.com',
  'zoho.com',
]);

export function isFreeEmailDomain(email: string): boolean {
  const domain = email.trim().toLowerCase().split('@')[1] ?? '';
  return FREE_EMAIL_DOMAINS.has(domain);
}

const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_REGEX = /(?:(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,4}\d{3,4})/g;
const LONG_DIGITS_REGEX = /\b(?:\d[\s-]?){13,19}\b/g;
const SECRET_PATTERN_REGEX =
  /\b(?:AIza[0-9A-Za-z\-_]{20,}|sk-[0-9A-Za-z]{16,}|Bearer\s+[0-9A-Za-z\-_.]{12,}|password\s*[:=]\s*\S+)\b/gi;

export interface SensitiveTextCheckResult {
  hasSensitiveData: boolean;
  reasons: string[];
}

export function detectSensitiveFreeText(text: string | null | undefined): SensitiveTextCheckResult {
  if (!text || text.trim().length === 0) {
    return { hasSensitiveData: false, reasons: [] };
  }

  const reasons: string[] = [];
  if (EMAIL_REGEX.test(text)) {
    reasons.push('email address');
  }
  EMAIL_REGEX.lastIndex = 0;

  if (LONG_DIGITS_REGEX.test(text)) {
    reasons.push('long card or ID number sequence');
  }
  LONG_DIGITS_REGEX.lastIndex = 0;

  const phoneMatches = text.match(PHONE_REGEX) ?? [];
  const plausiblePhones = phoneMatches.filter((m) => m.replace(/\D/g, '').length >= 8);
  if (plausiblePhones.length > 0) {
    reasons.push('phone number');
  }

  if (SECRET_PATTERN_REGEX.test(text)) {
    reasons.push('credential or API key pattern');
  }
  SECRET_PATTERN_REGEX.lastIndex = 0;

  return {
    hasSensitiveData: reasons.length > 0,
    reasons,
  };
}

export function scrubSensitiveForAi(text: string | null | undefined): string {
  if (!text) return '';
  let scrubbed = text;
  scrubbed = scrubbed.replace(EMAIL_REGEX, '[REDACTED_EMAIL]');
  scrubbed = scrubbed.replace(SECRET_PATTERN_REGEX, '[REDACTED_CREDENTIAL]');
  scrubbed = scrubbed.replace(LONG_DIGITS_REGEX, '[REDACTED_NUMBER]');
  scrubbed = scrubbed.replace(PHONE_REGEX, (match) => {
    const digits = match.replace(/\D/g, '');
    return digits.length >= 8 ? '[REDACTED_PHONE]' : match;
  });
  return scrubbed;
}

