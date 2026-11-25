export interface RoiInputs {
  // business metrics (optional)
  monthlyEnquiries?: number;
  monthlyCalls?: number;
  monthlyMissedCalls?: number;
  monthlyAdminTasks?: number; // tasks per month
  minutesPerAdminTask?: number;
  monthlyFollowUps?: number;
  minutesPerFollowUp?: number;
  hourlyCost?: number; // staff cost per hour in currency
  monthlyBookings?: number;
  conversionRatePct?: number; // % of enquiries that become bookings
  grossProfitPerCustomer?: number;
  implementationCost?: number;
  monthlyOperatingCost?: number;
  monthlyMaintenanceCost?: number;
  currency?: 'USD' | 'INR' | 'GBP' | 'EUR' | 'AED';
  // scenario overrides
  adminAutomationPct?: number; // 0-90
  missedCallRecoverPct?: number; // 0-80
  followUpAutomationPct?: number; // 0-90
  conversionPctOverride?: number; // optional 0-100
}

export interface RoiScenario {
  label: string;
  adminAutomationPct: number;
  missedCallRecoverPct: number;
  followUpAutomationPct: number;
}

export interface RoiOutputs {
  // computed values (null if missing inputs)
  adminManualHoursMonthly?: number | null;
  adminHoursReclaimedMonthly?: number | null;
  adminHoursReclaimedAnnual?: number | null;
  followUpManualHoursMonthly?: number | null;
  followUpHoursReclaimedMonthly?: number | null;
  followUpHoursReclaimedAnnual?: number | null;
  capacityValueMonthly?: number | null; // staff time value
  capacityValueAnnual?: number | null;
  recoveredEnquiriesMonthly?: number | null;
  potentialCustomersMonthly?: number | null;
  grossProfitOpportunityMonthly?: number | null;
  grossProfitOpportunityAnnual?: number | null;
  annualRunningCost?: number | null;
  benefitBasisA?: number | null; // profit only
  benefitBasisB?: number | null; // profit + capacity value
  netYear1BasisA?: number | null;
  netYear1BasisB?: number | null;
  roiPctBasisA?: number | null;
  roiPctBasisB?: number | null;
  paybackMonthsBasisA?: number | null;
  paybackMonthsBasisB?: number | null;
  missingReasons?: string[];
}
