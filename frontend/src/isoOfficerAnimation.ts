// A visual-only clip schedule for one officer. Never authoritative for game state.
// Walking must not be shared across atlas users: everyone except the actual
// moving officer holds the first frame, and pause/reduced-motion hold it too.
import { walkFrameAt } from './tacticalAnimation.ts';

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
