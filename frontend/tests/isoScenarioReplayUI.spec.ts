import { test, expect, type Page } from '@playwright/test';
import { COMBAT_REPLAY_SAVE_KEY } from '../src/isoScenarioCombatReplay';
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
for(const width of [390,1280]){
 test('v4 tactical fire, victory and F5 restore at '+width+'px',async ({page})=>{
  test.setTimeout(120_000);
  await page.setViewportSize({width,height:850});
  await page.goto('/');
  await page.getByTestId('tactical-view-missions').click();
  const legacy=await page.evaluate(keys=>keys.map(key=>localStorage.getItem(key)),
   [SCENARIO_SAVE_KEY,HOSTILE_ENCOUNTER_SAVE_KEY,COMBAT_ENCOUNTER_SAVE_KEY]);
  await page.getByTestId('scenario-replay-toggle').click();
  await expect(page.getByTestId('scenario-replay-toggle')).toHaveAttribute('aria-pressed','true');
  await expect(page.getByTestId('scenario-fire')).toBeDisabled();
  await page.getByTestId('scenario-accessible-grid').locator('summary').click();
  await page.getByTestId('scenario-unit-security').click();
  await choose(page,'3:7');
  await page.getByTestId('scenario-move').click();
  await choose(page,'5:6');
  await page.getByTestId('scenario-move').click();
  await target(page,'aegis');
  await expect(page.getByTestId('scenario-fire')).toBeEnabled();
  await page.getByTestId('scenario-fire').click();
  await expect(page.getByTestId('scenario-hostile-aegis')).toContainText('PV 1/2');
  await page.getByTestId('scenario-end-turn').click();
  await target(page,'aegis');
  await page.getByTestId('scenario-fire').click();
  await expect(page.getByTestId('scenario-hostile-aegis')).toContainText('PV 0/2');
  await expect(page.getByTestId('scenario-hostile-aegis')).toBeDisabled();
  await target(page,'veil');
  await page.getByTestId('scenario-fire').click();
  await target(page,'veil');
  await page.getByTestId('scenario-fire').click();
  await expect(page.getByTestId('scenario-combat-result')).toContainText('Victoria');
  await expect(page.getByTestId('scenario-end-turn')).toBeDisabled();
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
  await expect(page.getByTestId('scenario-combat-result')).toContainText('Victoria');
  await expect(page.getByTestId('scenario-hostile-veil')).toContainText('PV 0/2');
  await page.getByTestId('scenario-combat-retry').click();
  await expect(page.getByTestId('scenario-hostile-veil')).toContainText('PV 2/2');
  await expect(page.getByTestId('scenario-combat-result')).toHaveCount(0);
  await page.getByTestId('scenario-combat-toggle').click();
  await expect(page.getByTestId('scenario-hostile-aegis')).toHaveJSProperty('tagName','SPAN');
 });
}
