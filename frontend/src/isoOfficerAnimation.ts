// A visual-only clip schedule for one officer. Never authoritative for game state.
// Walking must not be shared across atlas users: everyone except the actual
// moving officer holds the first frame, and pause/reduced-motion hold it too.
import { WALK_ATLAS, walkFrameAt } from './tacticalAnimation.ts';

export type MovingClip = Readonly<{
  unitId: string;
  start: number | null;
}> | null;

export function isoOfficerFrame(
  unitId: string, motion: MovingClip, nowMs: number, animate: boolean,
): number {
  if (!animate || !motion || motion.unitId !== unitId ||
      motion.start === null || !Number.isFinite(nowMs)) return 0;
  return walkFrameAt(Math.max(0, nowMs - motion.start));
}

// When two legal movement orders arrive before the first animation finishes,
// retain the already visible path and append the second BFS route. The second
// route must begin at the first route's logical destination; otherwise the
// renderer must not invent a connecting segment through obstacles.
export function joinOfficerRoutes(
  active: readonly string[], next: readonly string[],
): readonly string[] | null {
  if (active.length < 2 || next.length < 2 || active.at(-1) !== next[0]) return null;
  return [...active, ...next.slice(1)];
}

// Walk one real orthogonal tile at a time along the same validated BFS route
// used by the mission reducer. This never changes logical movement or saves.
export const OFFICER_ROUTE_STEP_MS = 320;
export function officerRouteStepAt(route: readonly string[], elapsedMs: number): Readonly<{
  from: string; to: string; progress: number; frame: number; done: boolean; segment: number;
}> {
  const last = route.at(-1) ?? '';
  const segments = Math.max(0, route.length - 1);
  if (!segments || (Number.isFinite(elapsedMs) && elapsedMs >= segments * OFFICER_ROUTE_STEP_MS))
    return { from: last, to: last, progress: 1, frame: 0, done: true, segment: segments };
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const segment = Math.min(segments - 1, Math.floor(elapsed / OFFICER_ROUTE_STEP_MS));
  const fraction = (elapsed - segment * OFFICER_ROUTE_STEP_MS) / OFFICER_ROUTE_STEP_MS;
  const progress = fraction * fraction * (3 - 2 * fraction);
  return {
    from: route[segment], to: route[segment + 1], progress,
    frame: Math.min(WALK_ATLAS.frames - 1, Math.floor(fraction * WALK_ATLAS.frames)),
    done: false, segment,
  };
}
