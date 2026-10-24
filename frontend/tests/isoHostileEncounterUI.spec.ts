import { test, expect } from '@playwright/test';
import { replayHostileEncounterCommands } from '../src/isoScenarioHostileCheckpoint';
import { HOSTILE_ENCOUNTER_SAVE_KEY } from '../src/isoScenarioHostileCheckpoint';
import { SCENARIO_SAVE_KEY } from '../src/isoScenarioSession';

test('opt-in hostile encounter advances visible enemies and survives F5 without touching training',async({page})=>{
 test.setTimeout(90_000);
 await page.setViewportSize({width:390,height:850});
 await page.goto('/');
 await page.getByTestId('tactical-view-missions').click();
 await expect(page.getByTestId('scenario-training-toggle')).toHaveAttribute('aria-pressed','true');
 const legacy=await page.evaluate(key=>localStorage.getItem(key),SCENARIO_SAVE_KEY);
 const before=replayHostileEncounterCommands('relay',[]).encounter.positions;
 const after=replayHostileEncounterCommands('relay',[{type:'end-turn'}]).encounter.positions;
 expect(after).not.toEqual(before);
 await page.getByTestId('scenario-hostile-toggle').click();
 await expect(page.getByTestId('scenario-hostile-toggle')).toHaveAttribute('aria-pressed','true');
 await expect(page.getByTestId('scenario-hostile-aegis')).toContainText(before.aegis);
 await expect(page.getByTestId('scenario-hostile-veil')).toContainText(before.veil);
 await page.getByTestId('scenario-end-turn').click();
 await expect(page.getByTestId('scenario-turn')).toContainText('Ronda 2');
 await expect(page.getByTestId('scenario-hostile-aegis')).toContainText(after.aegis);
 await expect(page.getByTestId('scenario-hostile-veil')).toContainText(after.veil);
 const saved=await page.evaluate(key=>localStorage.getItem(key),HOSTILE_ENCOUNTER_SAVE_KEY);
 expect(JSON.parse(saved!)).toEqual({version:2,scenarioId:'relay',actions:[{type:'end-turn'}]});
 expect(await page.evaluate(key=>localStorage.getItem(key),SCENARIO_SAVE_KEY)).toBe(legacy);
 await page.screenshot({path:'test-results/hostile-v2-turn-mobile-390.png',fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.reload();
 await page.getByTestId('tactical-view-missions').click();
 await expect(page.getByTestId('scenario-turn')).toContainText('Ronda 1');
 await page.getByTestId('scenario-hostile-toggle').click();
 await expect(page.getByTestId('scenario-turn')).toContainText('Ronda 2');
 await expect(page.getByTestId('scenario-hostile-aegis')).toContainText(after.aegis);
 await expect(page.getByTestId('scenario-hostile-veil')).toContainText(after.veil);
 await expect(page.getByTestId('scenario-notice')).toContainText('restaurado');
 await page.getByTestId('scenario-training-toggle').click();
 await expect(page.getByTestId('scenario-turn')).toContainText('Ronda 1');
 await expect(page.getByTestId('scenario-hostile-status')).toHaveCount(0);
 await page.getByTestId('scenario-hostile-toggle').click();
 await page.setViewportSize({width:1280,height:850});
 await page.screenshot({path:'test-results/hostile-v2-restored-desktop-1280.png',fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});


test('hostile walk shows all six frames, then returns to idle without altering the turn',async({page})=>{
 test.setTimeout(90_000);
 await page.setViewportSize({width:390,height:850});
 await page.goto('/');
 await page.getByTestId('tactical-view-missions').click();
 await page.getByTestId('scenario-hostile-toggle').click();
 const canvas=page.getByTestId('scenario-render-canvas');
 await expect(canvas).toBeVisible();
 await page.evaluate(()=>{
  const element=document.querySelector<HTMLCanvasElement>('[data-testid="scenario-render-canvas"]')!;
  (window as Window & {hostileSeen?:number[]}).hostileSeen=[];
  const observer=new MutationObserver(()=>{
   const value=Number(element.dataset.hostileWalkFrame);
   if(Number.isInteger(value)&&value>=0)
    (window as Window & {hostileSeen?:number[]}).hostileSeen!.push(value);
  });
  observer.observe(element,{attributes:true,attributeFilter:['data-hostile-walk-frame']});
 });
 await page.getByTestId('scenario-end-turn').click();
 await expect.poll(async()=>page.evaluate(()=>[...new Set(
  (window as Window & {hostileSeen?:number[]}).hostileSeen||[],
 )].sort()),{timeout:5_000,intervals:[50]}).toEqual([0,1,2,3,4,5]);
 await expect(canvas).toHaveAttribute('data-hostile-moving','0',{timeout:5_000});
 await expect(page.getByTestId('scenario-turn')).toContainText('Ronda 2');
 await page.screenshot({path:'test-results/hostile-animation-mobile-390.png',fullPage:true});
 await page.setViewportSize({width:1280,height:850});
 await canvas.scrollIntoViewIfNeeded();
 await expect.poll(async()=>canvas.getAttribute('data-hostile-idle-frame'),{timeout:3_000})
  .not.toBeNull();
 await page.screenshot({path:'test-results/hostile-animation-desktop-1280.png',fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('reduced-motion hostile turns snap to authoritative saved positions',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/');
 await page.getByTestId('tactical-view-missions').click();
 await page.getByTestId('scenario-hostile-toggle').click();
 const positions=replayHostileEncounterCommands('relay',[{type:'end-turn'}]).encounter.positions;
 await page.getByTestId('scenario-end-turn').click();
 await expect(page.getByTestId('scenario-turn')).toContainText('Ronda 2');
 await expect(page.getByTestId('scenario-render-canvas')).not.toHaveAttribute('data-hostile-moving','1');
 // No cosmetic interpolation may delay persistence or introduce a new turn.
 await page.reload();
 await page.getByTestId('tactical-view-missions').click();
 await page.getByTestId('scenario-hostile-toggle').click();
 await expect(page.getByTestId('scenario-turn')).toContainText('Ronda 2');
 await expect(page.getByTestId('scenario-hostile-aegis')).toContainText(positions.aegis);
 await expect(page.getByTestId('scenario-hostile-veil')).toContainText(positions.veil);
});
