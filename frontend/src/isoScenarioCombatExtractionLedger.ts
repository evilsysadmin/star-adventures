// Bounded v2 history for replay-verified tactical extractions.
// This is a separate, opt-in ledger: no campaign rewards, save migration,
// or changes to the existing v1 receipt and v4 replay checkpoint.
import {
  COMBAT_REPLAY_SAVE_KEY, deserializeCombatReplay, serializeCombatReplay,
} from './isoScenarioCombatReplay.ts';
import {
  COMBAT_EXTRACTION_RECEIPT_KEY, COMBAT_EXTRACTION_RECEIPT_VERSION,
} from './isoScenarioCombatExtractionReceipt.ts';
import { combatMissionReport, type CombatMissionReport } from './isoScenarioCombatMissionReport.ts';

export const COMBAT_EXTRACTION_LEDGER_VERSION = 2;
export const COMBAT_EXTRACTION_LEDGER_KEY = 'shadowops.star-adventures.combat-extractions.v2';
export const MAX_EXTRACTION_LEDGER_ENTRIES = 24;
export const MAX_EXTRACTION_LEDGER_BYTES = 256_000;

export type ExtractionLedgerEntry = Readonly<{
  checkpoint: string;
  report: CombatMissionReport;
}>;
export type ExtractionLedgerRead = Readonly<{
  status: 'ready' | 'missing' | 'incompatible' | 'unavailable';
  entries: readonly ExtractionLedgerEntry[];
}>;
export type ExtractionLedgerWrite = Readonly<{
  status: 'recorded' | 'already-recorded' | 'not-extracted' | 'full' | 'incompatible' | 'unavailable';
  report: CombatMissionReport | null;
  count: number;
}>;

function verified(raw: string): ExtractionLedgerEntry | null {
  const history = deserializeCombatReplay(raw);
  const report = combatMissionReport({
    scenarioId: history.scenarioId, actions: history.actions,
  });
  if (report.status !== 'mission-extracted') return null;
  const checkpoint = serializeCombatReplay(history.scenarioId, history.actions);
  if (checkpoint !== raw) throw new TypeError('Noncanonical extraction checkpoint');
  return Object.freeze({ checkpoint, report });
}

function objectWithKeys(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Invalid extraction record');
  }
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== keys.length ||
      !keys.every(key => Object.hasOwn(record, key))) {
    throw new TypeError('Incompatible extraction record');
  }
  return record;
}

function legacyReceipt(raw: string): ExtractionLedgerEntry {
  if (raw.length > MAX_EXTRACTION_LEDGER_BYTES) throw new TypeError('Oversized receipt');
  const record = objectWithKeys(JSON.parse(raw), ['version', 'checkpoint']);
  if (record.version !== COMBAT_EXTRACTION_RECEIPT_VERSION ||
      typeof record.checkpoint !== 'string') {
    throw new TypeError('Incompatible legacy receipt');
  }
  const entry = verified(record.checkpoint);
  if (!entry) throw new TypeError('Unverified legacy extraction');
  return entry;
}

function ledgerEntries(raw: string): readonly ExtractionLedgerEntry[] {
  if (raw.length > MAX_EXTRACTION_LEDGER_BYTES) throw new TypeError('Oversized ledger');
  const record = objectWithKeys(JSON.parse(raw), ['version', 'checkpoints']);
  if (record.version !== COMBAT_EXTRACTION_LEDGER_VERSION ||
      !Array.isArray(record.checkpoints) ||
      record.checkpoints.length > MAX_EXTRACTION_LEDGER_ENTRIES) {
    throw new TypeError('Incompatible extraction ledger');
  }
  const entries: ExtractionLedgerEntry[] = [];
  const seen = new Set<string>();
  for (const checkpoint of record.checkpoints) {
    if (typeof checkpoint !== 'string' || seen.has(checkpoint)) {
      throw new TypeError('Duplicate or invalid extraction');
    }
    const entry = verified(checkpoint);
    if (!entry) throw new TypeError('Unverified extraction');
    seen.add(checkpoint);
    entries.push(entry);
  }
  return entries;
}

