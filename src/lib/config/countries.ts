import type { Currency } from '@/lib/roi/types';

export interface CountryOption {
  code: string;
  name: string;
  eeaUkChRestricted: boolean;
  currency: Currency;
}

/**
 * Unpaid Gemini API quota terms restrict making the service available in the EEA,
 * Switzerland, and the United Kingdom unless Paid Services (Cloud Billing) are enabled.
 */
export const RESTRICTED_UNPAID_GEMINI_COUNTRY_CODES = new Set<string>([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'IS', 'LI', 'NO',
  'CH', 'GB',
]);

export const COUNTRIES: readonly CountryOption[] = [
  { code: 'US', name: 'United States', eeaUkChRestricted: false, currency: 'USD' },
  { code: 'CA', name: 'Canada', eeaUkChRestricted: false, currency: 'USD' },
  { code: 'AU', name: 'Australia', eeaUkChRestricted: false, currency: 'USD' },
  { code: 'NZ', name: 'New Zealand', eeaUkChRestricted: false, currency: 'USD' },
  { code: 'AE', name: 'United Arab Emirates', eeaUkChRestricted: false, currency: 'AED' },
  { code: 'SG', name: 'Singapore', eeaUkChRestricted: false, currency: 'USD' },
  { code: 'IN', name: 'India', eeaUkChRestricted: false, currency: 'INR' },
  { code: 'ZA', name: 'South Africa', eeaUkChRestricted: false, currency: 'USD' },
  { code: 'GB', name: 'United Kingdom', eeaUkChRestricted: true, currency: 'GBP' },
  { code: 'IE', name: 'Ireland', eeaUkChRestricted: true, currency: 'EUR' },
  { code: 'DE', name: 'Germany', eeaUkChRestricted: true, currency: 'EUR' },
  { code: 'FR', name: 'France', eeaUkChRestricted: true, currency: 'EUR' },
  { code: 'NL', name: 'Netherlands', eeaUkChRestricted: true, currency: 'EUR' },
  { code: 'ES', name: 'Spain', eeaUkChRestricted: true, currency: 'EUR' },
  { code: 'IT', name: 'Italy', eeaUkChRestricted: true, currency: 'EUR' },
  { code: 'CH', name: 'Switzerland', eeaUkChRestricted: true, currency: 'EUR' },
  { code: 'AT', name: 'Austria', eeaUkChRestricted: true, currency: 'EUR' },
  { code: 'BE', name: 'Belgium', eeaUkChRestricted: true, currency: 'EUR' },
  { code: 'BG', name: 'Bulgaria', eeaUkChRestricted: true, currency: 'EUR' },
  { code: 'HR', name: 'Croatia', eeaUkChRestricted: true, currency: 'EUR' },
  { code: 'CY', name: 'Cyprus', eeaUkChRestricted: true, currency: 'EUR' },
  { code: 'CZ', name: 'Czechia', eeaUkChRestricted: true, currency: 'EUR' },
  { code: 'DK', name: 'Denmark', eeaUkChRestricted: true, currency: 'EUR' },
  { code: 'EE', name: 'Estonia', eeaUkChRestricted: true, currency: 'EUR' },
  { code: 'FI', name: 'Finland', eeaUkChRestricted: true, currency: 'EUR' },
  { code: 'GR', name: 'Greece', eeaUkChRestricted: true, currency: 'EUR' },
  { code: 'HU', name: 'Hungary', eeaUkChRestricted: true, currency: 'EUR' },
  { code: 'IS', name: 'Iceland', eeaUkChRestricted: true, currency: 'EUR' },
  { code: 'LV', name: 'Latvia', eeaUkChRestricted: true, currency: 'EUR' },
  { code: 'LI', name: 'Liechtenstein', eeaUkChRestricted: true, currency: 'EUR' },
  { code: 'LT', name: 'Lithuania', eeaUkChRestricted: true, currency: 'EUR' },
  { code: 'LU', name: 'Luxembourg', eeaUkChRestricted: true, currency: 'EUR' },
  { code: 'MT', name: 'Malta', eeaUkChRestricted: true, currency: 'EUR' },
  { code: 'NO', name: 'Norway', eeaUkChRestricted: true, currency: 'EUR' },
  { code: 'PL', name: 'Poland', eeaUkChRestricted: true, currency: 'EUR' },
  { code: 'PT', name: 'Portugal', eeaUkChRestricted: true, currency: 'EUR' },
  { code: 'RO', name: 'Romania', eeaUkChRestricted: true, currency: 'EUR' },
  { code: 'SK', name: 'Slovakia', eeaUkChRestricted: true, currency: 'EUR' },
  { code: 'SI', name: 'Slovenia', eeaUkChRestricted: true, currency: 'EUR' },
  { code: 'SE', name: 'Sweden', eeaUkChRestricted: true, currency: 'EUR' },
  { code: 'SA', name: 'Saudi Arabia', eeaUkChRestricted: false, currency: 'USD' },
  { code: 'QA', name: 'Qatar', eeaUkChRestricted: false, currency: 'USD' },
  { code: 'MY', name: 'Malaysia', eeaUkChRestricted: false, currency: 'USD' },
  { code: 'JP', name: 'Japan', eeaUkChRestricted: false, currency: 'USD' },
  { code: 'BR', name: 'Brazil', eeaUkChRestricted: false, currency: 'USD' },
  { code: 'MX', name: 'Mexico', eeaUkChRestricted: false, currency: 'USD' },
  { code: 'OTHER', name: 'Other (Outside EEA/UK/Switzerland)', eeaUkChRestricted: false, currency: 'USD' },
] as const;

export function findCountry(codeOrName: string): CountryOption | undefined {
  const normalized = codeOrName.trim().toLowerCase();
  return COUNTRIES.find(
    (c) => c.code.toLowerCase() === normalized || c.name.toLowerCase() === normalized,
  );
}

export function isCountryRestrictedForUnpaidGemini(codeOrName: string): boolean {
  const match = findCountry(codeOrName);
  if (!match) return false;
  return RESTRICTED_UNPAID_GEMINI_COUNTRY_CODES.has(match.code) || match.eeaUkChRestricted;
}

export function getDefaultCurrencyForCountry(codeOrName: string | null | undefined): Currency {
  if (!codeOrName) return 'USD';
  const match = findCountry(codeOrName);
  return match?.currency ?? 'USD';
}
