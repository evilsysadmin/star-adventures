// Original, synthesized tactical-fire feedback. The accepted combat command is
// authoritative; audio never changes hit chances, AP, health, saves or replay.
// Match the mission board's fast tracer arrival exactly.
import { SHOT_DURATION_MS, SHOT_TRAVEL_FRACTION } from './isoFirePlayback.ts';
import { readGamePreferences } from './gamePreferences';
export const SHOT_IMPACT_DELAY_SECONDS = SHOT_DURATION_MS * SHOT_TRAVEL_FRACTION / 1000;

let context: AudioContext | null = null;
let master: GainNode | null = null;
let livePreferences: { volume: number; muted: boolean } | null = null;

export function updateTacticalAudio(volume: number, muted: boolean): void {
  livePreferences = { volume, muted };
  if (context && master) master.gain.setValueAtTime(muted ? 0 : volume, context.currentTime);
}

/** Schedule a restrained blaster chirp and a distinct hit, on one audio clock. */
export function scheduleTacticalShot(audio: AudioContext, at = audio.currentTime, destination: AudioNode = audio.destination): void {
  if (!Number.isFinite(at) || at < 0) return;
  const tone = (
    type: OscillatorType, startHz: number, endHz: number,
    when: number, seconds: number, volume: number,
  ) => {
    const oscillator = audio.createOscillator();
    const envelope = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startHz, when);
    oscillator.frequency.exponentialRampToValueAtTime(endHz, when + seconds);
    envelope.gain.setValueAtTime(0.0001, when);
    envelope.gain.exponentialRampToValueAtTime(volume, when + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, when + seconds);
    oscillator.connect(envelope);
    envelope.connect(destination);
    oscillator.start(when);
    oscillator.stop(when + seconds + 0.015);
  };
  tone('sawtooth', 820, 260, at, 0.19, 0.024);
  tone('triangle', 180, 65, at + SHOT_IMPACT_DELAY_SECONDS, 0.16, 0.035);
}

/** Invoke synchronously from the user's successful Fire action, not an effect:
 * browsers require a user gesture to unlock audio. Fail closed when unavailable.
 */
export function playAcceptedTacticalShot(): boolean {
  if (typeof window === 'undefined' || document.hidden || !window.AudioContext) return false;
  try {
    let storage: Storage | null = null;
    try { storage = window.localStorage; } catch { /* Session-only options remain usable. */ }
    const preferences = livePreferences ?? readGamePreferences(storage);
    if (preferences.muted || preferences.volume === 0) return false;
    if (!context || context.state === 'closed') {
      context = new window.AudioContext(); master = context.createGain(); master.connect(context.destination);
    }
    updateTacticalAudio(preferences.volume, preferences.muted);
    if (context.state === 'suspended') void context.resume().catch(() => {});
    scheduleTacticalShot(context, context.currentTime, master!);
    return true;
  } catch {
    // Unsupported or denied audio must never interrupt a valid tactical shot.
    return false;
  }
}