const readResult = (status: ExtractionLedgerRead['status'], entries: ExtractionLedgerEntry[] = []):
  ExtractionLedgerRead => Object.freeze({ status, entries: Object.freeze(entries) });
const writeResult = (
  status: ExtractionLedgerWrite['status'], count = 0, report: CombatMissionReport | null = null,
): ExtractionLedgerWrite => Object.freeze({ status, count, report });

/**
 * Read the v2 ledger and any valid v1 receipt as one deduplicated history.
 * Legacy storage is never modified, including when the v2 ledger is absent.
 * Corrupt/future records fail closed rather than disappearing from the UI.
 */
export function readCombatExtractionLedger(
  storage: Pick<Storage, 'getItem'> | null,
): ExtractionLedgerRead {
  if (!storage) return readResult('unavailable');
  let oldRaw: string | null;
  let ledgerRaw: string | null;
  try {
    oldRaw = storage.getItem(COMBAT_EXTRACTION_RECEIPT_KEY);
    ledgerRaw = storage.getItem(COMBAT_EXTRACTION_LEDGER_KEY);
  } catch {
    return readResult('unavailable');
  }
  try {
    const entries = ledgerRaw === null ? [] : [...ledgerEntries(ledgerRaw)];
    if (oldRaw !== null) {
      const legacy = legacyReceipt(oldRaw);
      if (!entries.some(entry => entry.checkpoint === legacy.checkpoint)) {
        entries.unshift(legacy);
      }
    }
    if (entries.length > MAX_EXTRACTION_LEDGER_ENTRIES) return readResult('incompatible');
    return readResult(oldRaw === null && ledgerRaw === null ? 'missing' : 'ready', entries);
  } catch {
    return readResult('incompatible');
  }
}

/**
 * Append one distinct, replay-verified extraction to the bounded v2 ledger.
 * Repeated calls/F5 are no-ops; identical command histories represent the
 * same evidence, not a new mission instance. A later campaign contract must
 * introduce stable mission-instance IDs before crediting repeated identical runs.
 */
export function recordCombatExtractionInLedger(
  storage: Pick<Storage, 'getItem' | 'setItem'> | null,
): ExtractionLedgerWrite {
  if (!storage) return writeResult('unavailable');
  const history = readCombatExtractionLedger(storage);
  if (history.status === 'unavailable' || history.status === 'incompatible') {
    return writeResult(history.status);
  }
  let raw: string | null;
  try { raw = storage.getItem(COMBAT_REPLAY_SAVE_KEY); }
  catch { return writeResult('unavailable', history.entries.length); }
  if (raw === null) return writeResult('not-extracted', history.entries.length);
  let entry: ExtractionLedgerEntry | null;
  try { entry = verified(raw); }
  catch { return writeResult('incompatible', history.entries.length); }
  if (!entry) return writeResult('not-extracted', history.entries.length);
  if (history.entries.some(previous => previous.checkpoint === entry.checkpoint)) {
    return writeResult('already-recorded', history.entries.length, entry.report);
  }
  if (history.entries.length >= MAX_EXTRACTION_LEDGER_ENTRIES) {
    return writeResult('full', history.entries.length, entry.report);
  }
  const payload = JSON.stringify({
    version: COMBAT_EXTRACTION_LEDGER_VERSION,
    checkpoints: [...history.entries.map(previous => previous.checkpoint), entry.checkpoint],
  });
  if (payload.length > MAX_EXTRACTION_LEDGER_BYTES) {
    return writeResult('full', history.entries.length, entry.report);
  }
  try {
    storage.setItem(COMBAT_EXTRACTION_LEDGER_KEY, payload);
    // Storage can silently discard writes. Do not report durable success then.
    if (storage.getItem(COMBAT_EXTRACTION_LEDGER_KEY) !== payload) {
      return writeResult('unavailable', history.entries.length);
    }
  } catch {
    return writeResult('unavailable', history.entries.length);
  }
  return writeResult('recorded', history.entries.length + 1, entry.report);
}
