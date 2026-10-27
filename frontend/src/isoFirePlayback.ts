// Pure display-only timing for the six-frame ORIGINAL R2 fire cycles.
// No hit, damage, ammunition or combat-result authority lives here.
import { FIRE_ATLAS } from './tacticalAnimation.ts';

// Fast visible tracer: impact at 240 ms, then retain the full 960 ms
// readable recoil/fade. Shared with Web Audio to avoid timing drift.
export const SHOT_DURATION_MS = 1200;
export const SHOT_TRAVEL_FRACTION = 0.2;

export function isoFireFrame(elapsedMs: number, animate = true): number | null {
  if (!Number.isFinite(elapsedMs)) return null;
  if (elapsedMs < 0) return 0;
  if (elapsedMs >= FIRE_ATLAS.frames * 1000 / FIRE_ATLAS.fps) return null;
  return animate ? Math.min(FIRE_ATLAS.frames - 1,
    Math.floor(elapsedMs * FIRE_ATLAS.fps / 1000)) : 0;
}

/** One authored frame per deliberate user action; null means return to idle.
 * Invalid/out-of-sequence steps cannot silently wrap to frame zero.
 */
export function nextFireReviewFrame(frame: number): number | null {
  if (!Number.isInteger(frame) || frame < 0 || frame >= FIRE_ATLAS.frames)
    throw new RangeError('Invalid fire review frame');
  return frame === FIRE_ATLAS.frames - 1 ? null : frame + 1;
}


/**
 * Presentation-only response to a confirmed shot. The combat reducer owns
 * damage and death; this timeline merely keeps a defeated target visible
 * until the projectile actually reaches it, then flashes/recoils/fades it.
 */
export function isoHitReactionAt(
  elapsedMs: number, durationMs: number, travelFraction: number, lethal: boolean,
): Readonly<{ phase: 'travel' | 'impact' | 'done'; flash: number; opacity: number; recoil: number }> {
  const done = { phase: 'done' as const, flash: 0, opacity: 1, recoil: 0 };
  if (![elapsedMs, durationMs, travelFraction].every(Number.isFinite) ||
      durationMs <= 0 || travelFraction <= 0 || travelFraction >= 1) return done;
  const impactStart = durationMs * travelFraction;
  if (elapsedMs < impactStart)
    return { phase: 'travel', flash: 0, opacity: 1, recoil: 0 };
  if (elapsedMs >= durationMs) return done;
  const progress = (elapsedMs - impactStart) / (durationMs - impactStart);
  return {
    phase: 'impact',
    flash: 1 - progress,
    opacity: lethal ? 1 - progress : 1,
    recoil: 0.16 * Math.sin(Math.PI * progress),
  };
}
