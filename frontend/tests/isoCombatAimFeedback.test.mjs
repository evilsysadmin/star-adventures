import test from 'node:test';
import assert from 'node:assert/strict';
import { compactCombatFireLabel, describeCombatAim } from '../src/isoCombatAimFeedback.ts';
import { evaluateCombatAim } from '../src/isoScenarioCombatAim.ts';
import { replayCombatEncounter } from '../src/isoScenarioCombatEncounter.ts';

test('aim feedback explains the real range and cover blockers from a live encounter',()=>{
 const initial=replayCombatEncounter('relay',[]);
 const far=evaluateCombatAim(initial,'science','veil');
 assert.equal(far.reason,'out-of-range');
 assert.match(describeCombatAim(far),/Fuera de alcance/);
 const blocked=evaluateCombatAim(initial,'security','aegis');
 assert.equal(blocked.reason,'terrain-blocked');
 assert.ok(blocked.blocker);
 assert.ok(describeCombatAim(blocked).includes(blocked.blocker));
 assert.match(describeCombatAim(blocked),/cobertura o muro/);
});
test('feedback distinguishes clear shots, intervening actors, AP and defeat',()=>{
 const initial=replayCombatEncounter('relay',[]);
 const near={...initial,mission:{...initial.mission,locations:{...initial.mission.locations,security:'7:5'}}};
 assert.match(describeCombatAim(evaluateCombatAim(near,'security','veil')),/línea despejada/);
 const blocked=evaluateCombatAim(initial,'security','aegis');
 assert.match(describeCombatAim({...blocked,reason:'ally-blocked',blocker:'3:3'}),/compañero.*3:3/);
 assert.match(describeCombatAim({...blocked,reason:'contact-blocked',blocker:'6:6'}),/Otro enemigo.*6:6/);
 assert.match(describeCombatAim(evaluateCombatAim({...near,mission:{...near.mission,ap:0}},'security','veil')),/Sin órdenes/);
 assert.match(describeCombatAim(evaluateCombatAim({...near,failed:true},'security','veil')),/terminado/);
 assert.match(describeCombatAim(null),/Selecciona/);
});

test('in-board fire control names real blockers without pretending a shot is available',()=>{
 const initial=replayCombatEncounter('relay',[]);
 const blocked=evaluateCombatAim(initial,'security','aegis');
 assert.equal(blocked.reason,'terrain-blocked');
 assert.equal(compactCombatFireLabel(blocked,'aegis',false),'COBERTURA · '+blocked.blocker);
 assert.equal(compactCombatFireLabel(evaluateCombatAim(initial,'science','veil'),'veil',false),'FUERA DE ALCANCE');
 assert.equal(compactCombatFireLabel({...blocked,reason:'ally-blocked'},'aegis',false),'ALIADO EN LÍNEA');
 assert.equal(compactCombatFireLabel({...blocked,reason:'contact-blocked'},'aegis',false),'ENEMIGO EN LÍNEA');
 assert.equal(compactCombatFireLabel({...blocked,reason:'no-action-points'},'aegis',false),'SIN ÓRDENES');
 assert.equal(compactCombatFireLabel({...blocked,reason:'ready',allowed:true},'aegis',false),'ORDEN NO DISPONIBLE');
 assert.equal(compactCombatFireLabel({...blocked,reason:'ready',allowed:true},'aegis',true),'DISPARAR · aegis');
 assert.equal(compactCombatFireLabel(null,null,false),'APUNTAR · elige enemigo');
 assert.equal(compactCombatFireLabel(blocked,'aegis',false,true),'ALTO EL FUEGO');
});
