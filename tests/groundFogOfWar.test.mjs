import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {startAwayTeam} from '../src/awayTeam.mjs';
import {
  startGroundSquadPositions,orderGroundOfficerMove,
  groundSquadVisitedCells,serializeGroundSquadPositions,deserializeGroundSquadPositions,
} from '../src/groundSquadPositions.mjs';
import {GROUND_VISION_RADIUS,groundVisionCells,groundFogOfWar} from '../src/groundFogOfWar.mjs';

const world=JSON.parse(readFileSync(new URL('../content/scenes/meridian.json',import.meta.url),'utf8'));
const away=startAwayTeam();
const deploy=()=>startGroundSquadPositions(world,
 {version:1,area:'surface',x:4,y:5,heading:'N',pending:null},away);

test('opaque walls hide all cells behind them but are visible themselves',()=>{
 const scene={width:7,height:7,walls:[{x:3,y:2}],objects:[]};
 const cells=groundVisionCells(scene,[{x:3,y:3}],3);
 assert.ok(cells.has('3,2'),'nearest wall is visible');
 assert.ok(!cells.has('3,1'),'cannot see through it');
 assert.ok(cells.has('3,3'));
 assert.equal(GROUND_VISION_RADIUS,3);
});

test('two walls closing a diagonal corner prevent impossible peeking',()=>{
 const scene={width:6,height:6,walls:[{x:2,y:3},{x:3,y:2}],objects:[]};
 const cells=groundVisionCells(scene,[{x:2,y:2}],3);
 assert.ok(cells.has('2,3')&&cells.has('3,2'));
 assert.ok(!cells.has('3,3'));
});

test('teleport pad is a floor feature, not a wall blocking south K-47 art',()=>{
 const moved=orderGroundOfficerMove(world,away,deploy(),'venn',{x:5,y:6});
 const seen=groundFogOfWar(world,away,moved.snapshot).explored;
 for(const x of [3,4,5,6,7])
  assert.ok(seen.has(x+',7'),'actual southern wall '+x+',7 is discovered');
 // No weakening of true opacity: built walls still hide the tiles behind.
 const scene={width:7,height:7,walls:[{x:3,y:2}],objects:[
  {id:'beam-out',type:'transition',x:1,y:2},
  {id:'solid-medical',type:'station',x:5,y:2},
 ]};
 assert.ok(groundVisionCells(scene,[{x:1,y:3}],3).has('1,1'));
 assert.ok(!groundVisionCells(scene,[{x:3,y:3}],3).has('3,1'));
 assert.ok(!groundVisionCells(scene,[{x:5,y:3}],3).has('5,1'));
});

test('actual squad moves reveal intermediate terrain and remember it after returning',()=>{
 const initial=deploy();
 const old=groundFogOfWar(world,away,initial);
 assert.ok(old.visible.has('4,5'));
 assert.ok(!old.explored.has('10,4'),'eastern valley starts unknown');
 const first=orderGroundOfficerMove(world,away,initial,'venn',{x:9,y:4});
 assert.ok(first.route.some(p=>p.x===8&&p.y===4),'real east door must be crossed');
 const visited=groundSquadVisitedCells(world,away,first.snapshot);
 assert.ok(visited.some(p=>p.x===8&&p.y===4));
 const revealed=groundFogOfWar(world,away,first.snapshot);
 assert.ok(revealed.visible.has('10,4'),'observer now sees adjacent valley');
 assert.ok(revealed.explored.has('10,4'));
 const returned=orderGroundOfficerMove(world,away,first.snapshot,'venn',{x:4,y:5});
 const remembered=groundFogOfWar(world,away,returned.snapshot);
 assert.ok(remembered.explored.has('10,4'),'terrain memory stays');
 assert.ok(!remembered.visible.has('10,4'),'old intel is not live sight');
 assert.deepEqual(groundFogOfWar(world,away,initial),old,'fog calculation is deterministic');
});

test('F5-style serialize/deserialize reconstructs identical discovered cells without a fog save',()=>{
 const fresh=deploy();
 const next=orderGroundOfficerMove(world,away,fresh,'venn',{x:9,y:4}).snapshot;
 const saved=serializeGroundSquadPositions(world,away,next);
 const restored=deserializeGroundSquadPositions(world,away,saved);
 const before=groundFogOfWar(world,away,next),after=groundFogOfWar(world,away,restored);
 assert.deepEqual(after,before);
 assert.deepEqual(Object.keys(JSON.parse(saved)).sort(),['commands','origin','squad','version']);
});

test('input invalidity cannot reveal an infinite/off-grid region',()=>{
 const scene={width:2,height:2,walls:[],objects:[]};
 assert.throws(()=>groundVisionCells(scene,[{x:5,y:5}]),/outside map/);
 assert.throws(()=>groundVisionCells(scene,[{x:1,y:1}],200),/Invalid/);
});
