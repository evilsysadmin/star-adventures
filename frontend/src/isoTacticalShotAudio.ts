// Original, synthesized tactical-fire feedback. The accepted combat command is
// authoritative; audio never changes hit chances, AP, health, saves or replay.
// Match the mission board's fast tracer arrival exactly.
import { SHOT_DURATION_MS, SHOT_TRAVEL_FRACTION } from './isoFirePlayback.ts';
export const SHOT_IMPACT_DELAY_SECONDS = SHOT_DURATION_MS * SHOT_TRAVEL_FRACTION / 1000;

let context: AudioContext | null = null;

/** Schedule a restrained blaster chirp and a distinct hit, on one audio clock. */
export function scheduleTacticalShot(audio: AudioContext, at = audio.currentTime): void {
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
    envelope.connect(audio.destination);
    oscillator.start(when);
    oscillator.stop(when + seconds + 0.015);
  };
  tone('sawtooth', 820, 260, at, 0.19, 0.024);
  tone('triangle', 180, 65, at + SHOT_IMPACT_DELAY_SECONDS, 0.16, 0.035);
}

/** Invoke synchronously from the user's successful Fire action, not an effect:
 * browsers require a user gesture to unlock audio. Fail closed when unavailable.
 */
export function playAcceptedTacticalShot(): void {
  if (typeof window === 'undefined' || document.hidden || !window.AudioContext) return;
  try {
    if (!context || context.state === 'closed') context = new window.AudioContext();
    if (context.state === 'suspended') void context.resume().catch(() => {});
    scheduleTacticalShot(context);
  } catch {
    // Unsupported or denied audio must never interrupt a valid tactical shot.
  }
}
