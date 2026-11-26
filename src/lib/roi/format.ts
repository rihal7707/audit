// src/lib/roi/format.ts
import type { Currency } from './types';
import { getDefaultCurrencyForCountry } from '@/lib/config/countries';

const LOCALE_MAP: Record<Currency, string> = {
  USD: 'en-US',
  INR: 'en-IN',
  GBP: 'en-GB',
  EUR: 'de-DE',
  AED: 'en-AE',
};

export function formatCurrency(value: number, currency: Currency = 'USD'): string {
  const locale = LOCALE_MAP[currency] ?? 'en-US';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatHours(value: number): string {
  return value.toFixed(2);
}

export function formatCount(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function formatPct(value: number): string {
  return `${Math.round(value)}%`;
}

export function formatMonths(value: number): string {
  if (value < 1) return 'Under 1 month';
  return `${value.toFixed(1)} months`;
}

export function defaultCurrencyForCountry(codeOrName: string | null | undefined): Currency {
  return getDefaultCurrencyForCountry(codeOrName);
}
