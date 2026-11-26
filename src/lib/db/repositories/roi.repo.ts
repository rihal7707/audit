// src/lib/db/repositories/roi.repo.ts
import 'server-only';
import { eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { auditRoi } from '@/lib/db/schema';
import {
  calculateAllScenarios,
  calcVersion,
  cloneDefaultScenarios,
} from '@/lib/roi/calculator';
import { buildRoiPrefillFromAudit } from '@/lib/roi/prefill';
import { SUPPORTED_CURRENCIES, type Currency, type RoiInputs, type RoiScenario, type SavedRoiState, type ScenarioKey } from '@/lib/roi/types';

export type AuditRoiRow = typeof auditRoi.$inferSelect;

function safeParseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function findAuditRoiByAuditId(auditId: number): Promise<AuditRoiRow | null> {
  const db = getDb();
  const rows = await db.select().from(auditRoi).where(eq(auditRoi.auditId, auditId)).limit(1);
  return rows[0] ?? null;
}

export function hydrateSavedRoiState(
  row: AuditRoiRow,
  auditMeta: { country: string; enquiryVolume?: string | null; phoneVolume?: string | null },
): SavedRoiState {
  const currency: Currency = SUPPORTED_CURRENCIES.includes(row.currency as Currency)
    ? (row.currency as Currency)
    : 'USD';
  const inputs = safeParseJson<RoiInputs>(row.inputsJson, { currency });
  inputs.currency = currency;
  const scenarios = safeParseJson<Record<ScenarioKey, RoiScenario>>(
    row.scenariosJson,
    cloneDefaultScenarios(),
  );
  const selectedScenario: ScenarioKey =
    row.selectedScenario === 'conservative' || row.selectedScenario === 'optimistic'
      ? row.selectedScenario
      : 'moderate';
  const outputs = calculateAllScenarios(inputs, scenarios);
  const { prefillNotes } = buildRoiPrefillFromAudit(auditMeta);

  return {
    currency,
    inputs,
    scenarios,
    selectedScenario,
    outputs,
    calcVersion: row.calcVersion,
    interacted: row.interacted,
    prefillNotes,
    updatedAt: row.updatedAt,
  };
}

export function buildPrefillRoiState(auditMeta: {
  country: string;
  enquiryVolume?: string | null;
  phoneVolume?: string | null;
}): SavedRoiState {
  const { inputs, prefillNotes } = buildRoiPrefillFromAudit(auditMeta);
  const currency = inputs.currency ?? 'USD';
  const scenarios = cloneDefaultScenarios();
  const outputs = calculateAllScenarios(inputs, scenarios);

  return {
    currency,
    inputs,
    scenarios,
    selectedScenario: 'moderate',
    outputs,
    calcVersion,
    interacted: false,
    prefillNotes,
  };
}

export async function upsertAuditRoi(params: {
  auditId: number;
  currency: Currency;
  inputs: RoiInputs;
  scenarios: Record<ScenarioKey, RoiScenario>;
  selectedScenario: ScenarioKey;
  interacted: boolean;
}): Promise<{ state: SavedRoiState; firstInteraction: boolean }> {
  const db = getDb();
  const now = new Date().toISOString();
  const inputsWithCurrency: RoiInputs = { ...params.inputs, currency: params.currency };
  const outputs = calculateAllScenarios(inputsWithCurrency, params.scenarios);

  const existing = await findAuditRoiByAuditId(params.auditId);
  const firstInteraction = params.interacted && (!existing || !existing.interacted);

  await db
    .insert(auditRoi)
    .values({
      auditId: params.auditId,
      currency: params.currency,
      inputsJson: JSON.stringify(inputsWithCurrency),
      scenariosJson: JSON.stringify(params.scenarios),
      selectedScenario: params.selectedScenario,
      outputsJson: JSON.stringify(outputs),
      calcVersion,
      interacted: params.interacted,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: auditRoi.auditId,
      set: {
        currency: params.currency,
        inputsJson: JSON.stringify(inputsWithCurrency),
        scenariosJson: JSON.stringify(params.scenarios),
        selectedScenario: params.selectedScenario,
        outputsJson: JSON.stringify(outputs),
        calcVersion,
        interacted: sql`CASE WHEN ${auditRoi.interacted} = 1 OR ${params.interacted ? 1 : 0} = 1 THEN 1 ELSE 0 END`,
        updatedAt: now,
      },
    });

  return {
    firstInteraction,
    state: {
      currency: params.currency,
      inputs: inputsWithCurrency,
      scenarios: params.scenarios,
      selectedScenario: params.selectedScenario,
      outputs,
      calcVersion,
      interacted: params.interacted || Boolean(existing?.interacted),
      updatedAt: now,
    },
  };
}

export async function listAllAuditRoiForAdmin(): Promise<AuditRoiRow[]> {
  const db = getDb();
  return db.select().from(auditRoi).where(eq(auditRoi.interacted, true));
}
