import test from 'node:test';
import assert from 'node:assert/strict';
import { isoOfficerFrame, joinOfficerRoutes, officerRouteStepAt, OFFICER_ROUTE_STEP_MS } from '../src/isoOfficerAnimation.ts';
import { createMission, missionPath, SCENARIOS } from '../src/isoScenarioCampaign.ts';
import { WALK_ATLAS } from '../src/tacticalAnimation.ts';

test('stationary officers use a real fixed atlas frame rather than walking in place', () => {
  for (const unit of ['science','security','medic']) {
    for (const time of [0,167,360,1300,48_900]) {
      assert.equal(isoOfficerFrame(unit,null,time,true),0);
    }
  }
});

test('only the moving officer walks; two other sprites remain on their first frame', () => {
  const motion = {unitId:'science',start:1_000};
  assert.equal(isoOfficerFrame('science',motion,1_001,true),0);
  assert.equal(isoOfficerFrame('science',motion,1_210,true),1);
  assert.equal(isoOfficerFrame('science',motion,1_550,true),3);
  assert.equal(isoOfficerFrame('science',motion,2_001,true),0);
  for (const unit of ['security','medic']) {
    assert.equal(isoOfficerFrame(unit,motion,1_210,true),0);
    assert.equal(isoOfficerFrame(unit,motion,1_550,true),0);
  }
  assert.equal(isoOfficerFrame('science',{unitId:'security',start:0},1_550,true),0);
});

test('pause, reduced motion, not-yet-started paths and negative timestamps stay at rest', () => {
  const motion={unitId:'medic',start:2_000};
  assert.equal(isoOfficerFrame('medic',motion,2_550,false),0);
  assert.equal(isoOfficerFrame('medic',{unitId:'medic',start:null},2_550,true),0);
  assert.equal(isoOfficerFrame('medic',motion,1_000,true),0);
  assert.equal(isoOfficerFrame('medic',motion,Number.NaN,true),0);
  assert.equal(isoOfficerFrame('medic',motion,Number.POSITIVE_INFINITY,true),0);
  assert.equal(isoOfficerFrame('medic',motion,2_550,true),3);
  assert.equal(WALK_ATLAS.frames,6);
});

test('a multi-tile officer move follows every BFS corner without crossing walls or cover', () => {
  const route = missionPath(createMission('relay'), 'science', '3:3');
  assert.ok(route && route.length >= 4, 'Authored mission must supply a turning route');
  const forbidden = new Set([...SCENARIOS.relay.walls, ...SCENARIOS.relay.cover]);
  const directions = new Set();
  for (let segment = 0; segment < route.length - 1; segment++) {
    const sample = officerRouteStepAt(route, (segment + .5) * OFFICER_ROUTE_STEP_MS);
    assert.equal(sample.segment, segment);
    assert.equal(sample.from, route[segment]);
    assert.equal(sample.to, route[segment + 1]);
    assert.equal(sample.done, false);
    assert.equal(sample.progress, .5);
    assert.equal(forbidden.has(sample.from), false);
    assert.equal(forbidden.has(sample.to), false);
    const [ax, ay] = sample.from.split(':').map(Number);
    const [bx, by] = sample.to.split(':').map(Number);
    assert.equal(Math.abs(ax - bx) + Math.abs(ay - by), 1, 'No diagonal shortcuts');
    directions.add(ax !== bx ? 'horizontal' : 'vertical');
  }
  assert.deepEqual([...directions].sort(), ['horizontal', 'vertical']);
  const finish = officerRouteStepAt(route, (route.length - 1) * OFFICER_ROUTE_STEP_MS);
  assert.deepEqual(finish, {from:'3:3',to:'3:3',progress:1,frame:0,done:true,segment:route.length-1});
});

test('route sampler visits six walk frames per tile and safely handles invalid time', () => {
  const route = ['1:1', '2:1', '2:2'];
  for (let segment = 0; segment < 2; segment++) {
    for (let frame = 0; frame < WALK_ATLAS.frames; frame++) {
      const t = (segment + (frame + .5) / WALK_ATLAS.frames) * OFFICER_ROUTE_STEP_MS;
      const sample = officerRouteStepAt(route, t);
      assert.equal(sample.segment, segment);
      assert.equal(sample.frame, frame);
    }
  }
  for (const t of [-1, NaN, Infinity, -Infinity]) {
    const sample = officerRouteStepAt(route, t);
    assert.equal(sample.from, '1:1');
    assert.equal(sample.progress, 0);
    assert.equal(sample.frame, 0);
  }
  assert.equal(officerRouteStepAt(['1:1'], 10).done, true);
});

test('consecutive legal movement orders extend the active route instead of jumping to its old endpoint', () => {
  const first = ['1:1', '2:1', '3:1'];
  const second = ['3:1', '3:2'];
  const joined = joinOfficerRoutes(first, second);
  assert.deepEqual(joined, ['1:1', '2:1', '3:1', '3:2']);
  assert.deepEqual(first, ['1:1', '2:1', '3:1'], 'No mutation of the active route');
  assert.deepEqual(second, ['3:1', '3:2'], 'No mutation of the new route');
  assert.equal(joinOfficerRoutes(first, ['4:1', '4:2']), null, 'Never invent a connector');
  assert.equal(joinOfficerRoutes(first, ['3:1']), null, 'No new movement to append');
  for (let step = 0; step < joined.length - 1; step++) {
    const sample = officerRouteStepAt(joined, (step + .5) * OFFICER_ROUTE_STEP_MS);
    assert.equal(sample.from, joined[step]);
    assert.equal(sample.to, joined[step + 1]);
    assert.equal(sample.progress, .5);
  }
});

// A two-tile route must keep moving through its corner instead of stopping
// for a full ease-out/ease-in at the intermediate cell.
test('officer retains walking speed through an intermediate BFS corner', () => {
  const route = ['1:1', '2:1', '2:2'];
  const delta = 16;
  const before = officerRouteStepAt(route, OFFICER_ROUTE_STEP_MS - delta);
  const corner = officerRouteStepAt(route, OFFICER_ROUTE_STEP_MS);
  const after = officerRouteStepAt(route, OFFICER_ROUTE_STEP_MS + delta);
  assert.equal(before.segment, 0);
  assert.equal(corner.segment, 1);
  assert.equal(after.segment, 1);
  assert.equal(before.to, corner.from);
  assert.equal(corner.from, after.from);
  assert.ok(Math.abs((1 - before.progress) - delta / OFFICER_ROUTE_STEP_MS) < 1e-10);
  assert.ok(Math.abs(after.progress - delta / OFFICER_ROUTE_STEP_MS) < 1e-10);
  assert.equal(corner.progress, 0);
});
