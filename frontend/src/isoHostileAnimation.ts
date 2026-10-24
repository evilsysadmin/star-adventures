// Presentation-only hostile sprite sampling. The pure combat/replay state stays
// authoritative; animation never writes back positions or changes turn order.
import { WALK_ATLAS } from './tacticalAnimation.ts';

// One six-frame walk cycle per one-cell hostile step.
export const HOSTILE_STEP_MS = 720;
export const HOSTILE_IDLE_FRAME_MS = 240;

export function hostileStepAt(elapsedMs: number): Readonly<{
  progress: number; frame: number; done: boolean;
}> {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    return { progress: 0, frame: 0, done: false };
  }
  const progress = Math.min(1, elapsedMs / HOSTILE_STEP_MS);
  const frame = progress === 1 ? 0 : Math.min(WALK_ATLAS.frames - 1, Math.floor(progress * WALK_ATLAS.frames));
  // Smooth arrival/departure without changing the logical destination.
  const eased = progress * progress * (3 - 2 * progress);
  return { progress: eased, frame, done: progress === 1 };
}

export function hostileIdleFrameAt(elapsedMs: number, offset = 0): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return 0;
  return ((Math.floor(elapsedMs / HOSTILE_IDLE_FRAME_MS) + offset) % WALK_ATLAS.frames + WALK_ATLAS.frames) % WALK_ATLAS.frames;
}
