// Read-only bridge-facing view of the opt-in v4 away-team checkpoint.
// No campaign mutations, reward grants, migrations or additional save keys.
// A successful firefight alone is never a completed mission.
import {
  COMBAT_REPLAY_SAVE_KEY, deserializeCombatReplay,
} from './isoScenarioCombatReplay.ts';
import {
  combatMissionReport, type CombatMissionReport, type CombatMissionStatus,
} from './isoScenarioCombatMissionReport.ts';

export type BridgeCombatDebrief = Readonly<{
  source: 'combat-v4-sandbox';
  status: CombatMissionStatus | 'missing' | 'unavailable' | 'incompatible';
  report: CombatMissionReport | null;
  campaignApplied: false;
}>;

function empty(status: 'missing' | 'unavailable' | 'incompatible'): BridgeCombatDebrief {
  return Object.freeze({
    source: 'combat-v4-sandbox', status, report: null, campaignApplied: false,
  });
}

/**
 * Read a validated away-team debrief from the existing v4 checkpoint.
 * The bridge may display this report, but must not interpret it as campaign
 * progress: an explicit, versioned campaign handoff is a separate operation.
 * Never delete, rewrite or migrate an unreadable/future checkpoint.
 */
export function readCombatBridgeDebrief(
  storage: Pick<Storage, 'getItem'> | null,
): BridgeCombatDebrief {
  if (!storage) return empty('unavailable');
  let raw: string | null;
  try { raw = storage.getItem(COMBAT_REPLAY_SAVE_KEY); }
  catch { return empty('unavailable'); }
  if (raw === null) return empty('missing');
  try {
    const history = deserializeCombatReplay(raw);
    // Reconstruct from commands rather than trusting client-provided status,
    // health, objective flags or a caller-supplied report.
    const report = combatMissionReport({
      scenarioId: history.scenarioId, actions: history.actions,
    });
    return Object.freeze({
      source: 'combat-v4-sandbox', status: report.status, report, campaignApplied: false,
    });
  } catch {
    return empty('incompatible');
  }
}
