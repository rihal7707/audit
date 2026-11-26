// src/lib/roi/narrative.ts
// Deterministic explanation template (no Gemini call)
import type { Currency, RoiOutputs, RoiScenario } from './types';
import { formatCount, formatCurrency, formatHours, formatMonths, formatPct } from './format';

export function buildRoiNarrative(params: {
  businessName: string;
  currency: Currency;
  scenario: RoiScenario;
  outputs: RoiOutputs;
}): string {
  const { businessName, currency, scenario, outputs } = params;
  const parts: string[] = [];

  if (outputs.totalHoursReclaimedMonthly !== null) {
    const hrs = `${formatHours(outputs.totalHoursReclaimedMonthly)} hours/month`;
    if (outputs.capacityValueMonthly !== null && outputs.capacityValueAnnual !== null) {
      parts.push(
        `Under your ${scenario.label} assumptions (${scenario.adminAutomationPct}% admin automation, ${scenario.followUpAutomationPct}% follow-up automation), ${businessName} could reclaim roughly ${hrs} of staff time — representing ${formatCurrency(outputs.capacityValueMonthly, currency)}/month (${formatCurrency(outputs.capacityValueAnnual, currency)}/year) in staff capacity that may be freed for other work (not cash savings or a payroll reduction).`,
      );
    } else {
      parts.push(
        `Under your ${scenario.label} assumptions, ${businessName} could reclaim roughly ${hrs} of repetitive staff work each month.`,
      );
    }
  }

  if (outputs.recoveredEnquiriesMonthly !== null) {
    const rec = `${formatCount(outputs.recoveredEnquiriesMonthly)} enquiries/month`;
    if (
      outputs.potentialCustomersMonthly !== null &&
      outputs.grossProfitOpportunityMonthly !== null &&
      outputs.grossProfitOpportunityAnnual !== null
    ) {
      parts.push(
        `Recovering ${scenario.missedCallRecoverPct}% of missed calls represents about ${rec} (${formatCount(outputs.potentialCustomersMonthly)} potential customers/month), an illustrative gross-profit opportunity of ${formatCurrency(outputs.grossProfitOpportunityMonthly, currency)}/month (${formatCurrency(outputs.grossProfitOpportunityAnnual, currency)}/year).`,
      );
    } else {
      parts.push(`Recovering ${scenario.missedCallRecoverPct}% of missed calls represents about ${rec}.`);
    }
  }

  if (outputs.roiPctBasisA !== null || outputs.roiPctBasisB !== null) {
    const basisSummary: string[] = [];
    if (outputs.roiPctBasisA !== null) {
      const paybackA = outputs.paybackMonthsBasisA !== null ? ` (~${formatMonths(outputs.paybackMonthsBasisA)} payback)` : '';
      basisSummary.push(`Basis A (profit-opportunity only): ${formatPct(outputs.roiPctBasisA)} Year-1 ROI${paybackA}`);
    }
    if (outputs.roiPctBasisB !== null) {
      const paybackB = outputs.paybackMonthsBasisB !== null ? ` (~${formatMonths(outputs.paybackMonthsBasisB)} payback)` : '';
      basisSummary.push(`Basis B (including staff capacity): ${formatPct(outputs.roiPctBasisB)} Year-1 ROI${paybackB}`);
    }
    if (basisSummary.length > 0) {
      parts.push(`With your entered costs: ${basisSummary.join('; ')}.`);
    }
  } else {
    parts.push(
      'Implementation and running costs are optional; add your own quote or estimate in Costs to compute Year-1 ROI and payback.',
    );
  }

  parts.push(
    'These figures are illustrative estimates built from your inputs and editable starting points — they are not guaranteed results and not cash savings.',
  );

  return parts.join(' ');
}
