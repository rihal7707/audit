// src/lib/ai/build-audit-assistant-context.ts
// Deterministic compact context builder (~6,000 chars max).
// Structurally excludes contactName, contactEmail, contactPhone, contactRole,
// admin notes, leadScore, leadReason, tokens, hashes, and secrets.

import { AMARKETING_SERVICES } from '@/lib/config/services';
import type { AuditReport } from '@/lib/ai/report-schema';
import type { AssistantFindingRef, AssistantOpportunityRef } from '@/lib/ai/assistant-types';
import { formatCurrency, formatHours, formatMonths, formatPct } from '@/lib/roi/format';
import type { SavedRoiState } from '@/lib/roi/types';
import { scrubSensitiveForAi } from '@/lib/security/pii-scrub';
import type { DetectedSignal } from '@/lib/extraction/signals';

export const MAX_ASSISTANT_CONTEXT_CHARS = 6000;

export interface BuildAssistantContextInput {
  businessName: string;
  website: string;
  industry: string;
  businessDescription: string;
  challenges: string[];
  goals: string[];
  crawlCoverage: string | null;
  crawlFailureReason: string | null;
  report: AuditReport;
  signals: DetectedSignal[];
  roiState: SavedRoiState;
}

export interface BuiltAssistantContext {
  contextText: string;
  findingsLookup: Record<string, AssistantFindingRef>;
  opportunitiesLookup: Record<string, AssistantOpportunityRef>;
  findingIds: string[];
  opportunityIds: string[];
  opportunityCategories: Record<string, string>;
}

