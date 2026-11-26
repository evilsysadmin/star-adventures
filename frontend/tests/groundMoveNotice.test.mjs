import test from 'node:test';
import assert from 'node:assert/strict';
import {groundRealtimeMoveNotice,groundMoveTargetLabel} from '../src/groundMoveNotice.ts';
test('solo order reports arrival independently of other officers',()=>{
 const notice='Nara en marcha hacia 3.0:5.0';
 assert.equal(groundRealtimeMoveNotice(notice,['venn'],['venn','mira']),notice);
 assert.equal(groundRealtimeMoveNotice(notice,['venn'],['mira']),'Nara ha llegado a 3.0:5.0');
});
test('a formation remains moving until every member of that order arrives',()=>{
 const notice='Formación de 2 oficiales en marcha hacia 2.0:5.0';
 assert.equal(groundRealtimeMoveNotice(notice,['venn','dorn'],['dorn','mira']),notice);
 assert.equal(groundRealtimeMoveNotice(notice,['venn','dorn'],['mira']),'Formación de 2 oficiales ha llegado a 2.0:5.0');
 assert.equal(groundRealtimeMoveNotice(notice,[],[]),notice);
 assert.equal(groundRealtimeMoveNotice('Casilla bloqueada',['venn'],[]),'Casilla bloqueada');
});
test('show actual rounded formation anchor, keep solo fractional target',()=>{
 assert.equal(groundMoveTargetLabel({x:2.2,y:5.1},3),'2.0:5.0');
 assert.equal(groundMoveTargetLabel({x:2.7,y:5.6},2),'3.0:6.0');
 assert.equal(groundMoveTargetLabel({x:2.2,y:5.1},1),'2.2:5.1');
});
