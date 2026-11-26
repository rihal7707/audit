// src/lib/roi/calculator.ts
import type { RoiInputs, RoiOutputs, RoiScenario, ScenarioKey } from './types';

export const calcVersion = '1.0.0';

export const DEFAULT_SCENARIOS: Record<ScenarioKey, RoiScenario> = {
  conservative: {
    key: 'conservative',
    label: 'Conservative',
    adminAutomationPct: 25,
    missedCallRecoverPct: 20,
    followUpAutomationPct: 25,
  },
  moderate: {
    key: 'moderate',
    label: 'Moderate',
    adminAutomationPct: 50,
    missedCallRecoverPct: 40,
    followUpAutomationPct: 50,
  },
  optimistic: {
    key: 'optimistic',
    label: 'Optimistic',
    adminAutomationPct: 75,
    missedCallRecoverPct: 60,
    followUpAutomationPct: 75,
  },
};

export const INPUT_LIMITS: Record<string, [number, number]> = {
  monthlyEnquiries: [0, 100_000],
  monthlyCalls: [0, 100_000],
  monthlyMissedCalls: [0, 100_000],
  monthlyAdminTasks: [0, 100_000],
  minutesPerAdminTask: [0, 600],
  monthlyFollowUps: [0, 100_000],
  minutesPerFollowUp: [0, 600],
  hourlyCost: [0, 10_000],
  monthlyBookings: [0, 100_000],
  conversionRatePct: [0, 100],
  grossProfitPerCustomer: [0, 1_000_000],
  implementationCost: [0, 10_000_000],
  monthlyOperatingCost: [0, 1_000_000],
  monthlyMaintenanceCost: [0, 1_000_000],
};

function validNonNeg(value: unknown, key: string): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  const lim = INPUT_LIMITS[key];
  if (!lim) return value;
  return Math.min(Math.max(value, lim[0]), lim[1]);
}

function validPct(value: unknown, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return Math.min(value, max);
}

export function cloneDefaultScenarios(): Record<ScenarioKey, RoiScenario> {
  return {
    conservative: { ...DEFAULT_SCENARIOS.conservative },
    moderate: { ...DEFAULT_SCENARIOS.moderate },
    optimistic: { ...DEFAULT_SCENARIOS.optimistic },
  };
}

