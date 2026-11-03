import { expect, test } from '@playwright/test';
test.use({ storageState: { cookies: [], origins: [] } });
for (const failure of ['unavailable', 'malformed'] as const) {
  test(`a ${failure} head mesh leaves the bridge and real commands usable`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.route('**/art/bridge-head-v1.bin', route => failure === 'unavailable'
      ? route.abort('failed') : route.fulfill({ status: 200, body: 'invalid' }));
    await page.goto('/');
    const bridge = page.getByTestId('bridge-interior');
    await expect(bridge).toHaveAttribute('data-bridge-head', 'fallback', { timeout: 20_000 });
    await expect(bridge).toHaveAttribute('data-bridge-rendered', 'true');
    await page.getByTestId('captain-science').click();
    await expect(page.getByTestId('choice-scan')).toBeVisible();
    await page.getByTestId('choice-scan').click();
    await expect(page.getByTestId('choice-broadcast')).toBeVisible();
  });
}
