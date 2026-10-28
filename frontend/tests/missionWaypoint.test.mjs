import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { missionWaypoint } from '../src/missionWaypoint.ts';
import { startExploration, applyExploration } from '../../src/spatial.mjs';

const world = JSON.parse(readFileSync(
  new URL('../../content/scenes/meridian.json', import.meta.url), 'utf8',
));

function follow(state, target) {
  const initial = state;
  const original = structuredClone(state);
  let turns = 0;
  for (let i = 0; i < 50; i++) {
    const hint = missionWaypoint(world, state, target);
    assert.ok(hint, `missing route to ${target} at ${state.x}:${state.y}`);
    assert.equal(hint.label, world.scenes[state.area].objects.find(o => o.id === target).label);
    const outcome = applyExploration(world, state, { type: hint.action });
    assert.notEqual(outcome.event.type, 'blocked', 'waypoint must never guide into a wall or object');
    if (hint.action === 'use') {
      assert.equal(hint.steps, 0);
      assert.deepEqual(initial, original, 'guidance must not mutate the original state');
      return { ...outcome, turns };
    }
    state = outcome.state;
    turns++;
  }
  assert.fail('mission guide did not reach the physical interaction point');
}

test('actual bridge → medical rescue → transporter route never walks through consoles', () => {
  const bridge = startExploration(world);
  assert.equal(missionWaypoint(world, bridge, 'transporter').action, 'turn-right');
  const transport = follow(bridge, 'transporter');
  assert.equal(transport.event.type, 'transition-offered');
  assert.equal(transport.state.area, 'bridge');
  const surface = applyExploration(world, transport.state, { type: 'confirm' }).state;
  assert.equal(surface.area, 'surface');

  const relief = follow(surface, 'relief-point');
  assert.equal(relief.event.action, 'assist-evacuees');
  const beam = follow(relief.state, 'beam-out');
  assert.equal(beam.event.type, 'transition-offered');
  const returned = applyExploration(world, beam.state, { type: 'confirm' }).state;
  assert.equal(returned.area, 'bridge');
  assert.equal(missionWaypoint(world, returned, null), null);
});

test('waypoint is a real usable facing direction, not an imaginary shortcut', () => {
  const atTransport = { version: 1, area: 'bridge', x: 4, y: 5, heading: 'S', pending: null };
  const hint = missionWaypoint(world, atTransport, 'transporter');
  assert.deepEqual(hint, {
    action: 'use', steps: 0, turns: 0,
    label: 'Acceso a la sala de transporte',
  });
  assert.equal(missionWaypoint(world, { ...atTransport, pending: { id: 'transporter', to: 'surface' } }, 'transporter'), null);
  assert.equal(missionWaypoint(world, atTransport, 'not-an-object'), null);
});

test('blocked routes fail closed instead of suggesting illegal moves', () => {
  const blockedWorld = { scenes: { bridge: {
    width: 5, height: 5,
    walls: [
      ...Array.from({length:5},(_,x)=>({x,y:0})),
      ...Array.from({length:5},(_,x)=>({x,y:4})),
      ...Array.from({length:3},(_,i)=>({x:0,y:i+1})),
      ...Array.from({length:3},(_,i)=>({x:4,y:i+1})),
      {x:2,y:1},{x:1,y:2},{x:3,y:2},{x:2,y:3},
    ],
    objects: [{id:'target',label:'Objetivo',x:2,y:2}],
  } } };
  assert.equal(missionWaypoint(blockedWorld, {
    area:'bridge',x:1,y:1,heading:'N',pending:null,
  },'target'),null);
});
