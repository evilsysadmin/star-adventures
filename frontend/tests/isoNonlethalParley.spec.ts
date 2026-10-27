import { test, expect } from '@playwright/test';

// P0: an actual third option, not a decorative dialog or fake choice.
// Security must reach a living contact without firing; a ceasefire consumes
// the final order and stops subsequent enemy turns while objectives remain.
for (const width of [390, 1280]) {
 test(`nonlethal contact and ceasefire survive a real mission turn at ${width}px`, async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width, height: 850 });
  await page.goto('/');
  await page.getByTestId('tactical-view-missions').click();
  await page.getByTestId('scenario-play-combat').click();
  const canvas = page.getByTestId('scenario-render-canvas');
  await expect(canvas).toBeVisible();
  await expect(page.getByTestId('scenario-parley')).toBeDisabled();
  await page.getByTestId('scenario-unit-security').click();
  const grid = page.getByTestId('scenario-accessible-grid');
  await grid.locator('summary').click();
  for (const destination of ['3:7', '5:7']) {
   await page.getByRole('button', { name: 'Casilla ' + destination, exact: true }).click();
   await expect(page.getByTestId('scenario-move')).toBeEnabled();
   await page.getByTestId('scenario-move').click();
  }
  await expect(page.getByTestId('scenario-unit-security')).toContainText('5:7');
  await expect(page.getByTestId('scenario-parley')).toBeEnabled();
  await page.getByTestId('scenario-parley').click();
  await expect(page.getByTestId('scenario-truce')).toContainText('Alto el fuego aceptado');
  await expect(page.getByTestId('scenario-hostile-status')).toContainText('EN TREGUA');
  const pacifiedContacts = await page.getByTestId('scenario-hostile-status').locator('button').allTextContents();
  await expect(page.getByTestId('scenario-combat-result')).toContainText('Alto el fuego acordado');
  await expect(page.getByTestId('scenario-fire')).toBeDisabled();
  await expect(page.getByTestId('scenario-ap')).toContainText('0 / 3');
  await canvas.screenshot({ path: `test-results/nonlethal-parley-board-${width}.png` });
  await page.screenshot({ path: `test-results/nonlethal-parley-full-${width}.png`, fullPage: true });
  await page.getByTestId('scenario-end-turn').click();
  await expect(page.getByTestId('scenario-turn')).toContainText('Ronda 2');
  await expect(page.getByTestId('scenario-hostile-status').locator('button')).toHaveText(pacifiedContacts);
  await expect(page.getByTestId('scenario-hp-security')).toHaveText('PV 3 / 3');
  await expect(canvas).not.toHaveAttribute('data-hostile-moving', '1');
  await page.reload();
  await page.getByTestId('tactical-view-missions').click();
  await page.getByTestId('scenario-replay-toggle').click();
  await expect(page.getByTestId('scenario-truce')).toBeVisible();
  await expect(page.getByTestId('scenario-turn')).toContainText('Ronda 2');
  await expect(page.getByTestId('scenario-hostile-status').locator('button')).toHaveText(pacifiedContacts);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
 });
}
