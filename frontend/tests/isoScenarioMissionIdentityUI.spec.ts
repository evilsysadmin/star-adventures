// Historical variants remain available only under explicit QA tools.
async function chooseLegacyMode(page: import('@playwright/test').Page, id:string){
 const details=page.getByTestId('scenario-mode-advanced');
 if((await details.getAttribute('open'))===null)
  await details.locator('summary').click();
 await page.getByTestId(id).click();
}

import { test, expect } from '@playwright/test';
import { COMBAT_REPLAY_SAVE_KEY } from '../src/isoScenarioCombatReplay';
import { COMBAT_MISSION_INSTANCE_SAVE_KEY } from '../src/isoScenarioCombatMissionInstanceSession';

for (const width of [390, 1280]) {
 test('explicit v4 mission IDs survive F5 and rotate only on restart at ' + width + 'px', async ({ page }) => {
  await page.setViewportSize({ width, height: 850 });
  await page.goto('/');
  // The shared fixture may contain a legacy replay; isolate this test.
  await page.evaluate(keys => keys.forEach(key => localStorage.removeItem(key)),
   [COMBAT_REPLAY_SAVE_KEY, COMBAT_MISSION_INSTANCE_SAVE_KEY]);
  await page.reload();
  await page.getByTestId('tactical-view-missions').click();
  await chooseLegacyMode(page,'scenario-replay-toggle');
  // Merely entering the replay view must not mint an ID for old saves.
  expect(await page.evaluate(key => localStorage.getItem(key), COMBAT_MISSION_INSTANCE_SAVE_KEY)).toBeNull();
  await page.getByTestId('scenario-tab-relay').click();
  const read = () => page.evaluate(keys => ({
   replay: JSON.parse(localStorage.getItem(keys[0])!),
   identity: JSON.parse(localStorage.getItem(keys[1])!),
  }), [COMBAT_REPLAY_SAVE_KEY, COMBAT_MISSION_INSTANCE_SAVE_KEY]);
  const started = await read();
  expect(started.replay).toEqual({ version: 4, scenarioId: 'relay', actions: [] });
  expect(started.identity.version).toBe(1);
  expect(started.identity.instanceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  expect(JSON.parse(started.identity.checkpoint)).toEqual(started.replay);
  await page.getByTestId('scenario-end-turn').click();
  const advanced = await read();
  expect(advanced.identity.instanceId).toBe(started.identity.instanceId);
  expect(JSON.parse(advanced.identity.checkpoint)).toEqual(advanced.replay);
  expect(advanced.replay.actions).toEqual([{ type: 'end-turn' }]);
  await page.reload();
  await page.getByTestId('tactical-view-missions').click();
  await chooseLegacyMode(page,'scenario-replay-toggle');
  const restored = await read();
  expect(restored.identity.instanceId).toBe(started.identity.instanceId);
  expect(JSON.parse(restored.identity.checkpoint)).toEqual(restored.replay);
  await page.getByTestId('scenario-end-turn').click();
  const continued = await read();
  expect(continued.identity.instanceId).toBe(started.identity.instanceId);
  expect(continued.replay.actions).toHaveLength(2);
  expect(JSON.parse(continued.identity.checkpoint)).toEqual(continued.replay);
  await page.getByTestId('scenario-tab-relay').click();
  const restarted = await read();
  expect(restarted.identity.instanceId).not.toBe(started.identity.instanceId);
  expect(JSON.parse(restarted.identity.checkpoint)).toEqual(restarted.replay);
  expect(restarted.replay.actions).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
 });
}
