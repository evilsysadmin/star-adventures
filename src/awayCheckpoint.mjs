// Browser-friendly snapshot for a private, offline single-player prototype.
// Validated but not anti-cheat or cross-key atomic with crew/spatial storage.
import { startAwayTeam, validateAwayTeam } from './awayTeam.mjs';
export class AwayCheckpointError extends Error {
  constructor(message) { super(message); this.name = 'AwayCheckpointError'; }
}
const fail = msg => { throw new AwayCheckpointError(msg); };
export const MAX_AWAY_BYTES = 2048;

export function serializeAwayTeam(state) {
  try { validateAwayTeam(state); } catch { fail('Invalid away team'); }
  const raw = JSON.stringify({
    saveVersion: 1, squad: state.squad, findings: state.findings,
    attempts: state.attempts, lastReport: state.lastReport,
  });
  if (raw.length > MAX_AWAY_BYTES) fail('Oversized away-team save');
  return raw;
}
export function deserializeAwayTeam(raw) {
  if (typeof raw !== 'string' || raw.length < 2 || raw.length > MAX_AWAY_BYTES)
    fail('Missing or oversized away-team save');
  let saved;
  try { saved = JSON.parse(raw); } catch { fail('Malformed away-team save'); }
  if (!saved || saved.saveVersion !== 1 ||
      Object.keys(saved).sort().join(',') !== 'attempts,findings,lastReport,saveVersion,squad')
    fail('Unsupported away-team save schema');
  const state = { version: 1, squad: saved.squad, findings: saved.findings,
    attempts: saved.attempts, lastReport: saved.lastReport };
  try { validateAwayTeam(state); } catch { fail('Invalid away-team snapshot'); }
  return state;
}
export function recoverAwayTeam(raw) {
  if (raw === null || raw === undefined) return { state: startAwayTeam(), notice: 'fresh' };
  try { return { state: deserializeAwayTeam(raw), notice: 'restored' }; }
  catch { return { state: startAwayTeam(), notice: 'reset-invalid' }; }
}