export function calculateRoi(inputs: RoiInputs, scenario: RoiScenario): RoiOutputs {
  const missing: string[] = [];

  const tasks = validNonNeg(inputs.monthlyAdminTasks, 'monthlyAdminTasks');
  const minPerTask = validNonNeg(inputs.minutesPerAdminTask, 'minutesPerAdminTask');
  const adminPct = validPct(scenario.adminAutomationPct, 90);

  let adminManualHoursMonthly: number | null = null;
  let adminHoursReclaimedMonthly: number | null = null;
  if (tasks !== null && minPerTask !== null && adminPct !== null) {
    adminManualHoursMonthly = (tasks * minPerTask) / 60;
    adminHoursReclaimedMonthly = adminManualHoursMonthly * (adminPct / 100);
  } else {
    if (tasks === null) missing.push('Monthly administrative tasks');
    if (minPerTask === null) missing.push('Minutes per administrative task');
  }

  const followUps = validNonNeg(inputs.monthlyFollowUps, 'monthlyFollowUps');
  const minPerFU = validNonNeg(inputs.minutesPerFollowUp, 'minutesPerFollowUp');
  const followUpPct = validPct(scenario.followUpAutomationPct, 90);

  let followUpManualHoursMonthly: number | null = null;
  let followUpHoursReclaimedMonthly: number | null = null;
  if (followUps !== null && minPerFU !== null && followUpPct !== null) {
    followUpManualHoursMonthly = (followUps * minPerFU) / 60;
    followUpHoursReclaimedMonthly = followUpManualHoursMonthly * (followUpPct / 100);
  }

  const totalHoursReclaimedMonthly =
    adminHoursReclaimedMonthly !== null || followUpHoursReclaimedMonthly !== null
      ? (adminHoursReclaimedMonthly ?? 0) + (followUpHoursReclaimedMonthly ?? 0)
      : null;

  const hourlyCost = validNonNeg(inputs.hourlyCost, 'hourlyCost');
  let capacityValueMonthly: number | null = null;
  if (totalHoursReclaimedMonthly !== null && hourlyCost !== null) {
    capacityValueMonthly = totalHoursReclaimedMonthly * hourlyCost;
  } else if (hourlyCost === null) {
    missing.push('Staff hourly cost');
  }

  const missedCalls = validNonNeg(inputs.monthlyMissedCalls, 'monthlyMissedCalls');
  const recoverPct = validPct(scenario.missedCallRecoverPct, 80);
  const convSource = scenario.conversionPctOverride ?? inputs.conversionRatePct;
  const convPct = convSource !== undefined ? validPct(convSource, 100) : null;
  const gpPerCust = validNonNeg(inputs.grossProfitPerCustomer, 'grossProfitPerCustomer');

  let recoveredEnquiriesMonthly: number | null = null;
  let potentialCustomersMonthly: number | null = null;
  let grossProfitOpportunityMonthly: number | null = null;

  if (missedCalls !== null && recoverPct !== null) {
    recoveredEnquiriesMonthly = missedCalls * (recoverPct / 100);
    if (convPct !== null) {
      potentialCustomersMonthly = recoveredEnquiriesMonthly * (convPct / 100);
      if (gpPerCust !== null) {
        grossProfitOpportunityMonthly = potentialCustomersMonthly * gpPerCust;
      } else {
        missing.push('Gross profit per customer');
      }
    } else {
      missing.push('Conversion rate (%)');
    }
  }

  const mul12 = (v: number | null) => (v !== null ? v * 12 : null);
  const gpAnnual = mul12(grossProfitOpportunityMonthly);
  const capAnnual = mul12(capacityValueMonthly);

  const opCost = validNonNeg(inputs.monthlyOperatingCost, 'monthlyOperatingCost');
  const maintCost = validNonNeg(inputs.monthlyMaintenanceCost, 'monthlyMaintenanceCost');
  const monthlyRunningCost = opCost !== null || maintCost !== null ? (opCost ?? 0) + (maintCost ?? 0) : null;
  const annualRunningCost = mul12(monthlyRunningCost);

  const benefitBasisA = gpAnnual;
  const benefitBasisB = gpAnnual !== null || capAnnual !== null ? (gpAnnual ?? 0) + (capAnnual ?? 0) : null;

  const implCost = validNonNeg(inputs.implementationCost, 'implementationCost');
  const computeBasis = (annualBenefit: number | null, missingBenefitMsg: string) => {
    if (implCost === null) {
      return { net: null, roi: null, payback: null, reason: 'Implementation cost not yet provided.' };
    }
    if (implCost <= 0 || annualBenefit === null) {
      return {
        net: null,
        roi: null,
        payback: null,
        reason: annualBenefit === null ? missingBenefitMsg : 'Not enough information to calculate ROI.',
      };
    }
    const runYr = annualRunningCost ?? 0;
    const net = annualBenefit - runYr - implCost;
    const roi = (net / implCost) * 100;
    const monthlyBenefit = annualBenefit / 12;
    const runMo = monthlyRunningCost ?? 0;
    const denom = monthlyBenefit - runMo;
    const payback = denom > 0 ? implCost / denom : null;
    return { net, roi, payback, reason: '' };
  };

  const aRes = computeBasis(benefitBasisA, 'Not enough information to calculate ROI.');
  const bRes = computeBasis(benefitBasisB, 'Not enough information to calculate ROI.');

  return {
    adminManualHoursMonthly,
    adminHoursReclaimedMonthly,
    adminHoursReclaimedAnnual: mul12(adminHoursReclaimedMonthly),
    followUpManualHoursMonthly,
    followUpHoursReclaimedMonthly,
    followUpHoursReclaimedAnnual: mul12(followUpHoursReclaimedMonthly),
    totalHoursReclaimedMonthly,
    capacityValueMonthly,
    capacityValueAnnual: capAnnual,
    recoveredEnquiriesMonthly,
    potentialCustomersMonthly,
    grossProfitOpportunityMonthly,
    grossProfitOpportunityAnnual: gpAnnual,
    monthlyRunningCost,
    annualRunningCost,
    benefitBasisA,
    benefitBasisB,
    netYear1BasisA: aRes.net,
    netYear1BasisB: bRes.net,
    roiPctBasisA: aRes.roi,
    roiPctBasisB: bRes.roi,
    paybackMonthsBasisA: aRes.payback,
    paybackMonthsBasisB: bRes.payback,
    roiReasonA: aRes.reason,
    roiReasonB: bRes.reason,
    missingReasons: missing,
  };
}

export function calculateAllScenarios(
  inputs: RoiInputs,
  scenarios: Record<ScenarioKey, RoiScenario>,
): Record<ScenarioKey, RoiOutputs> {
  return {
    conservative: calculateRoi(inputs, scenarios.conservative),
    moderate: calculateRoi(inputs, scenarios.moderate),
    optimistic: calculateRoi(inputs, scenarios.optimistic),
  };
}
