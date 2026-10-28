// Historical variants remain available only under explicit QA tools.
async function chooseLegacyMode(page: import('@playwright/test').Page, id:string){
 const details=page.getByTestId('scenario-mode-advanced');
 if((await details.getAttribute('open'))===null)
  await details.locator('summary').click();
 await page.getByTestId(id).click();
}

import { test, expect } from '@playwright/test';

// The playable combat loop must keep BOTH decisive turn actions at the board:
// firing was already in-scene, but recovering AP previously required a long
// scroll to a separate command row. Prove real turn progression and geometry.
for (const width of [360, 390, 1280]) {
 test(`live combat can end a real turn without leaving the board (${width}px)`, async ({ page }) => {
  await page.setViewportSize({ width, height: 850 });
  await page.goto('/');
  await page.getByTestId('tactical-view-missions').click();
  await page.getByTestId('scenario-play-combat').click();

  const board = page.getByTestId('scenario-keyboard');
  const canvas = page.getByTestId('scenario-render-canvas');
  const endTurn = page.getByTestId('scenario-end-turn');
  const fire = page.getByTestId('scenario-fire');
  await expect(canvas).toBeVisible();
  await expect(endTurn).toBeEnabled();
  await expect(endTurn).toHaveClass(/scenario-turn-overlay/);
  await expect(fire).toBeVisible();
  expect(await endTurn.count()).toBe(1);

  const [scene, turn, shot] = await Promise.all([
   canvas.boundingBox(), endTurn.boundingBox(), fire.boundingBox(),
  ]);
  expect(scene && turn && shot).toBeTruthy();
  for (const button of [turn!, shot!]) {
   expect(button.width).toBeGreaterThanOrEqual(44);
   expect(button.height).toBeGreaterThanOrEqual(44);
   expect(button.x).toBeGreaterThanOrEqual(scene!.x - 1);
   expect(button.x + button.width).toBeLessThanOrEqual(scene!.x + scene!.width + 1);
   expect(button.y).toBeGreaterThanOrEqual(scene!.y - 1);
   expect(button.y + button.height).toBeLessThanOrEqual(scene!.y + scene!.height + 1);
  }
  expect(turn!.x + turn!.width + 8).toBeLessThan(shot!.x);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await board.screenshot({ path: `test-results/combat-turn-at-board-before-${width}.png` });
  await endTurn.click();
  await expect(page.getByTestId('scenario-turn')).toContainText('Ronda 2');
  await expect(page.getByTestId('scenario-ap')).toContainText('3 / 3');
  await expect(page.getByTestId('scenario-notice')).toContainText('Turno 2');
  await board.screenshot({ path: `test-results/combat-turn-at-board-after-${width}.png` });

  // Only the playable v4 firefight moves End Turn into the scene. Legacy
  // training retains the original action row and never gets duplicate buttons.
  await chooseLegacyMode(page,'scenario-training-toggle');
  await expect(page.getByTestId('scenario-end-turn')).toHaveCount(1);
  await expect(page.getByTestId('scenario-end-turn')).not.toHaveClass(/scenario-turn-overlay/);
  await expect(page.locator('.scenario-orders').getByTestId('scenario-end-turn')).toBeVisible();
 });
}
