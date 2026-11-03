import { expect, test } from '@playwright/test';
test.use({ storageState: { cookies: [], origins: [] } });

for (const width of [360, 390, 430, 1280]) {
  test(`mission briefing opens the actual away-team controls at ${width}px`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width, height: 850 });
    await page.goto('/');
    await expect(page.getByTestId('mission-prepare-team')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 390 || width === 1280) await page.screenshot({ path: `test-results/mission-prepare-${width}.png` });
    await page.getByTestId('mission-prepare-team').click();
    const slot = page.getByTestId('away-slot-0');
    await expect(slot).toBeFocused();
    await slot.selectOption('solan');
    await expect(slot).toHaveValue('solan');
    await page.getByTestId('game-journal-close').click();
    await page.getByTestId('captain-transport').click();
    await page.getByTestId('transport-confirm').click();
    await expect(page.getByTestId('away-party')).toContainText('Idris Solan');
    await expect(page.getByTestId('mission-prepare-team')).toHaveCount(0);
  });
}
