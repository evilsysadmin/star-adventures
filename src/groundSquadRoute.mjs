import { validateExploration } from './spatial.mjs';

const HEADINGS = ['N', 'E', 'S', 'W'];
const ADJACENT = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const id = (x, y) => x + ',' + y;

/** Shortest deterministic route over the authoritative surface grid.
 * Returns a list of existing spatial commands, or null for unreachable terrain.
 * The UI must not mutate the domain state directly.
 */
export function planGroundSquadRoute(world, state, destination) {
  validateExploration(world, state);
  if (state.area !== 'surface' || state.pending !== null)
    throw new RangeError('Surface navigation is unavailable');
  const scene = world.scenes.surface;
  if (!destination || !Number.isSafeInteger(destination.x) || !Number.isSafeInteger(destination.y) ||
      destination.x < 0 || destination.y < 0 ||
      destination.x >= scene.width || destination.y >= scene.height)
    throw new TypeError('Invalid destination');
  const obstacles = new Set([...scene.walls, ...scene.objects].map(tile => id(tile.x, tile.y)));
  const start = id(state.x, state.y), finish = id(destination.x, destination.y);
  if (obstacles.has(finish)) return null;
  if (start === finish) return [];
  const queue = [{x:state.x, y:state.y}];
  const previous = new Map([[start, null]]);
  for (let cursor = 0; cursor < queue.length && !previous.has(finish); cursor++) {
    const from = queue[cursor];
    for (const [dx,dy] of ADJACENT) {
      const x = from.x + dx, y = from.y + dy, next = id(x,y);
      if (x < 0 || y < 0 || x >= scene.width || y >= scene.height ||
          obstacles.has(next) || previous.has(next)) continue;
      previous.set(next, id(from.x,from.y));
      queue.push({x,y});
    }
  }
  if (!previous.has(finish)) return null;
  const route = [];
  for (let current = finish; current !== start; current = previous.get(current)) {
    const [x,y] = current.split(',').map(Number);
    route.push({x,y});
  }
  route.reverse();
  const commands = [];
  let position = {x:state.x,y:state.y};
  let facing = HEADINGS.indexOf(state.heading);
  for (const next of route) {
    const dx = next.x - position.x, dy = next.y - position.y;
    const nextHeading = ADJACENT.findIndex(([ax,ay]) => ax === dx && ay === dy);
    if (nextHeading < 0) throw new Error('Nonadjacent path');
    const turns = (nextHeading - facing + 4) % 4;
    if (turns === 3) commands.push('turn-left');
    else for (let count = 0; count < turns; count++) commands.push('turn-right');
    commands.push('forward');
    facing = nextHeading;
    position = next;
  }
  return commands;
}
