export interface CountryOption {
  code: string;
  name: string;
  eeaUkChRestricted: boolean;
}

/**
 * Unpaid Gemini API quota terms restrict making the service available in the EEA,
 * Switzerland, and the United Kingdom unless Paid Services (Cloud Billing) are enabled.
 */
export const RESTRICTED_UNPAID_GEMINI_COUNTRY_CODES = new Set<string>([
  // EU 27
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  // Non-EU EEA
  'IS', 'LI', 'NO',
  // Switzerland & United Kingdom
  'CH', 'GB',
]);

export const COUNTRIES: readonly CountryOption[] = [
  { code: 'US', name: 'United States', eeaUkChRestricted: false },
  { code: 'CA', name: 'Canada', eeaUkChRestricted: false },
  { code: 'AU', name: 'Australia', eeaUkChRestricted: false },
  { code: 'NZ', name: 'New Zealand', eeaUkChRestricted: false },
  { code: 'AE', name: 'United Arab Emirates', eeaUkChRestricted: false },
  { code: 'SG', name: 'Singapore', eeaUkChRestricted: false },
  { code: 'IN', name: 'India', eeaUkChRestricted: false },
  { code: 'ZA', name: 'South Africa', eeaUkChRestricted: false },
  { code: 'GB', name: 'United Kingdom', eeaUkChRestricted: true },
  { code: 'IE', name: 'Ireland', eeaUkChRestricted: true },
  { code: 'DE', name: 'Germany', eeaUkChRestricted: true },
  { code: 'FR', name: 'France', eeaUkChRestricted: true },
  { code: 'NL', name: 'Netherlands', eeaUkChRestricted: true },
  { code: 'ES', name: 'Spain', eeaUkChRestricted: true },
  { code: 'IT', name: 'Italy', eeaUkChRestricted: true },
  { code: 'CH', name: 'Switzerland', eeaUkChRestricted: true },
  { code: 'AT', name: 'Austria', eeaUkChRestricted: true },
  { code: 'BE', name: 'Belgium', eeaUkChRestricted: true },
  { code: 'BG', name: 'Bulgaria', eeaUkChRestricted: true },
  { code: 'HR', name: 'Croatia', eeaUkChRestricted: true },
  { code: 'CY', name: 'Cyprus', eeaUkChRestricted: true },
  { code: 'CZ', name: 'Czechia', eeaUkChRestricted: true },
  { code: 'DK', name: 'Denmark', eeaUkChRestricted: true },
  { code: 'EE', name: 'Estonia', eeaUkChRestricted: true },
  { code: 'FI', name: 'Finland', eeaUkChRestricted: true },
  { code: 'GR', name: 'Greece', eeaUkChRestricted: true },
  { code: 'HU', name: 'Hungary', eeaUkChRestricted: true },
  { code: 'IS', name: 'Iceland', eeaUkChRestricted: true },
  { code: 'LV', name: 'Latvia', eeaUkChRestricted: true },
  { code: 'LI', name: 'Liechtenstein', eeaUkChRestricted: true },
  { code: 'LT', name: 'Lithuania', eeaUkChRestricted: true },
  { code: 'LU', name: 'Luxembourg', eeaUkChRestricted: true },
  { code: 'MT', name: 'Malta', eeaUkChRestricted: true },
  { code: 'NO', name: 'Norway', eeaUkChRestricted: true },
  { code: 'PL', name: 'Poland', eeaUkChRestricted: true },
  { code: 'PT', name: 'Portugal', eeaUkChRestricted: true },
  { code: 'RO', name: 'Romania', eeaUkChRestricted: true },
  { code: 'SK', name: 'Slovakia', eeaUkChRestricted: true },
  { code: 'SI', name: 'Slovenia', eeaUkChRestricted: true },
  { code: 'SE', name: 'Sweden', eeaUkChRestricted: true },
  { code: 'SA', name: 'Saudi Arabia', eeaUkChRestricted: false },
  { code: 'QA', name: 'Qatar', eeaUkChRestricted: false },
  { code: 'MY', name: 'Malaysia', eeaUkChRestricted: false },
  { code: 'JP', name: 'Japan', eeaUkChRestricted: false },
  { code: 'BR', name: 'Brazil', eeaUkChRestricted: false },
  { code: 'MX', name: 'Mexico', eeaUkChRestricted: false },
  { code: 'OTHER', name: 'Other (Outside EEA/UK/Switzerland)', eeaUkChRestricted: false },
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

