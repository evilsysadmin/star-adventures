// Opt-in, identity-aware extraction evidence for the experimental v4 combat.
// Independent of the legacy v1 receipt, v2 checkpoint ledger and campaign.
// IDs distinguish separate attempts with identical orders; no XP is granted.
// Browser storage is not a trusted multiplayer/anti-cheat authority.
import {
  COMBAT_REPLAY_SAVE_KEY, deserializeCombatReplay, serializeCombatReplay,
} from './isoScenarioCombatReplay.ts';
import {
  COMBAT_MISSION_INSTANCE_SAVE_KEY,
} from './isoScenarioCombatMissionInstanceSession.ts';
import {
  createCombatMissionInstance, deserializeCombatMissionInstance,
} from './isoScenarioCombatMissionInstance.ts';
import { combatMissionReport, type CombatMissionReport } from './isoScenarioCombatMissionReport.ts';

export const COMBAT_EXTRACTION_ATTEMPT_LEDGER_VERSION = 3;
export const COMBAT_EXTRACTION_ATTEMPT_LEDGER_KEY =
  'shadowops.star-adventures.combat-extraction-attempts.v3';
export const MAX_EXTRACTION_ATTEMPT_ENTRIES = 24;
export const MAX_EXTRACTION_ATTEMPT_LEDGER_BYTES = 256_000;

export type ExtractionAttemptEntry = Readonly<{
  instanceId: string;
  checkpoint: string;
  report: CombatMissionReport;
}>;
export type ExtractionAttemptRead = Readonly<{
  status: 'ready' | 'missing' | 'incompatible' | 'unavailable';
  entries: readonly ExtractionAttemptEntry[];
}>;
export type ExtractionAttemptWrite = Readonly<{
  status: 'recorded' | 'already-recorded' | 'not-extracted' | 'untracked' |
    'out-of-sync' | 'conflict' | 'full' | 'incompatible' | 'unavailable';
  count: number;
}>;

function exactObject(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Invalid extraction attempt record');
  }
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== keys.length ||
      !keys.every(key => Object.hasOwn(record, key))) {
    throw new TypeError('Incompatible extraction attempt record');
  }
  return record;
}

function verifiedEntry(instanceId: string, checkpoint: string): ExtractionAttemptEntry {
  const history = deserializeCombatReplay(checkpoint);
  if (serializeCombatReplay(history.scenarioId, history.actions) !== checkpoint) {
    throw new TypeError('Noncanonical extraction attempt');
  }
  // Validates the UUID and reconstructs outcomes from commands, not flags.
  const attempt = createCombatMissionInstance(instanceId, history);
  const report = combatMissionReport(attempt.history);
  if (report.status !== 'mission-extracted') {
    throw new TypeError('Attempt did not complete extraction');
  }
  return Object.freeze({ instanceId: attempt.instanceId, checkpoint, report });
}

function parseEntries(raw: string): ExtractionAttemptEntry[] {
  if (raw.length > MAX_EXTRACTION_ATTEMPT_LEDGER_BYTES) {
    throw new TypeError('Oversized extraction attempt ledger');
  }
  const record = exactObject(JSON.parse(raw), ['version', 'attempts']);
  if (record.version !== COMBAT_EXTRACTION_ATTEMPT_LEDGER_VERSION ||
      !Array.isArray(record.attempts) ||
      record.attempts.length > MAX_EXTRACTION_ATTEMPT_ENTRIES) {
    throw new TypeError('Incompatible extraction attempt ledger');
  }
  const seen = new Set<string>();
  return record.attempts.map(value => {
    const item = exactObject(value, ['instanceId', 'checkpoint']);
    if (typeof item.instanceId !== 'string' ||
        typeof item.checkpoint !== 'string' ||
        seen.has(item.instanceId)) {
      throw new TypeError('Duplicate or invalid attempt identity');
    }
    const entry = verifiedEntry(item.instanceId, item.checkpoint);
    seen.add(entry.instanceId);
    return entry;
  });
}

const readResult = (
  status: ExtractionAttemptRead['status'], entries: ExtractionAttemptEntry[] = [],
): ExtractionAttemptRead => Object.freeze({ status, entries: Object.freeze(entries) });
const writeResult = (
  status: ExtractionAttemptWrite['status'], count = 0,
): ExtractionAttemptWrite => Object.freeze({ status, count });

