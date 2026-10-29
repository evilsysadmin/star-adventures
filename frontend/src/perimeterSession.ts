// The physical outpost encounter owns a separate, replay-validated slot.
// Laboratory victories, extraction ledgers and their saves are never consulted.
import {
  deserializeCombatReplay, serializeCombatReplay, replayCombatCommands,
  type CombatReplayHistory,
} from './isoScenarioCombatReplay.ts';
import { MAX_SCENARIO_CHECKPOINT_BYTES } from './isoScenarioCheckpoint.ts';
import { MAX_CREW_ACTIONS } from '../../src/crewSession.mjs';
import { validateExploration, faceTile } from '../../src/spatial.mjs';

export const PERIMETER_SAVE_KEY = 'shadowops.star-adventures.physical-perimeter.v1';
export const PERIMETER_SAVE_VERSION = 1;
const MAX_BYTES = MAX_SCENARIO_CHECKPOINT_BYTES + 256;
type Reader = Pick<Storage, 'getItem'>;
type Writer = Pick<Storage, 'getItem' | 'setItem'>;
export type PerimeterSession = {
  history: CombatReplayHistory;
  active: boolean;
  notice: string;
  status: 'ready' | 'missing' | 'different-run' | 'incompatible' | 'unavailable';
};
const validRun = (run: number) => Number.isSafeInteger(run) && run >= 0 && run <= MAX_CREW_ACTIONS;
export const newPerimeterHistory = () => replayCombatCommands('evacuation', []);
export function perimeterResolution(history: CombatReplayHistory): 'truce' | 'victory' | null {
  // Reconstruct, even if the caller supplied forged derived outcome flags.
  if (history.scenarioId !== 'evacuation') throw new TypeError('Not the outpost perimeter');
  const { combat } = replayCombatCommands('evacuation', history.actions);
  return combat.truce ? 'truce' : combat.victory ? 'victory' : null;
}

/** A restored panel may only reopen at the actual, faced perimeter station. */
export function atPerimeterStation(
  world: Parameters<typeof validateExploration>[0],
  position: Parameters<typeof validateExploration>[1],
): boolean {
  try {
    validateExploration(world, position);
    if (position.area !== 'surface' || position.pending !== null) return false;
    const ahead = faceTile(position);
    return world.scenes.surface.objects.some((item: { type: string; action?: string; x: number; y: number }) =>
      item.type === 'station' && item.action === 'secure-perimeter' &&
      item.x === ahead.x && item.y === ahead.y);
  } catch { return false; }
}

export function restorePerimeterSession(storage: Reader | null, rescueRun: number): PerimeterSession {
  const blank = (status: PerimeterSession['status'], notice: string): PerimeterSession =>
    ({ history: newPerimeterHistory(), active: false, status, notice });
  if (!validRun(rescueRun)) throw new TypeError('Invalid rescue run');
  if (!storage) return blank('unavailable', 'Perímetro temporal · almacenamiento no disponible');
  let raw: string | null;
  try { raw = storage.getItem(PERIMETER_SAVE_KEY); }
  catch { return blank('unavailable', 'Perímetro temporal · almacenamiento no disponible'); }
  try {
    if (raw === null) return blank('missing', 'Perímetro nuevo · sin órdenes guardadas');
    if (raw.length > MAX_BYTES) throw new TypeError('Oversized perimeter checkpoint');
    const record = JSON.parse(raw);
    if (!record || typeof record !== 'object' || Array.isArray(record) ||
        Object.keys(record).length !== 4 ||
        !['version', 'rescueRun', 'active', 'combat'].every(key => Object.hasOwn(record, key)) ||
        record.version !== PERIMETER_SAVE_VERSION || !validRun(record.rescueRun) ||
        typeof record.active !== 'boolean') throw new TypeError('Invalid perimeter checkpoint');
    const history = deserializeCombatReplay(JSON.stringify(record.combat));
    if (history.scenarioId !== 'evacuation') throw new TypeError('Wrong physical encounter');
    if (record.rescueRun !== rescueRun) return blank('different-run', 'Perímetro nuevo · otro intento de rescate');
    return { history, active: record.active, status: 'ready', notice: 'Perímetro restaurado' };
  } catch { return blank('incompatible', 'Guardado del perímetro incompatible · progreso temporal'); }
}

/** Only commands and presentation visibility are written, never health/outcomes. */
export function persistPerimeterSession(
  history: CombatReplayHistory, rescueRun: number, active: boolean, storage: Writer | null,
): boolean {
  if (!storage || !validRun(rescueRun) || typeof active !== 'boolean' || history.scenarioId !== 'evacuation') return false;
  try {
    const combat = JSON.parse(serializeCombatReplay('evacuation', history.actions));
    const raw = JSON.stringify({ version: PERIMETER_SAVE_VERSION, rescueRun, active, combat });
    if (raw.length > MAX_BYTES) return false;
    storage.setItem(PERIMETER_SAVE_KEY, raw);
    return storage.getItem(PERIMETER_SAVE_KEY) === raw;
  } catch { return false; }
}
