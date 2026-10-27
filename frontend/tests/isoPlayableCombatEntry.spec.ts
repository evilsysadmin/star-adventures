import { test, expect } from '@playwright/test';

for (const width of [390, 1280]) {
 test(`one Play click opens actual combat at a visible, keyboard-ready board (${width}px)`, async ({ page }) => {
  await page.setViewportSize({ width, height: 850 });
  await page.goto('/');
  await page.getByTestId('tactical-view-missions').click();
  await page.getByTestId('scenario-play-combat').click();

  await expect(page.getByTestId('scenario-replay-toggle')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('scenario-fire-guide')).toContainText('Para disparar');
  await expect(page.getByTestId('scenario-keyboard')).toBeFocused();

  // The first click must reveal the actual playable canvas, not just change
  // a hidden mode while leaving the user at the top of a very long page.
  const canvas = page.getByTestId('scenario-render-canvas');
  await expect(canvas).toBeVisible();
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y).toBeLessThan(350);
  expect(bounds!.y + bounds!.height).toBeGreaterThan(500);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  // Focus is useful: arrows select a tile immediately, without spending AP.
  const before = await page.getByTestId('scenario-selected').textContent();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('scenario-selected')).not.toHaveText(before!);
  await expect(page.getByTestId('scenario-ap')).toContainText('3 / 3');
  await page.screenshot({ path: `test-results/playable-combat-entry-${width}.png` });
 });
}

test('touch Play enters combat with the board onscreen at 390px', async ({ browser }) => {
 const context = await browser.newContext({
  viewport: { width: 390, height: 850 }, isMobile: true, hasTouch: true,
 });
 try {
  const page = await context.newPage();
  await page.goto('/');
  await page.getByTestId('tactical-view-missions').tap();
  await page.getByTestId('scenario-play-combat').tap();
  await expect(page.getByTestId('scenario-replay-toggle')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('scenario-keyboard')).toBeFocused();
  const bounds = await page.getByTestId('scenario-render-canvas').boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y).toBeLessThan(350);
  await page.screenshot({ path: 'test-results/playable-combat-entry-touch-390.png' });
 } finally {
  await context.close();
 }
});
