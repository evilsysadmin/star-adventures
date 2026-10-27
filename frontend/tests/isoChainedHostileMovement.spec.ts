import { test, expect } from '@playwright/test';

// Two accepted enemy turns before the first 720ms step completes must not
// visually teleport hostiles to the previous logical destination.
for (const width of [390, 1280]) {
 test(`rapid consecutive hostile turns retain both visible steps at ${width}px`, async ({ page }) => {
  test.setTimeout(75_000);
  await page.setViewportSize({ width, height: 850 });
  await page.goto('/');
  await page.getByTestId('tactical-view-missions').click();
  await page.getByTestId('scenario-hostile-toggle').click();
  const canvas = page.getByTestId('scenario-render-canvas');
  await expect(canvas).toBeVisible();
  await canvas.evaluate(() => {
   const original = window.requestAnimationFrame.bind(window);
   let origin: number | null = null;
   window.requestAnimationFrame = callback => original(timestamp => {
    origin ??= timestamp;
    callback(origin + (timestamp - origin) * .16);
   });
  });
  await page.getByTestId('scenario-end-turn').click();
  await expect(page.getByTestId('scenario-turn')).toContainText('Ronda 2');
  await expect(canvas).not.toHaveAttribute('data-hostile-moving', '0');
  await page.getByTestId('scenario-end-turn').click();
  await expect(page.getByTestId('scenario-turn')).toContainText('Ronda 3');
  await expect(canvas).toHaveAttribute('data-hostile-route-length', '2');
  await expect(canvas).toHaveAttribute('data-hostile-route-segment', '0');
  await page.screenshot({ path: `test-results/hostile-chained-in-flight-${width}.png`, fullPage: true });
  await expect(canvas).toHaveAttribute('data-hostile-moving', '0', { timeout: 20_000 });
  await expect(canvas).toHaveAttribute('data-hostile-route-to', /.+/);
  await page.screenshot({ path: `test-results/hostile-chained-arrived-${width}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
 });
}
