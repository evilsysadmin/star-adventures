import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TRAINING_START, TRAINING_COVER, TRAINING_TARGETS,
  validateTrainingState, planTrainingMove, commitTrainingMove,
} from '../src/isoTrainingMovement.ts';

test('pathfinding is deterministic, four-way and respects 8x8 board bounds', () => {
  validateTrainingState(TRAINING_START);
  const plan = planTrainingMove(TRAINING_START, 'science', '4:1');
  assert.deepEqual(plan, {unitId:'science', cells:['1:1','2:1','3:1','4:1']});
  const repeated = planTrainingMove(TRAINING_START, 'science', '4:1');
  assert.deepEqual(plan, repeated);
  assert.equal(plan.cells.length - 1, 3);
  for (const [a, b] of plan.cells.slice(1).map((v, i) => [plan.cells[i], v])) {
    const [ax,ay] = a.split(':').map(Number), [bx,by] = b.split(':').map(Number);
    assert.equal(Math.abs(ax - bx) + Math.abs(ay - by), 1);
  }
});

test('cover blocks movement; destinations are selectable but never walkable', () => {
  for (const at of [...TRAINING_COVER,...TRAINING_TARGETS,'2:5','1:6','8:8','-1:4','3:2junk'])
    assert.equal(planTrainingMove(TRAINING_START,'science',at),null,at);
  assert.deepEqual(planTrainingMove(TRAINING_START, 'science', '1:1'),
    {unitId:'science',cells:['1:1']});
  assert.throws(() => commitTrainingMove(TRAINING_START,'science','1:1'),RangeError);
  assert.throws(() => commitTrainingMove(TRAINING_START,'science','3:3'),RangeError);
  const detour = planTrainingMove(TRAINING_START,'science','5:4');
  assert.ok(detour.cells.length > 2);
  for (const id of detour.cells)
    assert.ok(!TRAINING_COVER.includes(id) && !TRAINING_TARGETS.includes(id));
});

test('committing changes exactly one officer while preserving original and identity', () => {
  const next = commitTrainingMove(TRAINING_START,'security','3:5');
  assert.deepEqual(next.units.map(x=>x.cell),['1:1','3:5','1:6']);
  assert.deepEqual(TRAINING_START.units.map(x=>x.cell),['1:1','2:5','1:6']);
  const followup = commitTrainingMove(next,'security','4:5');
  assert.equal(followup.units[1].cell,'4:5');
  assert.equal(followup.units[1].id,'security');
  assert.equal(followup.units[0].cell,TRAINING_START.units[0].cell);
  assert.deepEqual(planTrainingMove(TRAINING_START,'security','3:5').cells,['2:5','3:5']);
});

test('occupancy changes block previously legal destinations and routing adapts', () => {
  const before = planTrainingMove(TRAINING_START,'science','3:5');
  assert.ok(before);
  const moved = commitTrainingMove(TRAINING_START,'security','3:5');
  assert.equal(planTrainingMove(moved,'science','3:5'),null);
  const after = planTrainingMove(moved,'science','2:6');
  assert.ok(after);
  assert.equal(after.cells.includes('3:5'),false);
});

test('forged state, unit duplicates, impossible coordinates and invalid unit IDs fail closed', () => {
  const unknown = {units:[{id:'science',cell:'1:1'},{id:'science',cell:'2:5'},{id:'medic',cell:'1:6'}]};
  assert.throws(()=>validateTrainingState(unknown), TypeError);
  assert.throws(()=>validateTrainingState({units:[{id:'science',cell:'1:1'}]}), TypeError);
  assert.throws(()=>validateTrainingState({units:[
    {id:'science',cell:'1:1'},{id:'security',cell:'1:1'},{id:'medic',cell:'1:6'},
  ]}), TypeError);
  assert.throws(()=>validateTrainingState({units:[
    {id:'science',cell:'3:3'},{id:'security',cell:'2:5'},{id:'medic',cell:'1:6'},
  ]}), TypeError);
  assert.equal(planTrainingMove(TRAINING_START,'alien','2:2'),null);
  assert.throws(()=>commitTrainingMove(TRAINING_START,'alien','2:2'),RangeError);
  assert.throws(()=>commitTrainingMove(unknown,'science','4:4'), TypeError);
});

test('a supplied hostile snapshot, rather than a decorative mesh, blocks its current cells', () => {
  const patrolling = ['6:1', '6:6'];
  assert.equal(planTrainingMove(TRAINING_START, 'science', '6:1', patrolling), null);
  const route = planTrainingMove(TRAINING_START, 'science', '5:1', patrolling);
  assert.ok(route);
  assert.equal(route.cells.includes('6:1'), false);
  assert.throws(() => validateTrainingState(TRAINING_START, ['not-a-cell']), TypeError);
});
