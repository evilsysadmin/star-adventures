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
  // Constant travel speed lets concatenated enemy turns cross tile boundaries
  // without braking to zero and accelerating again at every corner.
  return { progress, frame, done: progress === 1 };
}

export function hostileIdleFrameAt(elapsedMs: number, offset = 0): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return 0;
  return ((Math.floor(elapsedMs / HOSTILE_IDLE_FRAME_MS) + offset) % WALK_ATLAS.frames + WALK_ATLAS.frames) % WALK_ATLAS.frames;
}

// Consecutive accepted enemy turns can arrive before a sprite finishes its
// previous tile. Retain the original visual clock and append only contiguous
// authoritative cells; never invent a connector through walls or cover.
export function joinHostileRoutes(active: readonly string[], next: readonly string[]): readonly string[] | null {
  if (active.length < 2 || next.length < 2 || active.at(-1) !== next[0]) return null;
  return [...active, ...next.slice(1)];
}

export function hostileRouteStepAt(route: readonly string[], elapsedMs: number): Readonly<{
  from: string; to: string; segment: number; progress: number; frame: number; done: boolean;
}> {
  const segments = Math.max(0, route.length - 1);
  const last = route.at(-1) ?? '';
  if (!segments || (Number.isFinite(elapsedMs) && elapsedMs >= segments * HOSTILE_STEP_MS))
    return { from: last, to: last, segment: segments, progress: 1, frame: 0, done: true };
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const segment = Math.min(segments - 1, Math.floor(elapsed / HOSTILE_STEP_MS));
  return { from: route[segment], to: route[segment + 1], segment,
    ...hostileStepAt(elapsed - segment * HOSTILE_STEP_MS) };
}
