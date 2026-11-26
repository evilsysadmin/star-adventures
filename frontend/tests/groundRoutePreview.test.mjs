import test from 'node:test';
import assert from 'node:assert/strict';
import {groundRoutePreviews} from '../src/groundRoutePreview.ts';
const p=(x,y)=>({x,y});
const cells=(...ids)=>new Set(ids);
test('preview starts at the real fractional pose and includes only selected active routes',()=>{
  const officers=[
    {id:'a',...p(1.2,2),route:[p(2,2),p(3,2)]},
    {id:'b',...p(1,3),route:[p(2,3)]},
    {id:'c',...p(1,4),route:[]},
  ];
  const before=JSON.stringify(officers);
  assert.deepEqual(groundRoutePreviews(officers,['a','c'],cells('1,2','2,2','3,2','1,3','2,3')),[
    {id:'a',points:[p(1.2,2),p(2,2),p(3,2)],complete:true},
  ]);
  assert.equal(JSON.stringify(officers),before);
  assert.deepEqual(groundRoutePreviews(officers,[],cells('1,2','2,2')),[]);
});
test('stop at first unexplored segment; do not reveal later known reentry or endpoint',()=>{
  const officer={id:'a',...p(1,2),route:[p(2,2),p(3,2),p(4,2)]};
  assert.deepEqual(groundRoutePreviews([officer],['a'],cells('1,2','2,2','4,2')),[
    {id:'a',points:[p(1,2),p(2,2)],complete:false},
  ]);
  assert.deepEqual(groundRoutePreviews([officer],['a'],cells('1,2','4,2')),[]);
  assert.deepEqual(groundRoutePreviews([officer],['a'],cells('2,2','3,2','4,2')),[]);
});
test('fractional segments cannot cut across a shrouded corner or boundary',()=>{
  const diagonal={id:'a',...p(1.4,1.4),route:[p(1.6,1.6)]};
  assert.deepEqual(groundRoutePreviews([diagonal],['a'],cells('1,1','2,2')),[]);
  assert.equal(groundRoutePreviews([diagonal],['a'],cells('1,1','1,2','2,1','2,2'))[0].complete,true);
  const boundary={id:'a',...p(1.5,1),route:[p(1.8,1)]};
  assert.deepEqual(groundRoutePreviews([boundary],['a'],cells('2,1')),[]);
});
test('stopped routes and duplicate-only waypoints emit no preview; independent routes stay independent',()=>{
  const a={id:'a',...p(1,2),route:[p(1,2),p(2,2)]};
  const b={id:'b',...p(1,3),route:[p(2,3)]};
  const known=cells('1,2','2,2','1,3','2,3');
  assert.equal(groundRoutePreviews([a,b],['a','b'],known).length,2);
  assert.deepEqual(groundRoutePreviews([{...a,route:[]},b],['a','b'],known),[
    {id:'b',points:[p(1,3),p(2,3)],complete:true},
  ]);
  assert.deepEqual(groundRoutePreviews([{...a,route:[p(1,2)]}],['a'],known),[]);
});