/** Read only the opt-in v3 ledger; never silently migrate older evidence. */
export function readCombatExtractionAttemptLedger(
  storage: Pick<Storage, 'getItem'> | null,
): ExtractionAttemptRead {
  if (!storage) return readResult('unavailable');
  let raw: string | null;
  try { raw = storage.getItem(COMBAT_EXTRACTION_ATTEMPT_LEDGER_KEY); }
  catch { return readResult('unavailable'); }
  if (raw === null) return readResult('missing');
  try { return readResult('ready', parseEntries(raw)); }
  catch { return readResult('incompatible'); }
}

/**
 * Record one extracted attempt only when the durable v4 replay and the
 * independently saved identity contain the exact same canonical commands.
 * Repeating an ID with different evidence is a conflict; distinct IDs may
 * share identical orders. No existing save keys or campaign state are changed.
 */
export function recordCombatExtractionAttempt(
  storage: Pick<Storage, 'getItem' | 'setItem'> | null,
): ExtractionAttemptWrite {
  if (!storage) return writeResult('unavailable');
  const ledger = readCombatExtractionAttemptLedger(storage);
  if (ledger.status === 'incompatible' || ledger.status === 'unavailable') {
    return writeResult(ledger.status);
  }
  let replayRaw: string | null;
  let identityRaw: string | null;
  let ledgerRaw: string | null;
  try {
    replayRaw = storage.getItem(COMBAT_REPLAY_SAVE_KEY);
    identityRaw = storage.getItem(COMBAT_MISSION_INSTANCE_SAVE_KEY);
    ledgerRaw = storage.getItem(COMBAT_EXTRACTION_ATTEMPT_LEDGER_KEY);
  } catch { return writeResult('unavailable', ledger.entries.length); }
  if (replayRaw === null) return writeResult('not-extracted', ledger.entries.length);
  let entry: ExtractionAttemptEntry;
  try {
    const history = deserializeCombatReplay(replayRaw);
    if (serializeCombatReplay(history.scenarioId, history.actions) !== replayRaw) {
      return writeResult('incompatible', ledger.entries.length);
    }
    if (combatMissionReport(history).status !== 'mission-extracted') {
      return writeResult('not-extracted', ledger.entries.length);
    }
    if (identityRaw === null) return writeResult('untracked', ledger.entries.length);
    const attempt = deserializeCombatMissionInstance(identityRaw);
    if (serializeCombatReplay(attempt.history.scenarioId, attempt.history.actions) !== replayRaw) {
      return writeResult('out-of-sync', ledger.entries.length);
    }
    entry = verifiedEntry(attempt.instanceId, replayRaw);
  } catch { return writeResult('incompatible', ledger.entries.length); }
  const previous = ledger.entries.find(item => item.instanceId === entry.instanceId);
  if (previous) {
    return writeResult(previous.checkpoint === entry.checkpoint
      ? 'already-recorded' : 'conflict', ledger.entries.length);
  }
  if (ledger.entries.length >= MAX_EXTRACTION_ATTEMPT_ENTRIES) {
    return writeResult('full', ledger.entries.length);
  }
  const payload = JSON.stringify({
    version: COMBAT_EXTRACTION_ATTEMPT_LEDGER_VERSION,
    attempts: [...ledger.entries, entry].map(({ instanceId, checkpoint }) =>
      ({ instanceId, checkpoint })),
  });
  if (payload.length > MAX_EXTRACTION_ATTEMPT_LEDGER_BYTES) {
    return writeResult('full', ledger.entries.length);
  }
  try {
    // Detect changed evidence before the write; localStorage is not an
    // atomic compare-and-swap, so server-owned rewards still need authority.
    if (storage.getItem(COMBAT_REPLAY_SAVE_KEY) !== replayRaw ||
        storage.getItem(COMBAT_MISSION_INSTANCE_SAVE_KEY) !== identityRaw) {
      return writeResult('out-of-sync', ledger.entries.length);
    }
    if (storage.getItem(COMBAT_EXTRACTION_ATTEMPT_LEDGER_KEY) !== ledgerRaw) {
      return writeResult('conflict', ledger.entries.length);
    }
    storage.setItem(COMBAT_EXTRACTION_ATTEMPT_LEDGER_KEY, payload);
    if (storage.getItem(COMBAT_EXTRACTION_ATTEMPT_LEDGER_KEY) !== payload) {
      return writeResult('unavailable', ledger.entries.length);
    }
  } catch { return writeResult('unavailable', ledger.entries.length); }
  return writeResult('recorded', ledger.entries.length + 1);
}
