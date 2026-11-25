import test from 'node:test';
import assert from 'node:assert/strict';
import { visibleGroundNameplates } from '../src/groundNameplateLayout.ts';
const actor=(id,x,y,selected=false)=>({id,x,y,selected,bodyTop:-53,plateY:-55,plateWidth:38});
test('nearby body takes precedence even over selected name, separation restores it',()=>{
 const front=actor('front',0,40,true),back=actor('back',0,0);
 assert.deepEqual([...visibleGroundNameplates([front,back])],['back']);
 assert.deepEqual([...visibleGroundNameplates([front,{...back,x:80}])],['front','back']);
});
test('overlapping label envelopes prefer selected actor, ties use roster order',()=>{
 const a=actor('a',0,0),b=actor('b',44,0,true);
 // Longer callsigns can overlap even when bodies do not.
 const longA={...a,plateWidth:60},longB={...b,plateWidth:60};
 assert.deepEqual([...visibleGroundNameplates([longA,longB])],['b']);
 assert.deepEqual([...visibleGroundNameplates([longA,{...longB,selected:false}])],['a']);
});
test('empty roster and single actor never lose an identity unnecessarily',()=>{
 assert.equal(visibleGroundNameplates([]).size,0);
 assert.deepEqual([...visibleGroundNameplates([actor('solo',0,0)])],['solo']);
});
