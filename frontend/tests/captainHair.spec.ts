import { expect, test } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

for (const width of [390, 1280]) {
  test(`captain hair loads while bridge orders remain usable at ${width}px`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 850 });
    await page.goto('/');
    const bridge = page.getByTestId('bridge-interior');
    await expect(bridge).toHaveAttribute('data-bridge-captain-hair', 'loaded', { timeout: 30_000 });
    await expect(bridge).toHaveAttribute('data-bridge-officer-captain', 'varela');
    await page.screenshot({ path: `test-results/captain-hair-${width}.png` });
    if (width === 1280) {
      const head = { x: 590, y: 282, width: 100, height: 90 };
      const before = await page.screenshot({ clip: head });
      await page.getByTestId('game-journal-toggle').click();
      await page.getByTestId('crew-roster').locator('summary').click();
      await page.getByTestId('station-command').selectOption('rhee');
      await expect(bridge).toHaveAttribute('data-bridge-officer-captain', 'rhee');
      await page.getByTestId('game-journal-close').click();
      const after = await page.screenshot({ clip: head });
      expect(after.equals(before)).toBe(false);
    }
    await page.getByTestId('captain-science').click();
    await expect(page.getByTestId('choice-scan')).toBeVisible();
  });
}

for (const asset of ['obj', 'webp']) {
  test(`missing hair ${asset} retains the playable bridge`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.route(`**/art/captain-hair-v1.${asset}`, route => route.abort());
    await page.goto('/');
    await expect(page.getByTestId('bridge-interior')).toHaveAttribute('data-bridge-captain-hair', 'fallback', { timeout: 30_000 });
    await page.getByTestId('captain-science').click();
    await expect(page.getByTestId('choice-scan')).toBeVisible();
  });
}
