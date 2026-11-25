// src/lib/roi/calculator.ts
import { RoiInputs, RoiScenario, RoiOutputs } from '@/lib/roi/types';
import { formatCurrency } from '@/lib/roi/format';

export const calcVersion = '1.0.0';

// Default scenarios (editable starting points)
export const DEFAULT_SCENARIOS: RoiScenario[] = [
  { label: 'CONSERVATIVE', adminAutomationPct: 25, missedCallRecoverPct: 20, followUpAutomationPct: 25 },
  { label: 'MODERATE', adminAutomationPct: 50, missedCallRecoverPct: 40, followUpAutomationPct: 50 },
  { label: 'OPTIMISTIC', adminAutomationPct: 75, missedCallRecoverPct: 60, followUpAutomationPct: 75 },
];

/** Clamp a numeric value to a min/max range, returning undefined if out of bounds */
function clamp(value: number | undefined, min: number, max: number): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value) || value < 0) return undefined;
  return Math.min(Math.max(value, min), max);
}

function validate(inputs: RoiInputs, scenario: RoiScenario): { missing: string[]; valid: boolean } {
  const missing: string[] = [];
  const required = [
    'monthlyEnquiries',
    'monthlyCalls',
    'monthlyMissedCalls',
    'monthlyAdminTasks',
    'minutesPerAdminTask',
    'monthlyFollowUps',
    'minutesPerFollowUp',
    'hourlyCost',
    'monthlyBookings',
    'conversionRatePct',
    'grossProfitPerCustomer',
    'implementationCost',
    'monthlyOperatingCost',
    'monthlyMaintenanceCost',
  ];
  for (const key of required) {
    // @ts-ignore index
    if (inputs[key] === undefined) missing.push(key);
  }
  if (missing.length) return { missing, valid: false };
  return { missing, valid: true };
}

export function calculateRoi(inputs: RoiInputs, scenario: RoiScenario): RoiOutputs {
  const { missing, valid } = validate(inputs, scenario);
  const missingReasons = missing.length ? missing.map((k) => `${k} missing`) : [];
  // Helper to safely get number or null
  const get = (v: number | undefined) => (v === undefined ? null : v);

  if (!valid) {
    return { missingReasons } as RoiOutputs;
  }

  // Clamp values as per spec
  const adminAutomationPct = clamp(scenario.adminAutomationPct, 0, 90) ?? 0;
  const missedCallRecoverPct = clamp(scenario.missedCallRecoverPct, 0, 80) ?? 0;
  const followUpAutomationPct = clamp(scenario.followUpAutomationPct, 0, 90) ?? 0;
  const conversionPct = clamp(
    inputs.conversionPctOverride ?? inputs.conversionRatePct,
    0,
    100,
  ) ?? 0;

  // Core manual hours
  const adminManualHoursMonthly =
    (inputs.monthlyAdminTasks! * inputs.minutesPerAdminTask!) / 60;
  const adminHoursReclaimedMonthly = adminManualHoursMonthly * (adminAutomationPct / 100);
  const adminHoursReclaimedAnnual = adminHoursReclaimedMonthly * 12;

  const followUpManualHoursMonthly =
    (inputs.monthlyFollowUps! * inputs.minutesPerFollowUp!) / 60;
  const followUpHoursReclaimedMonthly = followUpManualHoursMonthly * (followUpAutomationPct / 100);
  const followUpHoursReclaimedAnnual = followUpHoursReclaimedMonthly * 12;

  const capacityValueMonthly = (adminHoursReclaimedMonthly + followUpHoursReclaimedMonthly) * inputs.hourlyCost!;
  const capacityValueAnnual = capacityValueMonthly * 12;

  const recoveredEnquiriesMonthly = inputs.monthlyMissedCalls! * (missedCallRecoverPct / 100);
  const potentialCustomersMonthly = recoveredEnquiriesMonthly * (conversionPct / 100);
  const grossProfitOpportunityMonthly = potentialCustomersMonthly * inputs.grossProfitPerCustomer!;
  const grossProfitOpportunityAnnual = grossProfitOpportunityMonthly * 12;

  const annualRunningCost = (inputs.monthlyOperatingCost! + inputs.monthlyMaintenanceCost!) * 12;

  const benefitBasisA = grossProfitOpportunityAnnual;
  const benefitBasisB = grossProfitOpportunityAnnual + capacityValueAnnual;

  const implCost = inputs.implementationCost!;
  const netYear1BasisA = benefitBasisA - annualRunningCost - implCost;
  const netYear1BasisB = benefitBasisB - annualRunningCost - implCost;

  const roiPctBasisA = implCost > 0 ? (netYear1BasisA / implCost) * 100 : null;
  const roiPctBasisB = implCost > 0 ? (netYear1BasisB / implCost) * 100 : null;

  const monthlyBenefitA = benefitBasisA / 12;
  const monthlyBenefitB = benefitBasisB / 12;
  const monthlyRunningCost = (inputs.monthlyOperatingCost! + inputs.monthlyMaintenanceCost!);
  const paybackMonthsBasisA = implCost > 0 && monthlyBenefitA - monthlyRunningCost > 0 ? implCost / (monthlyBenefitA - monthlyRunningCost) : null;
  const paybackMonthsBasisB = implCost > 0 && monthlyBenefitB - monthlyRunningCost > 0 ? implCost / (monthlyBenefitB - monthlyRunningCost) : null;

  return {
    adminManualHoursMonthly: get(adminManualHoursMonthly),
    adminHoursReclaimedMonthly: get(adminHoursReclaimedMonthly),
    adminHoursReclaimedAnnual: get(adminHoursReclaimedAnnual),
    followUpManualHoursMonthly: get(followUpManualHoursMonthly),
    followUpHoursReclaimedMonthly: get(followUpHoursReclaimedMonthly),
    followUpHoursReclaimedAnnual: get(followUpHoursReclaimedAnnual),
    capacityValueMonthly: get(capacityValueMonthly),
    capacityValueAnnual: get(capacityValueAnnual),
    recoveredEnquiriesMonthly: get(recoveredEnquiriesMonthly),
    potentialCustomersMonthly: get(potentialCustomersMonthly),
    grossProfitOpportunityMonthly: get(grossProfitOpportunityMonthly),
    grossProfitOpportunityAnnual: get(grossProfitOpportunityAnnual),
    annualRunningCost: get(annualRunningCost),
    benefitBasisA: get(benefitBasisA),
    benefitBasisB: get(benefitBasisB),
    netYear1BasisA: get(netYear1BasisA),
    netYear1BasisB: get(netYear1BasisB),
    roiPctBasisA,
    roiPctBasisB,
    paybackMonthsBasisA,
    paybackMonthsBasisB,
    missingReasons,
  };
}
