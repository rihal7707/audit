// src/lib/roi/types.ts

export const SUPPORTED_CURRENCIES = ['USD', 'INR', 'GBP', 'EUR', 'AED'] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

export const SCENARIO_KEYS = ['conservative', 'moderate', 'optimistic'] as const;
export type ScenarioKey = (typeof SCENARIO_KEYS)[number];

export interface RoiInputs {
  monthlyEnquiries?: number;
  monthlyCalls?: number;
  monthlyMissedCalls?: number;
  monthlyAdminTasks?: number;
  minutesPerAdminTask?: number;
  monthlyFollowUps?: number;
  minutesPerFollowUp?: number;
  hourlyCost?: number;
  monthlyBookings?: number;
  conversionRatePct?: number;
  grossProfitPerCustomer?: number;
  implementationCost?: number;
  monthlyOperatingCost?: number;
  monthlyMaintenanceCost?: number;
  currency?: Currency;
}

export interface RoiScenario {
  key: ScenarioKey;
  label: string;
  adminAutomationPct: number;
  missedCallRecoverPct: number;
  followUpAutomationPct: number;
  conversionPctOverride?: number;
}

export interface RoiOutputs {
  adminManualHoursMonthly: number | null;
  adminHoursReclaimedMonthly: number | null;
  adminHoursReclaimedAnnual: number | null;
  followUpManualHoursMonthly: number | null;
  followUpHoursReclaimedMonthly: number | null;
  followUpHoursReclaimedAnnual: number | null;
  totalHoursReclaimedMonthly: number | null;
  capacityValueMonthly: number | null;
  capacityValueAnnual: number | null;
  recoveredEnquiriesMonthly: number | null;
  potentialCustomersMonthly: number | null;
  grossProfitOpportunityMonthly: number | null;
  grossProfitOpportunityAnnual: number | null;
  monthlyRunningCost: number | null;
  annualRunningCost: number | null;
  benefitBasisA: number | null;
  benefitBasisB: number | null;
  netYear1BasisA: number | null;
  netYear1BasisB: number | null;
  roiPctBasisA: number | null;
  roiPctBasisB: number | null;
  paybackMonthsBasisA: number | null;
  paybackMonthsBasisB: number | null;
  roiReasonA: string;
  roiReasonB: string;
  missingReasons: string[];
}

export interface RoiPrefillNotes {
  monthlyEnquiries?: string;
  monthlyCalls?: string;
}

export interface SavedRoiState {
  currency: Currency;
  inputs: RoiInputs;
  scenarios: Record<ScenarioKey, RoiScenario>;
  selectedScenario: ScenarioKey;
  outputs: Record<ScenarioKey, RoiOutputs>;
  calcVersion: string;
  interacted: boolean;
  prefillNotes?: RoiPrefillNotes;
  updatedAt?: string;
}
