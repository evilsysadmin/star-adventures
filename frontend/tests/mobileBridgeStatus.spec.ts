import { expect, test } from '@playwright/test';
test.use({ storageState: { cookies: [], origins: [] } });

for (const width of [360, 390, 430]) {
  test(`bridge status opens, manages real crew, and closes at ${width}px`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width, height: 850 });
    await page.goto('/');
    const toggle = page.getByRole('button', { name: /Estado de la nave/ });
    const details = page.locator('#bridge-status-details');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(details).toBeHidden();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(details).toContainText('Nara Venn');
    await expect(details).toContainText('Daño acumulado');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 390) await page.screenshot({ path: 'test-results/mobile-bridge-status.png' });
    await page.getByRole('button', { name: 'Gestionar tripulación' }).click();
    await expect(page.getByTestId('game-journal-close')).toBeVisible();
    await expect(page.getByTestId('crew-roster')).toHaveAttribute('open', '');
    await page.getByTestId('station-science').selectOption('solan');
    await page.getByTestId('game-journal-close').click();
    await toggle.click();
    await expect(details.locator('.bridge-status-crew > div').filter({ hasText: 'Ciencia' })).toContainText('Idris Solan');
    await toggle.click();
    await expect(details).toBeHidden();
    await expect(page.getByTestId('captain-science')).toBeVisible();
  });
}

test('desktop retains its visible ship status card', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 850 });
  await page.goto('/');
  await expect(page.locator('#bridge-status-details')).toBeVisible();
  await expect(page.getByRole('button', { name: /Estado de la nave/ })).toBeHidden();
  await page.screenshot({ path: 'test-results/desktop-bridge-status.png' });
});
