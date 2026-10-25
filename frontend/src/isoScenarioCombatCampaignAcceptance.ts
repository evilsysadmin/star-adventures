// Explicit campaign handoff evidence for replay-verified tactical extractions.
// This records accepted mission events only. It does not award XP, heal/injure
// crew in the campaign, mutate older saves or confer server-side authority.
import {
  COMBAT_EXTRACTION_ATTEMPT_LEDGER_KEY,
  readCombatExtractionAttemptLedger,
  type ExtractionAttemptEntry,
} from './isoScenarioCombatExtractionAttemptLedger.ts';

export const COMBAT_CAMPAIGN_ACCEPTANCE_KEY =
  'shadowops.star-adventures.combat-campaign-acceptances.v1';
export const COMBAT_CAMPAIGN_ACCEPTANCE_VERSION = 1;
export const MAX_COMBAT_CAMPAIGN_ACCEPTANCES = 24;
export const MAX_COMBAT_CAMPAIGN_ACCEPTANCE_BYTES = 256_000;

export type CampaignAcceptanceEntry = Readonly<{
  instanceId: string;
  checkpoint: string;
  report: ExtractionAttemptEntry['report'];
}>;
export type CampaignAcceptanceRead = Readonly<{
  status: 'ready' | 'missing' | 'incompatible' | 'unavailable';
  entries: readonly CampaignAcceptanceEntry[];
}>;
export type CampaignAcceptanceWrite = Readonly<{
  status: 'accepted' | 'already-accepted' | 'not-recorded' |
    'conflict' | 'full' | 'incompatible' | 'unavailable';
  count: number;
}>;

type StorageReader = Pick<Storage, 'getItem'>;
type StorageWriter = Pick<Storage, 'getItem' | 'setItem'>;
type Snapshot = Readonly<{
  sourceRaw: string | null;
  acceptanceRaw: string | null;
  result: CampaignAcceptanceRead;
  source: readonly ExtractionAttemptEntry[];
}>;

const readResult = (
  status: CampaignAcceptanceRead['status'],
  entries: CampaignAcceptanceEntry[] = [],
): CampaignAcceptanceRead => Object.freeze({
  status, entries: Object.freeze(entries),
});
const writeResult = (
  status: CampaignAcceptanceWrite['status'], count = 0,
): CampaignAcceptanceWrite => Object.freeze({ status, count });

function exactRecord(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Invalid campaign acceptance');
  }
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== keys.length ||
      !keys.every(key => Object.hasOwn(record, key))) {
    throw new TypeError('Incompatible campaign acceptance');
  }
  return record;
}

function parseAcceptances(
  raw: string, source: readonly ExtractionAttemptEntry[],
): CampaignAcceptanceEntry[] {
  if (raw.length > MAX_COMBAT_CAMPAIGN_ACCEPTANCE_BYTES) {
    throw new TypeError('Oversized campaign acceptance ledger');
  }
  const record = exactRecord(JSON.parse(raw), ['version', 'accepted']);
  if (record.version !== COMBAT_CAMPAIGN_ACCEPTANCE_VERSION ||
      !Array.isArray(record.accepted) ||
      record.accepted.length > MAX_COMBAT_CAMPAIGN_ACCEPTANCES) {
    throw new TypeError('Incompatible campaign acceptance ledger');
  }
  const known = new Map(source.map(entry => [entry.instanceId, entry]));
  const seen = new Set<string>();
  return record.accepted.map(value => {
    const item = exactRecord(value, ['instanceId', 'checkpoint']);
    if (typeof item.instanceId !== 'string' ||
        typeof item.checkpoint !== 'string' ||
        seen.has(item.instanceId)) {
      throw new TypeError('Duplicate or invalid campaign acceptance');
    }
    const evidence = known.get(item.instanceId);
    // An accepted event must still refer to the exact original v3 evidence.
    // A rewritten or missing source entry must not silently change outcomes.
    if (!evidence || evidence.checkpoint !== item.checkpoint) {
      throw new TypeError('Campaign acceptance evidence mismatch');
    }
    seen.add(item.instanceId);
    return Object.freeze({
      instanceId: evidence.instanceId,
      checkpoint: evidence.checkpoint,
      report: evidence.report,
    });
  });
}

