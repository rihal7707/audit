import { z } from 'zod';
import { AMARKETING_SERVICES } from '@/lib/config/services';

const serviceIds = AMARKETING_SERVICES.map((s) => s.id) as [string, ...string[]];

export const ServiceTagSchema = z.enum(serviceIds);

export const CoverageSchema = z.enum(['COMPLETE', 'PARTIAL', 'LIMITED', 'NONE']);
export const PrioritySchema = z.enum(['HIGH', 'MEDIUM', 'LOW']);
export const ConfidenceSchema = z.enum(['HIGH', 'MEDIUM', 'LOW']);
export const ComplexitySchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export const EvidenceTypeSchema = z.enum([
  'VERIFIED_OBSERVATION',
  'CUSTOMER_PROVIDED',
  'AI_HYPOTHESIS',
]);
export const SectionStatusSchema = z.enum([
  'STRONG_SIGNALS',
  'OPPORTUNITIES_IDENTIFIED',
  'NEEDS_ATTENTION',
  'INSUFFICIENT_INFORMATION',
]);

export const AuditFindingSchema = z
  .object({
    title: z.string().min(3).max(160),
    observation: z.string().min(10).max(500),
    evidence: z.string().min(3).max(400),
    evidenceRef: z.string().min(1).max(60),
    sourceUrl: z.string().max(400).nullable(),
    evidenceType: EvidenceTypeSchema,
    businessImpact: z.string().min(10).max(400),
    recommendation: z.string().min(10).max(500),
    priority: PrioritySchema,
    confidence: ConfidenceSchema,
    serviceTag: ServiceTagSchema,
  })
  .strict();

export const AuditSectionSchema = z
  .object({
    category: z.string().min(2).max(100),
    status: SectionStatusSchema,
    summary: z.string().min(10).max(400),
    findings: z.array(AuditFindingSchema).max(4),
  })
  .strict();

export const AutomationOpportunitySchema = z
  .object({
    title: z.string().min(3).max(160),
    problem: z.string().min(10).max(400),
    proposedSolution: z.string().min(10).max(500),
    howItWorks: z.array(z.string().min(4).max(200)).min(2).max(6),
    businessBenefit: z.string().min(10).max(360),
    priority: PrioritySchema,
    implementationComplexity: ComplexitySchema,
    successMetric: z.string().min(6).max(240),
    serviceTag: ServiceTagSchema,
  })
  .strict();

export const AiAgentRecommendationSchema = z
  .object({
    name: z.string().min(3).max(120),
    purpose: z.string().min(10).max(360),
    workflow: z.array(z.string().min(3).max(140)).min(3).max(6),
    expectedBenefit: z.string().min(10).max(320),
    serviceTag: ServiceTagSchema,
  })
  .strict();

export const AuditReportSchema = z
  .object({
    meta: z
      .object({
        reportVersion: z.string().min(1).max(40),
        promptVersion: z.string().min(1).max(40),
        model: z.string().min(1).max(80),
        generatedAt: z.string().min(1).max(60),
        coverage: CoverageSchema,
      })
      .strict(),
    businessOverview: z
      .object({
        businessName: z.string().min(1).max(160),
        website: z.string().min(1).max(300),
        industry: z.string().min(1).max(80),
        summary: z.string().min(15).max(700),
        servicesIdentified: z.array(z.string().min(2).max(120)).max(12),
        auditCoverage: z.string().min(10).max(360),
      })
      .strict(),
    executiveSummary: z
      .object({
        summary: z.string().min(20).max(900),
        positiveObservations: z.array(z.string().min(5).max(260)).min(1).max(6),
        mainImprovementAreas: z.array(z.string().min(5).max(260)).min(1).max(6),
      })
      .strict(),
    auditSections: z.array(AuditSectionSchema).min(2).max(6),
    automationOpportunities: z.array(AutomationOpportunitySchema).min(1).max(6),
    aiAgentRecommendations: z.array(AiAgentRecommendationSchema).min(1).max(4),
    businessRoadmap: z
      .object({
        first30Days: z.array(z.string().min(5).max(240)).min(1).max(5),
        days31To60: z.array(z.string().min(5).max(240)).min(1).max(5),
        days61To90: z.array(z.string().min(5).max(240)).min(1).max(5),
      })
      .strict(),
    assumptions: z.array(z.string().min(5).max(260)).min(1).max(8),
    limitations: z.array(z.string().min(5).max(260)).min(1).max(8),
    recommendedNextSteps: z.array(z.string().min(5).max(240)).min(1).max(6),
    closingMessage: z.string().min(15).max(600),
  })
  .strict();

export type AuditReport = z.infer<typeof AuditReportSchema>;
export type AuditFinding = z.infer<typeof AuditFindingSchema>;
export type AuditSection = z.infer<typeof AuditSectionSchema>;
export type AutomationOpportunity = z.infer<typeof AutomationOpportunitySchema>;
export type AiAgentRecommendation = z.infer<typeof AiAgentRecommendationSchema>;

const UNSUPPORTED_GEMINI_SCHEMA_KEYS = new Set([
  '$schema',
  'minLength',
  'maxLength',
  'minItems',
  'maxItems',
  'pattern',
  'propertyNames',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
]);

function stripUnsupportedJsonSchemaKeys(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map(stripUnsupportedJsonSchemaKeys);
  }
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(node as Record<string, unknown>)) {
      if (UNSUPPORTED_GEMINI_SCHEMA_KEYS.has(key)) continue;
      out[key] = stripUnsupportedJsonSchemaKeys(val);
    }
    return out;
  }
  return node;
}

export function getGeminiResponseJsonSchema(): Record<string, unknown> {
  const raw = z.toJSONSchema(AuditReportSchema);
  return stripUnsupportedJsonSchemaKeys(raw) as Record<string, unknown>;
}

