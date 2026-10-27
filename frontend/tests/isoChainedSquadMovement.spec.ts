import { test, expect } from '@playwright/test';

// Two valid orders may be issued while the first visual route is still being
// painted. The character must finish both BFS routes, not jump to the first
// order's logical destination when the second order arrives.
for (const width of [390, 1280]) {
 test(`consecutive orders retain the visible squad route at ${width}px`, async ({ page }) => {
  test.setTimeout(55_000);
  await page.setViewportSize({ width, height: 850 });
  await page.goto('/');
  await page.getByTestId('tactical-view-missions').click();
  const canvas = page.getByTestId('scenario-render-canvas');
  await expect(canvas).toBeVisible();

  // Slow only rAF's reported timestamps, not user input or the game reducer.
  // This makes the second command reliably arrive during the first walk,
  // even on a busy CI worker, without changing the legal path or AP.
  await canvas.evaluate(() => {
   const original = window.requestAnimationFrame.bind(window);
   let origin: number | null = null;
   window.requestAnimationFrame = callback => original(timestamp => {
    origin ??= timestamp;
    callback(origin + (timestamp - origin) * .12);
   });
  });

  const grid = page.getByTestId('scenario-accessible-grid');
  await grid.locator('summary').click();
  await page.getByRole('button', { name: 'Casilla 3:1' }).click();
  await expect(page.getByTestId('scenario-route')).toContainText('Ruta: 2 pasos');
  await page.getByTestId('scenario-move').click();
  await expect(canvas).toHaveAttribute('data-squad-moving', '1');
  await expect(page.getByTestId('scenario-unit-science')).toContainText('3:1');

  await page.getByRole('button', { name: 'Casilla 3:2' }).click();
  await expect(page.getByTestId('scenario-route')).toContainText('Ruta: 1 pasos');
  await page.getByTestId('scenario-move').click();
  await expect(page.getByTestId('scenario-unit-science')).toContainText('3:2');
  await expect(page.getByTestId('scenario-ap')).toContainText('1 / 3');
  await expect(canvas).toHaveAttribute('data-squad-route-length', '3');
  // A broken implementation starts a fresh motion at 3:1, teleporting the
  // sprite there even though it was still walking from 1:1.
  await expect(canvas).not.toHaveAttribute('data-squad-route-from', '3:1');
  await page.screenshot({
   path: `test-results/scenario-chained-walk-in-flight-${width}.png`,
   fullPage: true,
  });
  await expect(canvas).toHaveAttribute('data-squad-moving', '0', { timeout: 15_000 });
  await expect(canvas).toHaveAttribute('data-squad-route-to', '3:2');
  await page.screenshot({
   path: `test-results/scenario-chained-walk-arrived-${width}.png`,
   fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
 });
}
