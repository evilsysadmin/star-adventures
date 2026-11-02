import { expect, test } from '@playwright/test';
test.use({ storageState: { cookies: [], origins: [] } });
test.setTimeout(90_000);

test('abandon rescue requires confirmation and persists without claiming a rescue', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 850 });
  await page.goto('/');
  await page.getByTestId('mission-abandon').click();
  await expect(page.getByRole('group', { name: 'Confirmar abandono del rescate' })).toContainText('no constarán como rescatados');
  await page.getByRole('button', { name: 'Continuar misión' }).click();
  await expect(page.getByTestId('mission-abandon')).toBeVisible();
  await page.getByTestId('mission-abandon').click();
  await page.getByTestId('mission-abandon-confirm').click();
  await expect(page.getByTestId('mission-phase')).toHaveText('RESCATE ABANDONADO');
  await expect(page.getByTestId('mission-abandon')).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('mission-phase')).toHaveText('RESCATE ABANDONADO');
  await expect(page.getByTestId('mission-next')).toContainText('demás órdenes');
  await expect(page.getByTestId('mission-replay')).toHaveCount(0);
});

for (const width of [390, 1280]) {
  test(`abandoning on the surface returns the team to the bridge at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.goto('/');
    await page.getByTestId('captain-transport').click();
    await page.getByTestId('transport-confirm').click();
    await expect(page.getByTestId('explore-area')).toContainText('Superficie');
    await page.getByTestId('mission-abandon').click();
    await expect(page.getByRole('group', { name: 'Confirmar abandono del rescate' })).toContainText('regresará al puente');
    await page.getByTestId('mission-abandon-confirm').click();
    await expect(page.getByTestId('mission-phase')).toHaveText('RESCATE ABANDONADO');
    await expect(page.getByTestId('explore-area')).toContainText('Puente');
    await page.screenshot({ path: `test-results/abandon-return-${width}.png` });
    await page.reload();
    await expect(page.getByTestId('explore-area')).toContainText('Puente');
    await expect(page.getByTestId('mission-phase')).toHaveText('RESCATE ABANDONADO');
  });
}

test('an earlier abandoned save on the surface can extract without resetting other orders', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 850 });
  await page.goto('/');
  await page.getByTestId('captain-transport').click();
  await page.getByTestId('transport-confirm').click();
  await expect(page.getByTestId('explore-area')).toContainText('Superficie');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('shadowops.star-adventures.spatial.v1'))).toContain('surface');
  await page.evaluate(() => localStorage.setItem('shadowops.star-adventures.outpost-orders.v1', JSON.stringify({
    saveVersion: 1, mandateId: 'outpost-orders', actions: [
      { type: 'record', incidentId: 'rescue-abandoned', orderId: 'evacuate', kind: 'refusal', witnesses: [], public: true },
      { type: 'resolve', orderId: 'evacuate', incidentId: 'rescue-abandoned', status: 'refused' },
    ],
  })));
  await page.reload();
  await expect(page.getByTestId('mission-phase')).toHaveText('RESCATE ABANDONADO');
  await page.screenshot({ path: 'test-results/abandon-return-existing.png' });
  await page.getByTestId('abandoned-return').click();
  await expect(page.getByTestId('explore-area')).toContainText('Puente');
  await expect(page.getByTestId('mission-phase')).toHaveText('RESCATE ABANDONADO');
  await page.reload();
  await expect(page.getByTestId('explore-area')).toContainText('Puente');
});
