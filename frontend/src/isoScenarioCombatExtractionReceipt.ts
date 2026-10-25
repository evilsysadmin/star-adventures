// A versioned, single-extraction receipt for the opt-in tactical sandbox.
// This is an auditable handoff boundary, NOT a reward or legacy campaign update.
// The original v4 checkpoint and older saves are never rewritten.
import {
  COMBAT_REPLAY_SAVE_KEY, deserializeCombatReplay, serializeCombatReplay,
} from './isoScenarioCombatReplay.ts';
import { combatMissionReport, type CombatMissionReport } from './isoScenarioCombatMissionReport.ts';

export const COMBAT_EXTRACTION_RECEIPT_VERSION = 1;
export const COMBAT_EXTRACTION_RECEIPT_KEY = 'shadowops.star-adventures.combat-extraction.v1';

export type ExtractionReceiptStatus =
  | 'recorded' | 'already-recorded' | 'not-extracted'
  | 'occupied' | 'incompatible' | 'unavailable';
export type ExtractionReceiptResult = Readonly<{
  status: ExtractionReceiptStatus;
  report: CombatMissionReport | null;
}>;

type Receipt = Readonly<{ version: 1; checkpoint: string }>;

function validatedExtraction(raw: string): { checkpoint: string; report: CombatMissionReport } | null {
  const history = deserializeCombatReplay(raw);
  const report = combatMissionReport({
    scenarioId: history.scenarioId, actions: history.actions,
  });
  if (report.status !== 'mission-extracted') return null;
  return { checkpoint: serializeCombatReplay(history.scenarioId, history.actions), report };
}

function readReceipt(raw: string): Receipt {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Invalid extraction receipt');
  }
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== 2 ||
      record.version !== COMBAT_EXTRACTION_RECEIPT_VERSION ||
      typeof record.checkpoint !== 'string') {
    throw new TypeError('Incompatible extraction receipt');
  }
  const extracted = validatedExtraction(record.checkpoint);
  if (!extracted || extracted.checkpoint !== record.checkpoint) {
    throw new TypeError('Unverifiable extraction receipt');
  }
  return { version: 1, checkpoint: extracted.checkpoint };
}

const result = (status: ExtractionReceiptStatus, report: CombatMissionReport | null = null):
  ExtractionReceiptResult => Object.freeze({ status, report });

/**
 * Explicitly record one verified extraction, without granting campaign XP or
 * modifying v1-v4 tactical checkpoints. A repeated call after F5 is a no-op.
 * A different extraction cannot silently overwrite the prior receipt: the
 * future campaign ledger must define how to handle multiple missions.
 */
export function recordCombatExtraction(
  storage: Pick<Storage, 'getItem' | 'setItem'> | null,
): ExtractionReceiptResult {
  if (!storage) return result('unavailable');
  let checkpointRaw: string | null;
  let receiptRaw: string | null;
  try {
    checkpointRaw = storage.getItem(COMBAT_REPLAY_SAVE_KEY);
    receiptRaw = storage.getItem(COMBAT_EXTRACTION_RECEIPT_KEY);
  } catch {
    return result('unavailable');
  }
  if (receiptRaw !== null) {
    try { readReceipt(receiptRaw); }
    catch { return result('incompatible'); }
  }
  if (checkpointRaw === null) return result('not-extracted');
  let extracted: ReturnType<typeof validatedExtraction>;
  try { extracted = validatedExtraction(checkpointRaw); }
  catch { return result('incompatible'); }
  if (!extracted) return result('not-extracted');
  if (receiptRaw !== null) {
    const previous = readReceipt(receiptRaw);
    return result(previous.checkpoint === extracted.checkpoint
      ? 'already-recorded' : 'occupied', extracted.report);
  }
  const payload = JSON.stringify({
    version: COMBAT_EXTRACTION_RECEIPT_VERSION,
    checkpoint: extracted.checkpoint,
  });
  try {
    storage.setItem(COMBAT_EXTRACTION_RECEIPT_KEY, payload);
    // Some storage shims silently drop writes. Never report durable success
    // unless the exact receipt can be read back.
    if (storage.getItem(COMBAT_EXTRACTION_RECEIPT_KEY) !== payload) {
      return result('unavailable');
    }
  } catch {
    return result('unavailable');
  }
  return result('recorded', extracted.report);
}
