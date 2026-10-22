import definition from '../../content/mandates/outpost-orders.json';
import {
  startMandate, serializeMandateCheckpoint, deserializeMandateCheckpoint,
} from '../../src/dualMandate.mjs';

export const MANDATE_SAVE_KEY = 'shadowops.star-adventures.outpost-orders.v1';
export const MANDATE_DEFINITION = definition;

export function restoreMandateSession(storage: Pick<Storage, 'getItem'> | null) {
  const fresh = () => startMandate(definition);
  if (!storage) return { state: fresh(), notice: 'Progreso temporal' };
  try {
    const raw = storage.getItem(MANDATE_SAVE_KEY);
    if (raw === null) return { state: fresh(), notice: 'Nueva simulación' };
    return { state: deserializeMandateCheckpoint(definition, raw), notice: 'Bitácoras restauradas' };
  } catch {
    // The experimental briefing uses a separate key and must never reset
    // the established Border Signal v2/crew or away-team/spatial checkpoints.
    return { state: fresh(), notice: 'Archivo de órdenes incompatible · reiniciado' };
  }
}

export function persistMandateSession(
  state: ReturnType<typeof startMandate>,
  storage: Pick<Storage, 'setItem'> | null,
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(MANDATE_SAVE_KEY, serializeMandateCheckpoint(definition, state));
    return true;
  } catch { return false; }
}
