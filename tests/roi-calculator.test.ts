// tests/roi-calculator.test.ts
import { describe, it, expect } from 'vitest';
import {
  calculateRoi,
  calcVersion,
  cloneDefaultScenarios,
  DEFAULT_SCENARIOS,
} from '@/lib/roi/calculator';
import { defaultCurrencyForCountry, formatCurrency } from '@/lib/roi/format';
import { buildRoiNarrative } from '@/lib/roi/narrative';
import type { RoiInputs, RoiScenario } from '@/lib/roi/types';

const ADMIN_60_SCENARIO: RoiScenario = {
  key: 'moderate',
  label: 'Moderate',
  adminAutomationPct: 60,
  missedCallRecoverPct: 50,
  followUpAutomationPct: 50,
};

describe('ROI Calculator Fixtures & Edge Cases', () => {
  it('computes admin tasks fixture: 500 tasks, 8 min, $25, admin 60% -> 66.67h manual, 40h reclaimed, 480h/yr, $1,000/mo, $12,000/yr', () => {
    const r = calculateRoi(
      { monthlyAdminTasks: 500, minutesPerAdminTask: 8, hourlyCost: 25 },
      ADMIN_60_SCENARIO,
    );
    expect(calcVersion).toBe('1.0.0');
    expect(r.adminManualHoursMonthly).toBeCloseTo(66.6667, 3);
    expect(r.adminHoursReclaimedMonthly).toBeCloseTo(40.0, 2);
    expect(r.adminHoursReclaimedAnnual).toBeCloseTo(480, 1);
    expect(r.capacityValueMonthly).toBeCloseTo(1000, 1);
    expect(r.capacityValueAnnual).toBeCloseTo(12000, 1);
    // Optional missed calls not given -> null, not 0
    expect(r.recoveredEnquiriesMonthly).toBeNull();
    expect(r.roiPctBasisA).toBeNull();
    expect(r.roiReasonB).toBe('Implementation cost not yet provided.');
  });

  it('computes missed calls & follow-ups fixtures accurately without double counting', () => {
    const inputs: RoiInputs = {
      monthlyAdminTasks: 500,
      minutesPerAdminTask: 8,
      hourlyCost: 25,
      monthlyMissedCalls: 60,
      conversionRatePct: 20,
      grossProfitPerCustomer: 400,
      monthlyFollowUps: 200,
      minutesPerFollowUp: 6,
    };
    const r = calculateRoi(inputs, ADMIN_60_SCENARIO);
    expect(r.recoveredEnquiriesMonthly).toBeCloseTo(30, 2);
    expect(r.potentialCustomersMonthly).toBeCloseTo(6, 2);
    expect(r.grossProfitOpportunityMonthly).toBeCloseTo(2400, 1);
    expect(r.grossProfitOpportunityAnnual).toBeCloseTo(28800, 1);
    expect(r.followUpManualHoursMonthly).toBeCloseTo(20, 2);
    expect(r.followUpHoursReclaimedMonthly).toBeCloseTo(10, 2);
    // Total reclaimed = 40 + 10 = 50h * $25 = $1250/mo, $15000/yr
    expect(r.totalHoursReclaimedMonthly).toBeCloseTo(50, 2);
    expect(r.capacityValueMonthly).toBeCloseTo(1250, 1);
    expect(r.capacityValueAnnual).toBeCloseTo(15000, 1);
  });

  it('returns null (not 0) when inputs are missing, NaN, negative, or Infinity', () => {
    const missing = calculateRoi({}, DEFAULT_SCENARIOS.conservative);
    expect(missing.adminManualHoursMonthly).toBeNull();
    expect(missing.capacityValueMonthly).toBeNull();
    expect(missing.grossProfitOpportunityMonthly).toBeNull();
    expect(missing.roiPctBasisA).toBeNull();
    expect(missing.missingReasons.length).toBeGreaterThan(0);

    const invalid = calculateRoi(
      {
        monthlyAdminTasks: Number.NaN,
        minutesPerAdminTask: -10,
        hourlyCost: Number.POSITIVE_INFINITY,
        monthlyMissedCalls: -5,
      },
      DEFAULT_SCENARIOS.moderate,
    );
    expect(invalid.adminManualHoursMonthly).toBeNull();
    expect(invalid.capacityValueMonthly).toBeNull();
    expect(invalid.recoveredEnquiriesMonthly).toBeNull();
  });

  it('computes ROI and payback only when implementationCost > 0, and returns null when 0 or absent', () => {
    const base: RoiInputs = {
      monthlyAdminTasks: 500,
      minutesPerAdminTask: 8,
      hourlyCost: 25,
      monthlyMissedCalls: 60,
      conversionRatePct: 20,
      grossProfitPerCustomer: 400,
      monthlyOperatingCost: 100,
      monthlyMaintenanceCost: 100,
    };

    const noCost = calculateRoi(base, ADMIN_60_SCENARIO);
    expect(noCost.roiPctBasisA).toBeNull();
    expect(noCost.roiPctBasisB).toBeNull();
    expect(noCost.roiReasonA).toBe('Implementation cost not yet provided.');

    const zeroCost = calculateRoi({ ...base, implementationCost: 0 }, ADMIN_60_SCENARIO);
    expect(zeroCost.roiPctBasisA).toBeNull();
    expect(zeroCost.roiPctBasisB).toBeNull();
    expect(zeroCost.roiReasonA).toBe('Not enough information to calculate ROI.');

    const withCost = calculateRoi({ ...base, implementationCost: 5000 }, ADMIN_60_SCENARIO);
    // Annual running cost = (100+100)*12 = 2400; Benefit A = 28800; Net A = 28800 - 2400 - 5000 = 21400
    expect(withCost.annualRunningCost).toBeCloseTo(2400, 1);
    expect(withCost.netYear1BasisA).toBeCloseTo(21400, 1);
    expect(withCost.roiPctBasisA).toBeCloseTo((21400 / 5000) * 100, 1);
    // Benefit B = 28800 + 12000 = 40800; Net B = 40800 - 2400 - 5000 = 33400
    expect(withCost.netYear1BasisB).toBeCloseTo(33400, 1);
    expect(withCost.paybackMonthsBasisA).toBeCloseTo(5000 / (2400 - 200), 2);
  });

  it('keeps scenarios completely independent when cloned and modified', () => {
    const scenarios = cloneDefaultScenarios();
    scenarios.conservative.adminAutomationPct = 10;
    const inputs: RoiInputs = { monthlyAdminTasks: 100, minutesPerAdminTask: 60, hourlyCost: 30 };
    const rCons = calculateRoi(inputs, scenarios.conservative);
    const rOpt = calculateRoi(inputs, scenarios.optimistic);
    expect(rCons.adminHoursReclaimedMonthly).toBeCloseTo(10, 2);
    expect(rOpt.adminHoursReclaimedMonthly).toBeCloseTo(75, 2);
  });

  it('formats all five supported currencies and resolves country defaults', () => {
    expect(formatCurrency(12000, 'USD')).toContain('$12,000');
    expect(formatCurrency(100000, 'INR')).toContain('1,00,000');
    expect(formatCurrency(5000, 'GBP')).toContain('£5,000');
    expect(formatCurrency(5000, 'EUR')).toContain('€');
    expect(formatCurrency(5000, 'AED')).toMatch(/AED|د\.إ/);

    expect(defaultCurrencyForCountry('IN')).toBe('INR');
    expect(defaultCurrencyForCountry('GB')).toBe('GBP');
    expect(defaultCurrencyForCountry('DE')).toBe('EUR');
    expect(defaultCurrencyForCountry('AE')).toBe('AED');
    expect(defaultCurrencyForCountry('XX')).toBe('USD');
  });

  it('builds deterministic narrative mentioning not guaranteed and not cash savings', () => {
    const out = calculateRoi(
      { monthlyAdminTasks: 500, minutesPerAdminTask: 8, hourlyCost: 25 },
      ADMIN_60_SCENARIO,
    );
    const text = buildRoiNarrative({
      businessName: 'Willow Creek',
      currency: 'USD',
      scenario: ADMIN_60_SCENARIO,
      outputs: out,
    });
    expect(text).toContain('Willow Creek');
    expect(text.toLowerCase()).toContain('not cash savings');
    expect(text.toLowerCase()).toContain('not guaranteed');
  });
});
