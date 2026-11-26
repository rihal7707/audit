// src/lib/roi/prefill.ts
import type { VOLUME_RANGE_OPTIONS } from '@/lib/config/industries';
import { defaultCurrencyForCountry } from '@/lib/roi/format';
import type { RoiInputs, RoiPrefillNotes } from '@/lib/roi/types';

type VolumeOption = (typeof VOLUME_RANGE_OPTIONS)[number];

const VOLUME_MIDPOINTS: Record<VolumeOption, number | undefined> = {
  'Under 25 / month': 12,
  '25–100 / month': 63,
  '100–300 / month': 200,
  '300–1,000 / month': 650,
  '1,000+ / month': 1000,
  'Not sure': undefined,
};

export function mapVolumeRangeMidpoint(range: string | null | undefined): number | undefined {
  if (!range) return undefined;
  const trimmed = range.trim() as VolumeOption;
  return VOLUME_MIDPOINTS[trimmed];
}

export function buildRoiPrefillFromAudit(audit: {
  country: string;
  enquiryVolume?: string | null;
  phoneVolume?: string | null;
}): {
  inputs: RoiInputs;
  prefillNotes: RoiPrefillNotes;
} {
  const currency = defaultCurrencyForCountry(audit.country);
  const inputs: RoiInputs = { currency };
  const prefillNotes: RoiPrefillNotes = {};

  const enquiries = mapVolumeRangeMidpoint(audit.enquiryVolume);
  if (enquiries !== undefined) {
    inputs.monthlyEnquiries = enquiries;
    prefillNotes.monthlyEnquiries = `Estimated from "${audit.enquiryVolume}" (editable)`;
  }

  const calls = mapVolumeRangeMidpoint(audit.phoneVolume);
  if (calls !== undefined) {
    inputs.monthlyCalls = calls;
    prefillNotes.monthlyCalls = `Estimated from "${audit.phoneVolume}" (editable)`;
  }

  // Never prefill hourlyCost, monthlyMissedCalls, conversionRatePct, or grossProfitPerCustomer
  return { inputs, prefillNotes };
}
