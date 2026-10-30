import { expect, test } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });
for (const width of [390, 1280]) {
  test(`captain shares an actual scientific discovery from seated command at ${width}px`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 850 });
    await page.goto('/');
    await page.getByTestId('captain-captain').click();
    await page.getByTestId('mandate-archive').locator('summary').first().click();
    await expect(page.getByTestId('mandate-brief-science')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.getByTestId('captain-transport').click();
    await page.getByTestId('transport-confirm').click();
    await page.getByTestId('explore-forward').click();
    await page.getByTestId('explore-forward').click();
    await expect(page.getByTestId('explore-target')).toContainText('Sonda científica');
    await page.getByTestId('explore-use').click();
    await page.getByTestId('game-journal-toggle').click();
    await expect(page.getByTestId('mandate-field-knowledge')).toContainText('todavía no');
    await expect(page.getByTestId('mandate-brief-science')).toHaveCount(0);
    await page.keyboard.press('Escape');
    for (const action of ['right', 'right', 'forward', 'forward', 'use'])
      await page.getByTestId(`explore-${action}`).click();
    await page.getByTestId('transport-confirm').click();
    await page.getByTestId('captain-science').click();
    await expect(page.getByTestId('mandate-brief-science')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.getByTestId('captain-captain').click();
    await page.getByTestId('mandate-brief-science').click();
    await expect(page.getByTestId('mandate-field-knowledge')).toContainText('ha recibido el informe');
    await expect(page.getByTestId('mandate-brief-science')).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId('bridge-interior')).toHaveAttribute('data-bridge-mode', 'captain', { timeout: 20_000 });
    await page.getByTestId('captain-captain').click();
    await page.getByTestId('mandate-archive').locator('summary').first().click();
    await expect(page.getByTestId('mandate-field-knowledge')).toContainText('ha recibido el informe');
    await expect(page.getByTestId('mandate-brief-science')).toHaveCount(0);
    const informed = await page.evaluate(() => JSON.parse(localStorage.getItem('shadowops.star-adventures.outpost-orders.v1')!).actions
      .filter((action: { type: string; incidentId: string }) => action.type === 'inform' && action.incidentId === 'probe-signature-verified'));
    expect(informed).toEqual([{ type: 'inform', incidentId: 'probe-signature-verified', from: 'captain', to: 'solan' }]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.getByTestId('mandate-field-knowledge').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/captain-science-briefing-${width}.png` });
  });
}
