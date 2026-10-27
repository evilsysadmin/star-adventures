import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SCENARIOS, MAX_MOVE_STEPS, createMission, missionPath,
  nextMissionWaypoint, applyMissionAction,
} from '../src/isoScenarioCampaign.ts';

test('far destination advances through actual five-cell BFS segments, not a teleport', () => {
  let mission = createMission('derelict');
  const destination = '10:9';
  const hostiles = SCENARIOS.derelict.hostiles.map(contact => contact.cell);
  const forbidden = new Set([
    ...SCENARIOS.derelict.walls, ...SCENARIOS.derelict.cover,
    SCENARIOS.derelict.sensor, SCENARIOS.derelict.console,
    SCENARIOS.derelict.survivor, ...hostiles,
  ]);
  let totalSteps = 0, stages = 0;
  while (mission.locations.science !== destination) {
    const route = missionPath(mission, 'science', destination, hostiles);
    assert.ok(route && route.length > 1, 'Far target must remain reachable');
    const waypoint = nextMissionWaypoint(route);
    assert.ok(waypoint);
    const segment = route.slice(0, Math.min(route.length, MAX_MOVE_STEPS + 1));
    assert.equal(waypoint, segment.at(-1));
    assert.ok(segment.length - 1 <= MAX_MOVE_STEPS);
    for (const cell of segment.slice(1)) assert.equal(forbidden.has(cell), false, cell);
    if (mission.ap === 0) mission = applyMissionAction(mission, {type:'end-turn'});
    const oldPosition = mission.locations.science;
    const oldAp = mission.ap;
    mission = applyMissionAction(mission, {type:'move',officer:'science',cell:waypoint}, hostiles);
    assert.equal(mission.locations.science, waypoint);
    assert.notEqual(oldPosition, waypoint);
    assert.equal(mission.ap, oldAp - 1, 'Each stage consumes exactly one order');
    totalSteps += segment.length - 1;
    stages++;
    assert.ok(stages <= 5, 'Mission should finish in bounded stages');
  }
  assert.equal(totalSteps, 17);
  assert.equal(stages, 4);
  assert.equal(mission.round, 2);
  assert.equal(mission.locations.science, destination);
});

test('long-range route is never accepted as a single movement command', () => {
  const mission = createMission('derelict');
  const hostiles = SCENARIOS.derelict.hostiles.map(contact => contact.cell);
  const route = missionPath(mission,'science','10:9',hostiles);
  assert.ok(route && route.length > MAX_MOVE_STEPS + 1);
  assert.throws(() => applyMissionAction(mission, {
    type:'move',officer:'science',cell:'10:9',
  },hostiles), /Destination blocked/);
  assert.equal(nextMissionWaypoint(null), null);
  assert.equal(nextMissionWaypoint(['1:1']), null);
  assert.equal(nextMissionWaypoint(['1:1','2:1']), '2:1');
  assert.equal(missionPath(mission,'science','9:9',hostiles), null,
    'A console is not a traversable destination');
  assert.equal(mission.ap, 3, 'Rejected commands do not consume orders');
});
