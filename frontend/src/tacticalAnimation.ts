export const WALK_ATLAS = Object.freeze({ columns: 3, rows: 2, frames: 6, fps: 6 });

export function walkFrameAt(elapsedMs: number): number {
  return Math.floor((elapsedMs * WALK_ATLAS.fps) / 1_000) % WALK_ATLAS.frames;
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
