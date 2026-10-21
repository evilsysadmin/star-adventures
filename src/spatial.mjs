// Grid/heading navigation shared by first-person bridge and away scenes.
// Pure domain simulation: no React, Three.js, Web Storage, transport or combat imports.
export class SpatialError extends Error {
  constructor(message) { super(message); this.name = 'SpatialError'; }
}
const fail = message => { throw new SpatialError(message); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const string = value => typeof value === 'string' && value.length > 0 && value.length <= 128;
const integer = value => Number.isSafeInteger(value);
export const HEADINGS = Object.freeze(['N', 'E', 'S', 'W']);
const STEP = Object.freeze([{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }]);
const tileId = (x, y) => `${x},${y}`;

function validCoordinate(scene, x, y) {
  return integer(x) && integer(y) && x >= 0 && y >= 0 && x < scene.width && y < scene.height;
}
function hasBlockingTile(scene, x, y) {
  if (!validCoordinate(scene, x, y)) return true;
  return scene.walls.some(tile => tile.x === x && tile.y === y) ||
    scene.objects.some(item => item.x === x && item.y === y);
}

export function validateWorld(world) {
  if (!object(world) || world.version !== 1 || !string(world.startArea) || !object(world.scenes) ||
    !Object.hasOwn(world.scenes, world.startArea)) fail('Invalid world');
  const entries = Object.entries(world.scenes);
  if (!entries.length) fail('No scenes');
  for (const [area, scene] of entries) {
    if (!string(area) || !object(scene) || !string(scene.title) ||
      !integer(scene.width) || !integer(scene.height) || scene.width < 3 ||
      scene.height < 3 || scene.width > 100 || scene.height > 100 ||
      !Array.isArray(scene.walls) || !Array.isArray(scene.objects) ||
      !object(scene.spawn)) fail('Invalid area: ' + area);
    const occupied = new Set();
    for (const tile of scene.walls) {
      if (!object(tile) || !validCoordinate(scene, tile.x, tile.y)) fail('Invalid wall');
      const key = tileId(tile.x, tile.y);
      if (occupied.has(key)) fail('Duplicate blocking tile');
      occupied.add(key);
    }
    const ids = new Set();
    for (const item of scene.objects) {
      if (!object(item) || !string(item.id) || !string(item.label) ||
        !validCoordinate(scene, item.x, item.y) ||
        !['station', 'transition'].includes(item.type)) fail('Invalid scene object');
      const key = tileId(item.x, item.y);
      if (occupied.has(key) || ids.has(item.id)) fail('Duplicate scene object/tile');
      occupied.add(key);
      ids.add(item.id);
      if (item.type === 'station' && !string(item.action)) fail('Station needs real action ID');
      if (item.type === 'transition' &&
        (!string(item.to) || !Object.hasOwn(world.scenes, item.to))) fail('Invalid destination');
    }
    if (!validCoordinate(scene, scene.spawn.x, scene.spawn.y) ||
      !HEADINGS.includes(scene.spawn.heading) ||
      occupied.has(tileId(scene.spawn.x, scene.spawn.y))) fail('Invalid scene spawn');
  }
  for (const scene of Object.values(world.scenes)) {
    for (const item of scene.objects) {
      if (item.type === 'transition') {
        const target = world.scenes[item.to];
        // Target spawn must already be walkable, verified above.
        if (!target) fail('Unknown target');
      }
    }
  }
  return true;
}

export function startExploration(world) {
  validateWorld(world);
  const spawn = world.scenes[world.startArea].spawn;
  return { version: 1, area: world.startArea, x: spawn.x, y: spawn.y, heading: spawn.heading, pending: null };
}

export function validateExploration(world, state) {
  if (!object(state) || state.version !== 1 || !Object.hasOwn(world.scenes, state.area) ||
    !HEADINGS.includes(state.heading) ||
    hasBlockingTile(world.scenes[state.area], state.x, state.y)) fail('Invalid exploration state');
  if (state.pending !== null) {
    const item = state.pending;
    if (!object(item) || !string(item.id) || !string(item.to) ||
      !world.scenes[state.area].objects.some(candidate => candidate.id === item.id &&
        candidate.type === 'transition' && candidate.to === item.to)) fail('Invalid pending transition');
  }
  return true;
}

export function faceTile(state, steps = 1) {
  const delta = STEP[HEADINGS.indexOf(state.heading)];
  return { x: state.x + delta.x * steps, y: state.y + delta.y * steps };
}

export function applyExploration(world, state, command) {
  validateExploration(world, state);
  if (!object(command) || !string(command.type)) fail('Invalid exploration command');
  const scene = world.scenes[state.area];
  if (state.pending !== null && !['confirm', 'decline'].includes(command.type))
    fail('Resolve the pending transition first');
  if (command.type === 'turn-left' || command.type === 'turn-right') {
    const index = HEADINGS.indexOf(state.heading);
    const direction = command.type === 'turn-right' ? 1 : 3;
    return { state: { ...state, heading: HEADINGS[(index + direction) % 4] }, event: { type: 'turned' } };
  }
  if (command.type === 'forward' || command.type === 'backward') {
    const next = faceTile(state, command.type === 'forward' ? 1 : -1);
    if (hasBlockingTile(scene, next.x, next.y))
      return { state, event: { type: 'blocked', target: next } };
    return { state: { ...state, ...next }, event: { type: 'moved' } };
  }
  if (command.type === 'use') {
    const next = faceTile(state);
    const target = scene.objects.find(item => item.x === next.x && item.y === next.y);
    if (!target) return { state, event: { type: 'nothing-to-use' } };
    if (target.type === 'station')
      return { state, event: { type: 'station', stationId: target.id, action: target.action, label: target.label } };
    return {
      state: { ...state, pending: { id: target.id, to: target.to } },
      event: { type: 'transition-offered', target: target.to, label: target.label },
    };
  }
  if (command.type === 'decline') {
    if (!state.pending) fail('No transition to decline');
    return { state: { ...state, pending: null }, event: { type: 'transition-declined' } };
  }
  if (command.type === 'confirm') {
    if (!state.pending) fail('No transition to confirm');
    const area = state.pending.to;
    return {
      state: { version: 1, area, ...world.scenes[area].spawn, pending: null },
      event: { type: 'area-entered', area },
    };
  }
  fail('Unknown exploration command');
}
