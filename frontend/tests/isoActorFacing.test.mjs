import test from 'node:test';
import assert from 'node:assert/strict';
import { headingFromCells, isoSpriteSideFromPoints, retainIsoSpriteSides } from '../src/isoActorFacing.ts';

test('eight observed directions map to real x/z world headings, not walk-atlas frames', () => {
  const cases = [
    ['3:3','3:4',0],
    ['3:3','4:4',Math.PI/4],
    ['3:3','4:3',Math.PI/2],
    ['3:3','4:2',3*Math.PI/4],
    ['3:3','3:2',Math.PI],
    ['3:3','2:2',-3*Math.PI/4],
    ['3:3','2:3',-Math.PI/2],
    ['3:3','2:4',-Math.PI/4],
  ];
  for (const [from,to,expected] of cases) {
    const actual=headingFromCells(from,to);
    assert.notEqual(actual,null);
    assert.ok(Math.abs(actual-expected)<1e-10, from+' -> '+to);
  }
});

test('shooting at a distant target uses true bearing, not a nearest-cell shortcut', () => {
  assert.equal(headingFromCells('1:1','5:1'),Math.PI/2);
  assert.ok(Math.abs(headingFromCells('1:1','5:3')-Math.atan2(4,2))<1e-10);
});

test('invalid or identical positions never invent a facing direction', () => {
  for (const [from,to] of [['1:1','1:1'],['','2:1'],['1:2','1:a'],['1:2','Infinity:1'],['-1:1','1:1'],['1:1','1:2:3']]) {
    assert.equal(headingFromCells(from,to),null);
  }
});

test('continuous fractional routes face according to projected lateral travel',()=>{
 const from={x:4.25,y:5.5};
 for(const [to,expected] of [
  [{x:3.75,y:5.5},'left'], [{x:4.75,y:5.5},'right'],
  [{x:4.25,y:5},'right'], [{x:4.25,y:6},'left'],
  [{x:5.25,y:6.5},null], [{x:3.25,y:4.5},null],
  [from,null], [{x:NaN,y:5},null],
 ])assert.equal(isoSpriteSideFromPoints(from,to),expected);
});

test('lateral facing survives neutral segments and arrival independently per officer',()=>{
 const initial=new Map();
 const walking=retainIsoSpriteSides(initial,[['venn','left'],['dorn','right'],['mira',null]]);
 assert.equal(initial.size,0);
 assert.deepEqual([...walking],[['venn','left'],['dorn','right']]);
 assert.equal(retainIsoSpriteSides(walking,[['venn',null],['dorn',null],['mira',null]]),walking);
 const reverse=retainIsoSpriteSides(walking,[['venn','right'],['dorn',null],['mira','left']]);
 assert.deepEqual([...reverse],[['venn','right'],['dorn','right'],['mira','left']]);
 assert.deepEqual([...retainIsoSpriteSides(reverse,[['dorn',null]])],[['dorn','right']]);
 assert.equal(retainIsoSpriteSides(reverse,[]).size,0);
});
