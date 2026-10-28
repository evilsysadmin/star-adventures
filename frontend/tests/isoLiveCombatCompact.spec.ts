import { test, expect } from '@playwright/test';

// The actual live combat must not bury the board beneath repeated briefing
// blocks on narrow screens. Measure rendered geometry, not CSS source text.
for (const width of [360, 390, 430]) {
  test(`live tactical screen prioritizes board and six actions at ${width}px`, async ({ page }) => {
    test.setTimeout(70000);
    await page.setViewportSize({ width, height: 850 });
    await page.goto('/');
    await page.getByTestId('tactical-view-missions').click();

    const head = page.locator('.scenario-head');
    const selector = page.locator('.scenario-selector');
    const beforeHead = await head.boundingBox();
    const beforeSelector = await selector.boundingBox();
    expect(beforeHead).not.toBeNull();
    expect(beforeSelector).not.toBeNull();

    await page.getByTestId('scenario-play-combat').click();
    await expect(page.getByTestId('scenario-fire')).toBeVisible();
    await expect(page.getByTestId('scenario-keyboard')).toBeFocused();
    await expect(page.getByTestId('scenario-fire-guide')).toContainText('Para disparar');
    await expect(page.getByTestId('scenario-unit-security')).toBeVisible();
    await expect(page.getByTestId('scenario-parley')).toBeVisible();

    const afterHead = await head.boundingBox();
    const afterSelector = await selector.boundingBox();
    const roster = await page.locator('.scenario-roster').boundingBox();
    const canvas = await page.getByTestId('scenario-render-canvas').boundingBox();
    expect(afterHead!.height).toBeLessThan(beforeHead!.height - 20);
    expect(afterSelector!.height).toBeLessThan(beforeSelector!.height - 15);
    expect(roster!.height).toBeLessThan(95);
    expect(canvas!.height).toBeGreaterThanOrEqual(340);

    const columns = await page.locator('.scenario-orders').evaluate(el =>
      getComputedStyle(el).gridTemplateColumns.split(' ').length);
    expect(columns).toBe(3);
    expect(await page.locator('.scenario-orders button').count()).toBe(6);
    for (const button of await page.locator('.scenario-orders button').all()) {
      const bounds = await button.boundingBox();
      expect(bounds!.height).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/live-combat-compact-${width}.png`, fullPage: true });
  });
}

test('desktop combat remains readable and all actions available', async ({ page }) => {
  test.setTimeout(70000);
  await page.setViewportSize({ width: 1280, height: 850 });
  await page.goto('/');
  await page.getByTestId('tactical-view-missions').click();
  await page.getByTestId('scenario-play-combat').click();
  await expect(page.getByTestId('scenario-render-canvas')).toBeVisible();
  await expect(page.getByTestId('scenario-fire-guide')).toBeVisible();
  await expect(page.getByTestId('scenario-parley')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/live-combat-compact-1280.png', fullPage: true });
});
