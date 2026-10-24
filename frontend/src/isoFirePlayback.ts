// Pure display-only timing for the six-frame ORIGINAL R2 fire cycles.
// No hit, damage, ammunition or combat-result authority lives here.
import { FIRE_ATLAS } from './tacticalAnimation.ts';

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
