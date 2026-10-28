/** In-world mission guidance. Never moves the player or bypasses spatial collision. */
export type WaypointCommand = 'forward' | 'turn-left' | 'turn-right' | 'use';
type Point = { x: number; y: number };
type SceneObject = Point & { id: string; label: string };
type Scene = {
  width: number; height: number;
  walls: Point[];
  objects: SceneObject[];
};
export type MissionWorld = { scenes: Record<string, Scene> };
export type WaypointState = {
  area: string; x: number; y: number; heading: string;
  pending?: unknown;
};
export type MissionWaypoint = {
  action: WaypointCommand;
  steps: number;
  turns: number;
  label: string;
};

const DIRECTIONS = [
  { heading: 'N', x: 0, y: -1 },
  { heading: 'E', x: 1, y: 0 },
  { heading: 'S', x: 0, y: 1 },
  { heading: 'W', x: -1, y: 0 },
] as const;

type Route = Point & { facing: number; commands: WaypointCommand[] };
const key = (x: number, y: number) => `${x},${y}`;

/**
 * Shortest legal sequence of forward/turn commands ending *facing* the
 * physical station. Objects and walls remain impassable, exactly as in
 * spatial.mjs. Backwards movement is intentionally omitted from guidance:
 * following the displayed arrow always means advancing toward the objective.
 */
export function missionWaypoint(
  world: MissionWorld, state: WaypointState, targetId: string | null,
): MissionWaypoint | null {
  if (!targetId || state.pending) return null;
  const scene = world.scenes[state.area];
  if (!scene) return null;
  const target = scene.objects.find(item => item.id === targetId);
  const facing = DIRECTIONS.findIndex(item => item.heading === state.heading);
  if (!target || facing < 0) return null;

  const blocked = new Set([
    ...scene.walls.map(item => key(item.x, item.y)),
    ...scene.objects.map(item => key(item.x, item.y)),
  ]);
  const seen = new Set<string>();
  const queue: Route[] = [{ x: state.x, y: state.y, facing, commands: [] }];
  for (let index = 0; index < queue.length; index++) {
    const current = queue[index];
    const direction = DIRECTIONS[current.facing];
    if (current.x + direction.x === target.x &&
        current.y + direction.y === target.y) {
      const commands: WaypointCommand[] = [...current.commands, 'use'];
      return {
        action: commands[0],
        steps: commands.filter(command => command === 'forward').length,
        turns: commands.filter(command => command.startsWith('turn-')).length,
        label: target.label,
      };
    }
    const candidates: Route[] = [
      { x: current.x + direction.x, y: current.y + direction.y,
        facing: current.facing, commands: [...current.commands, 'forward'] },
      { x: current.x, y: current.y, facing: (current.facing + 1) % 4,
        commands: [...current.commands, 'turn-right'] },
      { x: current.x, y: current.y, facing: (current.facing + 3) % 4,
        commands: [...current.commands, 'turn-left'] },
    ];
    for (const candidate of candidates) {
      if (candidate.x < 0 || candidate.y < 0 ||
          candidate.x >= scene.width || candidate.y >= scene.height ||
          blocked.has(key(candidate.x, candidate.y))) continue;
      const identity = `${candidate.x},${candidate.y},${candidate.facing}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      queue.push(candidate);
    }
  }
  return null;
}
