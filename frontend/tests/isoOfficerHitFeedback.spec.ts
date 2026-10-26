import { test, expect } from '@playwright/test';
import { replayCombatCommands, type CombatReplayAction } from '../src/isoScenarioCombatReplay';

// A real accepted enemy end-turn (not a synthetic DOM event) must animate the
// actual wounded officer and return them to rest. F5 restores HP, not the hit.
for (const width of [390, 1280]) {
 test(`wounded officer plays authored hit clip and visible impact ring at ${width}px`, async ({page}) => {
  test.setTimeout(100_000);
  await page.setViewportSize({width,height:850});
  await page.goto('/');
  await page.getByTestId('tactical-view-missions').click();
  await page.getByTestId('scenario-play-combat').click();
  const canvas=page.getByTestId('scenario-render-canvas');
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('data-officer-hit-atlases-ready','3',{timeout:25_000});

  const commands:CombatReplayAction[]=[];
  let state=replayCombatCommands('relay',commands);
  while(commands.length<60 && state.combat.encounter.hits.length===0){
   commands.push({type:'end-turn'});
   state=replayCombatCommands('relay',commands);
  }
  const hits=state.combat.encounter.hits;
  expect(hits.length,'relay encounter must have a real enemy retaliation').toBeGreaterThan(0);
  for(const command of commands){
   expect(command.type).toBe('end-turn');
   await page.getByTestId('scenario-end-turn').click();
  }
  const wounded=[...new Set(hits.map(hit=>hit.officer))].join(',');
  await expect(canvas).toHaveAttribute('data-squad-hit-units',wounded,{timeout:2500});
  await expect(canvas).toHaveAttribute('data-squad-hit-frame',/^[0-5]$/);
  await canvas.screenshot({path:`test-results/officer-hit-canvas-${width}.png`});
  await page.screenshot({path:`test-results/officer-hit-page-${width}.png`,fullPage:true});
  for(const id of ['science','security','medic'] as const)
   await expect(page.getByTestId('scenario-hp-'+id)).toHaveText(
    `PV ${state.combat.encounter.health[id]} / 3`);
  await expect(canvas).not.toHaveAttribute('data-squad-hit-units',/./,{timeout:5000});
  await page.reload();
  await page.getByTestId('tactical-view-missions').click();
  await page.getByTestId('scenario-play-combat').click();
  await expect(page.getByTestId('scenario-render-canvas')).not.toHaveAttribute('data-squad-hit-units',/./);
  for(const id of ['science','security','medic'] as const)
   await expect(page.getByTestId('scenario-hp-'+id)).toHaveText(
    `PV ${state.combat.encounter.health[id]} / 3`);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}
