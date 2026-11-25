// src/lib/roi/format.ts
import { CountryOption, COUNTRIES } from '@/lib/config/countries';

/** Simple mapping for default currency per country – fallback USD */
function defaultCurrencyForCountry(countryCode: string): string {
  const match = COUNTRIES.find((c) => c.code === countryCode);
  if (!match) return 'USD';
  // In this repo countries already have a currency name that matches code for most, fallback to USD
  const map: Record<string, string> = {
    US: 'USD',
    IN: 'INR',
    GB: 'GBP',
    DE: 'EUR',
    AE: 'AED',
    // Add others as needed
  };
  return map[match.code] || 'USD';
}

export function formatCurrency(value: number, currency: string): string {
  const safeCurrency = ['USD', 'INR', 'GBP', 'EUR', 'AED'].includes(currency) ? currency : 'USD';
  const locale = safeCurrency === 'INR' ? 'en-IN' : undefined;
  return new Intl.NumberFormat(locale, { style: 'currency', currency: safeCurrency }).format(value);
}

export function getDefaultCurrencyForCountryCode(code: string): string {
  return defaultCurrencyForCountry(code);
}
