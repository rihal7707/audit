// src/lib/roi/validation.ts
import { z } from 'zod';
import { INPUT_LIMITS } from '@/lib/roi/calculator';
import { SCENARIO_KEYS, SUPPORTED_CURRENCIES, type RoiInputs } from '@/lib/roi/types';

const optionalMetric = (key: keyof typeof INPUT_LIMITS) => {
  const [, max] = INPUT_LIMITS[key]!;
  return z
    .union([z.number(), z.null(), z.undefined()])
    .transform((v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(v, max) : undefined))
    .optional();
};

export const RoiInputsSchema = z
  .object({
    monthlyEnquiries: optionalMetric('monthlyEnquiries'),
    monthlyCalls: optionalMetric('monthlyCalls'),
    monthlyMissedCalls: optionalMetric('monthlyMissedCalls'),
    monthlyAdminTasks: optionalMetric('monthlyAdminTasks'),
    minutesPerAdminTask: optionalMetric('minutesPerAdminTask'),
    monthlyFollowUps: optionalMetric('monthlyFollowUps'),
    minutesPerFollowUp: optionalMetric('minutesPerFollowUp'),
    hourlyCost: optionalMetric('hourlyCost'),
    monthlyBookings: optionalMetric('monthlyBookings'),
    conversionRatePct: optionalMetric('conversionRatePct'),
    grossProfitPerCustomer: optionalMetric('grossProfitPerCustomer'),
    implementationCost: optionalMetric('implementationCost'),
    monthlyOperatingCost: optionalMetric('monthlyOperatingCost'),
    monthlyMaintenanceCost: optionalMetric('monthlyMaintenanceCost'),
    currency: z.enum(SUPPORTED_CURRENCIES).optional(),
  })
  .strict();

export const RoiScenarioSchema = z
  .object({
    key: z.enum(SCENARIO_KEYS),
    label: z.string().trim().min(1).max(40),
    adminAutomationPct: z.number().finite().min(0).max(90),
    missedCallRecoverPct: z.number().finite().min(0).max(80),
    followUpAutomationPct: z.number().finite().min(0).max(90),
    conversionPctOverride: z.number().finite().min(0).max(100).optional(),
  })
  .strict();

export const SaveRoiPayloadSchema = z
  .object({
    currency: z.enum(SUPPORTED_CURRENCIES),
    selectedScenario: z.enum(SCENARIO_KEYS),
    inputs: RoiInputsSchema,
    scenarios: z
      .object({
        conservative: RoiScenarioSchema,
        moderate: RoiScenarioSchema,
        optimistic: RoiScenarioSchema,
      })
      .strict(),
  })
  .strict();

export function cleanRoiInputs(raw: z.infer<typeof RoiInputsSchema>, currency: RoiInputs['currency']): RoiInputs {
  const cleaned: RoiInputs = { currency };
  for (const [k, v] of Object.entries(raw)) {
    if (k === 'currency') continue;
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
      (cleaned as Record<string, unknown>)[k] = v;
    }
  }
  return cleaned;
}
