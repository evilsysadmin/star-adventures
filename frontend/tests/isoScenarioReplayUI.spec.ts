import { test, expect, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { COMBAT_REPLAY_SAVE_KEY, replayCombatCommands } from '../src/isoScenarioCombatReplay';
import { combatMissionReport } from '../src/isoScenarioCombatMissionReport';
import { missionPath, type SquadId } from '../src/isoScenarioCampaign';
import { COMBAT_ENCOUNTER_SAVE_KEY } from '../src/isoScenarioCombatCheckpoint';
import { HOSTILE_ENCOUNTER_SAVE_KEY } from '../src/isoScenarioHostileCheckpoint';
import { SCENARIO_SAVE_KEY } from '../src/isoScenarioSession';

async function choose(page: Page, cell: string) {
 await page.getByRole('button', { name: 'Casilla ' + cell, exact: true }).click();
 await expect(page.getByTestId('scenario-selected')).toHaveText(cell);
}
async function target(page: Page, id: 'aegis'|'veil') {
 const chip=page.getByTestId('scenario-hostile-'+id);
 const label=await chip.textContent();
 const cell=label?.match(/\b\d+:\d+\b/)?.[0];
 expect(cell).toBeTruthy();
 await expect(chip).toBeEnabled();
 await chip.click();
 await expect(page.getByTestId('scenario-selected')).toHaveText(cell!);
 await expect(chip).toHaveAttribute('aria-pressed','true');
}
async function completeObjectives(page: Page) {
 const state=async()=>{
  const raw=await page.evaluate(key=>localStorage.getItem(key),COMBAT_REPLAY_SAVE_KEY);
  if(!raw)throw new Error('Expected persisted v4 replay');
  const checkpoint=JSON.parse(raw);
  return replayCombatCommands(checkpoint.scenarioId,checkpoint.actions).combat.encounter.mission;
 };
 const order=async(testId:string)=>{
  if((await state()).ap===0){
   await expect(page.getByTestId('scenario-end-turn')).toBeEnabled();
   await page.getByTestId('scenario-end-turn').click();
  }
  await expect(page.getByTestId(testId)).toBeEnabled();
  await page.getByTestId(testId).click();
 };
 const travel=async(officer:SquadId,destination:string)=>{
  await page.getByTestId('scenario-unit-'+officer).click();
  for(let i=0;i<30;i++){
   const route=missionPath(await state(),officer,destination);
   expect(route,'Objective destination must be reachable').not.toBeNull();
   if(route!.length===1)return;
   await choose(page,route![Math.min(5,route!.length-1)]);
   await order('scenario-move');
  }
  throw new Error('Objective travel exceeded 30 orders');
 };
 await travel('science','9:1');
 await order('scenario-scan');
 await travel('security','9:7');
 await order('scenario-operate');
 await travel('security','9:9');
 await order('scenario-extract');
}

for(const width of [390,1280]){
 test('v4 tactical fire, victory and F5 restore at '+width+'px',async ({page})=>{
  test.setTimeout(180_000);
  await page.setViewportSize({width,height:850});
  await page.goto('/');
  await page.getByTestId('tactical-view-missions').click();
  const legacy=await page.evaluate(keys=>keys.map(key=>localStorage.getItem(key)),
   [SCENARIO_SAVE_KEY,HOSTILE_ENCOUNTER_SAVE_KEY,COMBAT_ENCOUNTER_SAVE_KEY]);
  await expect(page.getByTestId('scenario-play-combat')).toBeVisible();
  await page.getByTestId('scenario-play-combat').click();
  await expect(page.getByTestId('scenario-replay-toggle')).toHaveAttribute('aria-pressed','true');
  await expect(page.getByTestId('scenario-fire-guide')).toContainText('Para disparar');
  await expect(page.getByTestId('scenario-fire')).toBeDisabled();
  await page.getByTestId('scenario-accessible-grid').locator('summary').click();
  await page.getByTestId('scenario-unit-security').click();
  await choose(page,'3:7');
  await page.getByTestId('scenario-move').click();
  await choose(page,'5:6');
  await page.getByTestId('scenario-move').click();
  await target(page,'aegis');
  await expect(page.getByTestId('scenario-fire')).toBeEnabled();
  const canvas=page.getByTestId('scenario-render-canvas');
  const [boardRect,fireRect]=await Promise.all([
   canvas.boundingBox(),page.getByTestId('scenario-fire').boundingBox(),
  ]);
  expect(boardRect).not.toBeNull();
  // On narrow screens the board must not become a tiny island inside a tall
  // empty canvas. Keep the entire board visible and the fire control in-frame.
  if(width===390){
   expect(boardRect!.height).toBeGreaterThanOrEqual(330);
   expect(boardRect!.height).toBeLessThanOrEqual(391);
  }
  expect(fireRect).not.toBeNull();
  expect(fireRect!.x).toBeGreaterThanOrEqual(boardRect!.x);
  expect(fireRect!.y).toBeGreaterThanOrEqual(boardRect!.y);
  expect(fireRect!.x+fireRect!.width).toBeLessThanOrEqual(boardRect!.x+boardRect!.width);
  expect(fireRect!.y+fireRect!.height).toBeLessThanOrEqual(boardRect!.y+boardRect!.height);
  // Capture the WebGL buffer synchronously after each rendered frame. A
  // Playwright screenshot can take longer than the entire tracer animation
  // on software-rendered CI and accidentally photograph the impact instead.
  await page.evaluate(()=>{
   const element=document.querySelector<HTMLCanvasElement>('[data-testid="scenario-render-canvas"]')!;
   const state=window as Window & {
    shotFrames?:{travel?:string;impact?:string;phases:string[]};
   };
   state.shotFrames={phases:[]};
   let travelFrames=0;
   const observer=new MutationObserver(()=>{
    const phase=element.dataset.shotPhase??'';
    if(element.dataset.shotSequence!=='1')return;
    state.shotFrames!.phases.push(phase);
    // The initial travel notification may precede the first animation frame.
    if(phase==='travel'&&++travelFrames>=2&&!state.shotFrames!.travel)
     state.shotFrames!.travel=element.toDataURL('image/png');
    if(phase==='impact'&&!state.shotFrames!.impact)
     state.shotFrames!.impact=element.toDataURL('image/png');
    if(state.shotFrames!.travel&&state.shotFrames!.impact)observer.disconnect();
   });
   observer.observe(element,{attributes:true,attributeFilter:['data-shot-phase']});
  });
  await page.getByTestId('scenario-fire').click();
  await expect(canvas).toHaveAttribute('data-shot-sequence','1');
  await expect(canvas).toHaveAttribute('data-shot-from','5:6');
  await expect(canvas).toHaveAttribute('data-shot-to','6:6');
  // Both frames must belong to the FIRST accepted shot, not a later phase
  // mislabeled by an asynchronous screenshot.
  await expect.poll(async()=>page.evaluate(()=>(window as Window & {
   shotFrames?:{travel?:string;impact?:string};
  }).shotFrames?.impact??null),{timeout:5000}).not.toBeNull();
  const frames=await page.evaluate(()=>(window as Window & {
   shotFrames?:{travel?:string;impact?:string;phases:string[]};
  }).shotFrames!);
  expect(frames.phases).toContain('travel');
  expect(frames.phases).toContain('impact');
  expect(frames.travel,'Must capture an actual travel frame').toMatch(/^data:image\\/png;base64,/);
  expect(frames.impact,'Must capture an actual impact frame').toMatch(/^data:image\\/png;base64,/);
  expect(frames.travel).not.toEqual(frames.impact);
  for(const phase of ['travel','impact'] as const){
   const png=Buffer.from(frames[phase]!.split(',')[1],'base64');
   expect(png.byteLength,'Canvas frame should contain real rendered pixels').toBeGreaterThan(10_000);
   await writeFile('test-results/combat-v4-shot-'+phase+'-'+width+'.png',png);
  }
  await page.screenshot({path:'test-results/combat-v4-shot-post-'+width+'.png',fullPage:true});
  await expect(page.getByTestId('scenario-hostile-aegis')).toContainText('PV 1/2');
  await page.getByTestId('scenario-end-turn').click();
  await target(page,'aegis');
  await page.getByTestId('scenario-fire').click();
  await expect(canvas).toHaveAttribute('data-shot-sequence','2');
  await expect(page.getByTestId('scenario-hostile-aegis')).toContainText('PV 0/2');
  await expect(page.getByTestId('scenario-hostile-aegis')).toBeDisabled();
  await target(page,'veil');
  await page.getByTestId('scenario-fire').click();
  await target(page,'veil');
  await page.getByTestId('scenario-fire').click();
  await expect(page.getByTestId('scenario-combat-result')).toContainText('Amenazas neutralizadas');
  await expect(page.getByTestId('scenario-end-turn')).toBeEnabled();
  await expect(page.getByTestId('scenario-fire')).toBeDisabled();
  const saved=await page.evaluate(key=>localStorage.getItem(key),COMBAT_REPLAY_SAVE_KEY);
  expect(JSON.parse(saved!)).toMatchObject({version:4,scenarioId:'relay'});
  expect(JSON.parse(saved!).actions).toHaveLength(7);
  expect(await page.evaluate(keys=>keys.map(key=>localStorage.getItem(key)),
   [SCENARIO_SAVE_KEY,HOSTILE_ENCOUNTER_SAVE_KEY,COMBAT_ENCOUNTER_SAVE_KEY])).toEqual(legacy);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/combat-v4-victory-'+width+'.png',fullPage:true});
  await page.reload();
  await page.getByTestId('tactical-view-missions').click();
  await page.getByTestId('scenario-replay-toggle').click();
  await expect(page.getByTestId('scenario-notice')).toContainText('restaurado');
  await expect(page.getByTestId('scenario-combat-result')).toContainText('Amenazas neutralizadas');
  await expect(page.getByTestId('scenario-hostile-veil')).toContainText('PV 0/2');
  await expect(page.getByTestId('scenario-end-turn')).toBeEnabled();
  await page.getByTestId('scenario-accessible-grid').locator('summary').click();
  await completeObjectives(page);
  await expect(page.getByTestId('scenario-combat-result')).toContainText('Extracción confirmada');
  await expect(page.getByTestId('scenario-combat-result')).not.toContainText('Amenazas neutralizadas');
  await expect(page.getByTestId('scenario-end-turn')).toBeDisabled();
  await expect(page.getByTestId('scenario-fire')).toBeDisabled();
  const extracted=JSON.parse((await page.evaluate(key=>localStorage.getItem(key),COMBAT_REPLAY_SAVE_KEY))!);
  const report=combatMissionReport({scenarioId:'relay',actions:extracted.actions});
  expect(report.status).toBe('mission-extracted');
  expect(report.objectives).toEqual({scanned:true,operated:true,rescued:false,extracted:true});
  expect(report.enemyTurns).toBe(1);
  expect(await page.evaluate(keys=>keys.map(key=>localStorage.getItem(key)),
   [SCENARIO_SAVE_KEY,HOSTILE_ENCOUNTER_SAVE_KEY,COMBAT_ENCOUNTER_SAVE_KEY])).toEqual(legacy);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/combat-v4-extracted-'+width+'.png',fullPage:true});
  await page.reload();
  await page.getByTestId('tactical-view-missions').click();
  await page.getByTestId('scenario-replay-toggle').click();
  await expect(page.getByTestId('scenario-combat-result')).toContainText('Extracción confirmada');
  await expect(page.getByTestId('scenario-end-turn')).toBeDisabled();
  await page.getByTestId('scenario-combat-retry').click();
  await expect(page.getByTestId('scenario-hostile-veil')).toContainText('PV 2/2');
  await expect(page.getByTestId('scenario-combat-result')).toHaveCount(0);
  await page.getByTestId('scenario-combat-toggle').click();
  await expect(page.getByTestId('scenario-hostile-aegis')).toHaveJSProperty('tagName','SPAN');
 });
}
