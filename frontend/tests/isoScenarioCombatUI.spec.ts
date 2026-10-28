// Historical variants remain available only under explicit QA tools.
async function chooseLegacyMode(page: import('@playwright/test').Page, id:string){
 const details=page.getByTestId('scenario-mode-advanced');
 if((await details.getAttribute('open'))===null)
  await details.locator('summary').click();
 await page.getByTestId(id).click();
}

import { test, expect } from '@playwright/test';
import { replayCombatEncounterCommands, COMBAT_ENCOUNTER_SAVE_KEY } from '../src/isoScenarioCombatCheckpoint';
import { SCENARIO_SAVE_KEY } from '../src/isoScenarioSession';
import { HOSTILE_ENCOUNTER_SAVE_KEY } from '../src/isoScenarioHostileCheckpoint';

test('opt-in v3 combat displays real wounds and defeat, restores F5 and isolates older saves', async ({ page }) => {
 test.setTimeout(90_000);
 await page.setViewportSize({ width: 390, height: 850 });
 await page.goto('/');
 await page.getByTestId('tactical-view-missions').click();
 const oldTraining = await page.evaluate(key => localStorage.getItem(key), SCENARIO_SAVE_KEY);
 const oldHostile = await page.evaluate(key => localStorage.getItem(key), HOSTILE_ENCOUNTER_SAVE_KEY);
 await chooseLegacyMode(page,'scenario-combat-toggle');
 await expect(page.getByTestId('scenario-combat-toggle')).toHaveAttribute('aria-pressed', 'true');
 // Compact main screen has one game mode; QA variants open on demand.
 await expect(page.getByTestId('scenario-primary-mode')).toContainText('pruebas');
 const modeBoxes = await Promise.all(['scenario-training-toggle','scenario-hostile-toggle','scenario-combat-toggle','scenario-replay-toggle']
  .map(id => page.getByTestId(id).boundingBox()));
 expect(modeBoxes.every(Boolean)).toBe(true);
 // Four opt-in labs use two balanced rows on narrow touch screens.
 expect(Math.abs(modeBoxes[0]!.y-modeBoxes[1]!.y)).toBeLessThan(3);
 expect(Math.abs(modeBoxes[2]!.y-modeBoxes[3]!.y)).toBeLessThan(3);
 expect(modeBoxes[2]!.y).toBeGreaterThan(modeBoxes[0]!.y+40);
 expect(modeBoxes.every(box=>box!.height>=44)).toBe(true);

 await expect(page.getByTestId('scenario-hp-medic')).toHaveText('PV 3 / 3');
 const actions: { type: 'end-turn' }[] = [];
 let expected = replayCombatEncounterCommands('relay', actions).encounter;
 for (let i = 0; i < 60 && !expected.hits.length; i++) {
  actions.push({ type: 'end-turn' });
  expected = replayCombatEncounterCommands('relay', actions).encounter;
  await page.getByTestId('scenario-end-turn').click();
 }
 expect(expected.hits.length).toBeGreaterThan(0);
 for (const id of ['science', 'security', 'medic'] as const)
  await expect(page.getByTestId('scenario-hp-' + id)).toHaveText('PV ' + expected.health[id] + ' / 3');
 expect(JSON.parse((await page.evaluate(key => localStorage.getItem(key), COMBAT_ENCOUNTER_SAVE_KEY))!))
  .toEqual({ version: 3, scenarioId: 'relay', actions });
 expect(await page.evaluate(key => localStorage.getItem(key), SCENARIO_SAVE_KEY)).toBe(oldTraining);
 expect(await page.evaluate(key => localStorage.getItem(key), HOSTILE_ENCOUNTER_SAVE_KEY)).toBe(oldHostile);
 await page.screenshot({ path: 'test-results/combat-v3-wounds-mobile-390.png', fullPage: true });
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
 await page.reload();
 await page.getByTestId('tactical-view-missions').click();
 await chooseLegacyMode(page,'scenario-combat-toggle');
 await expect(page.getByTestId('scenario-notice')).toContainText('restaurado');
 for (const id of ['science', 'security', 'medic'] as const)
  await expect(page.getByTestId('scenario-hp-' + id)).toHaveText('PV ' + expected.health[id] + ' / 3');
 for (let i = 0; i < 60 && !expected.failed; i++) {
  actions.push({ type: 'end-turn' });
  expected = replayCombatEncounterCommands('relay', actions).encounter;
  await page.getByTestId('scenario-end-turn').click();
 }
 expect(expected.failed).toBe(true);
 await expect(page.getByTestId('scenario-combat-result')).toContainText('Escuadra incapacitada');
 await expect(page.getByTestId('scenario-end-turn')).toBeDisabled();
 await page.reload();
 await page.getByTestId('tactical-view-missions').click();
 await chooseLegacyMode(page,'scenario-combat-toggle');
 await expect(page.getByTestId('scenario-combat-result')).toContainText('Escuadra incapacitada');
 await page.setViewportSize({ width: 1280, height: 850 });
 await page.screenshot({ path: 'test-results/combat-v3-defeat-desktop-1280.png', fullPage: true });
 await page.getByTestId('scenario-combat-retry').click();
 await expect(page.getByTestId('scenario-hp-medic')).toHaveText('PV 3 / 3');
 await expect(page.getByTestId('scenario-combat-result')).toHaveCount(0);
 await chooseLegacyMode(page,'scenario-training-toggle');
 await expect(page.getByTestId('scenario-hp-medic')).toHaveCount(0);
});