function snapshot(storage: StorageReader | null): Snapshot {
  if (!storage) {
    return { sourceRaw: null, acceptanceRaw: null,
      result: readResult('unavailable'), source: [] };
  }
  let sourceRaw: string | null;
  let acceptanceRaw: string | null;
  try {
    sourceRaw = storage.getItem(COMBAT_EXTRACTION_ATTEMPT_LEDGER_KEY);
    acceptanceRaw = storage.getItem(COMBAT_CAMPAIGN_ACCEPTANCE_KEY);
  } catch {
    return { sourceRaw: null, acceptanceRaw: null,
      result: readResult('unavailable'), source: [] };
  }
  // The v3 reader replays every command; never trust stored outcome flags.
  // Pin it to the same bytes used by the write conflict check.
  const sourceRead = readCombatExtractionAttemptLedger({
    getItem: key => key === COMBAT_EXTRACTION_ATTEMPT_LEDGER_KEY ? sourceRaw : null,
  });
  const source = sourceRead.entries;
  if (sourceRead.status === 'incompatible' || sourceRead.status === 'unavailable') {
    return { sourceRaw, acceptanceRaw, result: readResult('incompatible'), source };
  }
  if (acceptanceRaw === null) {
    return { sourceRaw, acceptanceRaw, result: readResult('missing'), source };
  }
  if (sourceRead.status !== 'ready') {
    return { sourceRaw, acceptanceRaw, result: readResult('incompatible'), source };
  }
  try {
    return { sourceRaw, acceptanceRaw,
      result: readResult('ready', parseAcceptances(acceptanceRaw, source)), source };
  } catch {
    return { sourceRaw, acceptanceRaw, result: readResult('incompatible'), source };
  }
}

/** Read accepted events without mutating any campaign or tactical save. */
export function readCombatCampaignAcceptances(
  storage: StorageReader | null,
): CampaignAcceptanceRead {
  return snapshot(storage).result;
}

/**
 * Explicitly accept one already-recorded, replay-verified extraction as a
 * campaign event. Does not accept a mere tactical victory, nor an unregistered
 * attempt. This is a local, non-atomic compare-before-write contract; future
 * authoritative rewards must be handled by a server if multiplayer is added.
 */
export function acceptCombatCampaignMission(
  storage: StorageWriter | null, instanceId: string,
): CampaignAcceptanceWrite {
  const before = snapshot(storage);
  if (before.result.status === 'unavailable') return writeResult('unavailable');
  if (before.result.status === 'incompatible') return writeResult('incompatible');
  const count = before.result.entries.length;
  const evidence = before.source.find(entry => entry.instanceId === instanceId);
  if (!evidence) return writeResult('not-recorded', count);
  const previous = before.result.entries.find(entry => entry.instanceId === instanceId);
  if (previous) return writeResult(previous.checkpoint === evidence.checkpoint
    ? 'already-accepted' : 'conflict', count);
  if (count >= MAX_COMBAT_CAMPAIGN_ACCEPTANCES) return writeResult('full', count);
  const accepted = [...before.result.entries, evidence].map(({ instanceId: id, checkpoint }) =>
    ({ instanceId: id, checkpoint }));
  const payload = JSON.stringify({ version: COMBAT_CAMPAIGN_ACCEPTANCE_VERSION, accepted });
  if (payload.length > MAX_COMBAT_CAMPAIGN_ACCEPTANCE_BYTES) {
    return writeResult('full', count);
  }
  try {
    // Check both source evidence and the acceptance ledger before writing.
    if (storage!.getItem(COMBAT_EXTRACTION_ATTEMPT_LEDGER_KEY) !== before.sourceRaw ||
        storage!.getItem(COMBAT_CAMPAIGN_ACCEPTANCE_KEY) !== before.acceptanceRaw) {
      return writeResult('conflict', count);
    }
    storage!.setItem(COMBAT_CAMPAIGN_ACCEPTANCE_KEY, payload);
    if (storage!.getItem(COMBAT_CAMPAIGN_ACCEPTANCE_KEY) !== payload) {
      return writeResult('unavailable', count);
    }
  } catch {
    return writeResult('unavailable', count);
  }
  return writeResult('accepted', count + 1);
}
