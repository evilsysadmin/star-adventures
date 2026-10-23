export const WALK_ATLAS = Object.freeze({ columns: 3, rows: 2, frames: 6, fps: 6 });
export const RUN_ATLAS = Object.freeze({ ...WALK_ATLAS, fps: 10 });
export const JUMP_ATLAS = Object.freeze({ ...WALK_ATLAS, fps: 8 });
export const CROUCH_ATLAS = Object.freeze({ ...WALK_ATLAS, fps: 4 });

export function atlasFrameAt(elapsedMs: number, fps: number): number {
  return Math.floor((elapsedMs * fps) / 1_000) % WALK_ATLAS.frames;
}

export function walkFrameAt(elapsedMs: number): number {
  return atlasFrameAt(elapsedMs, WALK_ATLAS.fps);
}

export function runFrameAt(elapsedMs: number): number {
  return atlasFrameAt(elapsedMs, RUN_ATLAS.fps);
}

export function walkFrameUv(frame: number): { x: number; y: number } {
  const normalized = ((frame % WALK_ATLAS.frames) + WALK_ATLAS.frames) % WALK_ATLAS.frames;
  const column = normalized % WALK_ATLAS.columns;
  const row = Math.floor(normalized / WALK_ATLAS.columns);
  return {
    x: column / WALK_ATLAS.columns,
    y: 1 - (row + 1) / WALK_ATLAS.rows,
  };
}