export function buildFindingElementId(category: string, index: number, title: string): string {
  const slug = `${category}-${index}-${title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return `finding-${slug}`;
}

export function buildAuditAssistantContext(input: BuildAssistantContextInput): BuiltAssistantContext {
  const findingsLookup: Record<string, AssistantFindingRef> = {};
  const opportunitiesLookup: Record<string, AssistantOpportunityRef> = {};
  const findingIds: string[] = [];
  const opportunityIds: string[] = [];
  const opportunityCategories: Record<string, string> = {};

  const findingsList: Array<Record<string, unknown>> = [];
  let fNum = 1;
  for (const sec of input.report.auditSections) {
    sec.findings.forEach((f, idx) => {
      const id = `F${fNum++}`;
      findingIds.push(id);
      const cardId = buildFindingElementId(sec.category, idx, f.title);
      findingsLookup[id] = { id, title: f.title, priority: f.priority, sectionCategory: sec.category, cardId };
      findingsList.push({
        id,
        title: f.title,
        priority: f.priority,
        evidenceType: f.evidenceType,
        sourcePage: f.evidenceRef,
        serviceTag: f.serviceTag,
        observation: f.observation.slice(0, 180),
        recommendation: f.recommendation.slice(0, 180),
      });
    });
  }

  const oppsList = input.report.automationOpportunities.map((o, idx) => {
    const id = `O${idx + 1}`;
    opportunityIds.push(id);
    opportunityCategories[id] = o.serviceTag;
    opportunitiesLookup[id] = { id, title: o.title, priority: o.priority, serviceTag: o.serviceTag };
    return {
      id,
      title: o.title,
      priority: o.priority,
      complexity: o.implementationComplexity,
      serviceTag: o.serviceTag,
      solution: o.proposedSolution.slice(0, 180),
      metric: o.successMetric.slice(0, 120),
    };
  });

  const activeRoiScenario = input.roiState.scenarios[input.roiState.selectedScenario];
  const activeRoiOut = input.roiState.outputs[input.roiState.selectedScenario];
  const ccy = input.roiState.currency;

  const roiSummary = {
    interacted: input.roiState.interacted,
    currency: ccy,
    selectedScenario: activeRoiScenario,
    inputs: input.roiState.inputs,
    outputs: {
      adminManualHoursMonthly: activeRoiOut.adminManualHoursMonthly !== null ? formatHours(activeRoiOut.adminManualHoursMonthly) : null,
      adminHoursReclaimedMonthly: activeRoiOut.adminHoursReclaimedMonthly !== null ? formatHours(activeRoiOut.adminHoursReclaimedMonthly) : null,
      adminHoursReclaimedAnnual: activeRoiOut.adminHoursReclaimedAnnual !== null ? Math.round(activeRoiOut.adminHoursReclaimedAnnual) : null,
      followUpManualHoursMonthly: activeRoiOut.followUpManualHoursMonthly !== null ? formatHours(activeRoiOut.followUpManualHoursMonthly) : null,
      followUpHoursReclaimedMonthly: activeRoiOut.followUpHoursReclaimedMonthly !== null ? formatHours(activeRoiOut.followUpHoursReclaimedMonthly) : null,
      totalHoursReclaimedMonthly: activeRoiOut.totalHoursReclaimedMonthly !== null ? formatHours(activeRoiOut.totalHoursReclaimedMonthly) : null,
      capacityValueMonthly: activeRoiOut.capacityValueMonthly !== null ? formatCurrency(activeRoiOut.capacityValueMonthly, ccy) : null,
      capacityValueAnnual: activeRoiOut.capacityValueAnnual !== null ? formatCurrency(activeRoiOut.capacityValueAnnual, ccy) : null,
      recoveredEnquiriesMonthly: activeRoiOut.recoveredEnquiriesMonthly,
      potentialCustomersMonthly: activeRoiOut.potentialCustomersMonthly,
      grossProfitOpportunityMonthly: activeRoiOut.grossProfitOpportunityMonthly !== null ? formatCurrency(activeRoiOut.grossProfitOpportunityMonthly, ccy) : null,
      grossProfitOpportunityAnnual: activeRoiOut.grossProfitOpportunityAnnual !== null ? formatCurrency(activeRoiOut.grossProfitOpportunityAnnual, ccy) : null,
      annualRunningCost: activeRoiOut.annualRunningCost !== null ? formatCurrency(activeRoiOut.annualRunningCost, ccy) : null,
      netYear1BasisA: activeRoiOut.netYear1BasisA !== null ? formatCurrency(activeRoiOut.netYear1BasisA, ccy) : null,
      netYear1BasisB: activeRoiOut.netYear1BasisB !== null ? formatCurrency(activeRoiOut.netYear1BasisB, ccy) : null,
      roiPctBasisA: activeRoiOut.roiPctBasisA !== null ? formatPct(activeRoiOut.roiPctBasisA) : null,
      roiPctBasisB: activeRoiOut.roiPctBasisB !== null ? formatPct(activeRoiOut.roiPctBasisB) : null,
      paybackMonthsBasisA: activeRoiOut.paybackMonthsBasisA !== null ? formatMonths(activeRoiOut.paybackMonthsBasisA) : null,
      paybackMonthsBasisB: activeRoiOut.paybackMonthsBasisB !== null ? formatMonths(activeRoiOut.paybackMonthsBasisB) : null,
      roiReasonA: activeRoiOut.roiReasonA,
      roiReasonB: activeRoiOut.roiReasonB,
    },
  };

  const payloadObj = {
    business: {
      name: scrubSensitiveForAi(input.businessName),
      website: input.website,
      industry: input.industry,
      description: scrubSensitiveForAi(input.businessDescription).slice(0, 400),
      challenges: input.challenges,
      goals: input.goals,
      coverage: input.crawlCoverage ?? input.report.meta.coverage,
      coverageNote: input.crawlFailureReason,
      limitations: input.report.limitations.slice(0, 4),
    },
    executiveSummary: input.report.executiveSummary.summary.slice(0, 450),
    findings: findingsList,
    opportunities: oppsList,
    agents: input.report.aiAgentRecommendations.map((a) => ({
      name: a.name,
      purpose: a.purpose.slice(0, 140),
      serviceTag: a.serviceTag,
    })),
    roadmap: input.report.businessRoadmap,
    signals: input.signals.slice(0, 16).map((s) => ({
      id: s.id,
      label: s.label,
      found: s.found,
      evidence: s.found ? s.evidence.slice(0, 80) : 'Not observed on inspected pages',
    })),
    roi: roiSummary,
    services: AMARKETING_SERVICES.map((s) => ({ id: s.id, name: s.name })),
  };

  let serialized = JSON.stringify(payloadObj);
  if (serialized.length > MAX_ASSISTANT_CONTEXT_CHARS) {
    // Compact findings/signals progressively while preserving ROI + services + roadmap
    payloadObj.findings = findingsList.map((f) => ({
      id: f.id,
      title: f.title,
      priority: f.priority,
      serviceTag: f.serviceTag,
      sourcePage: f.sourcePage,
    }));
    payloadObj.signals = payloadObj.signals.filter((s) => s.found);
    serialized = JSON.stringify(payloadObj);
  }
  if (serialized.length > MAX_ASSISTANT_CONTEXT_CHARS) {
    serialized = serialized.slice(0, MAX_ASSISTANT_CONTEXT_CHARS);
  }

  return {
    contextText: serialized,
    findingsLookup,
    opportunitiesLookup,
    findingIds,
    opportunityIds,
    opportunityCategories,
  };
}
