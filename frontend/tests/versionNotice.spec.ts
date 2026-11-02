import { expect, test } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test('announces a newer build without reloading and preserves the saved game on request', async ({ page }) => {
  test.setTimeout(90_000);
  let updated = false;
  const current = await (await page.request.get('/version.json')).json();
  await page.route('**/version.json?*', async route => {
    if (!updated) await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(current) });
    else await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ version: 'a-new-build' }) });
  });
  await page.setViewportSize({ width: 390, height: 850 });
  await page.goto('/');
  await expect(page.getByTestId('version-notice')).toHaveCount(0);
  await page.getByTestId('captain-science').click();
  await page.getByTestId('choice-scan').click();
  await expect(page.getByTestId('science-score')).toHaveText('02', { timeout: 20_000 });
  await expect.poll(() => page.evaluate(() => localStorage.getItem('shadowops.star-adventures.border-signal.v2'))).toContain('scan');
  updated = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByTestId('version-notice')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('science-score')).toHaveText('02', { timeout: 20_000 });
  await page.screenshot({ path: 'test-results/version-notice-mobile.png' });
  await page.setViewportSize({ width: 1280, height: 850 });
  await page.screenshot({ path: 'test-results/version-notice-desktop.png' });
  await page.getByRole('button', { name: 'Más tarde' }).click();
  await expect(page.getByTestId('version-notice')).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('version-notice')).toBeVisible({ timeout: 20_000 });
  updated = false;
  await Promise.all([page.waitForNavigation(), page.getByRole('button', { name: 'Recargar' }).click()]);
  await expect(page.getByTestId('version-notice')).toHaveCount(0);
  await expect(page.getByTestId('science-score')).toHaveText('02', { timeout: 20_000 });
});

test('network errors and invalid version responses do not announce an update', async ({ page }) => {
  let invalid = false;
  await page.route('**/version.json?*', route => invalid
    ? route.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' })
    : route.abort('failed'));
  await page.goto('/');
  await expect(page.getByTestId('captain-controls')).toBeVisible();
  await expect(page.getByTestId('version-notice')).toHaveCount(0);
  invalid = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByTestId('version-notice')).toHaveCount(0);
});
