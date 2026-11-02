import { expect, test } from '@playwright/test';
test.use({ storageState: { cookies: [], origins: [] } });

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

test('abandoning on the surface keeps the team there and guides its return', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 850 });
  await page.goto('/');
  await page.getByTestId('captain-transport').click();
  await page.getByTestId('transport-confirm').click();
  await expect(page.getByTestId('explore-area')).toContainText('Superficie');
  await page.getByTestId('mission-abandon').click();
  await page.getByTestId('mission-abandon-confirm').click();
  await expect(page.getByTestId('mission-phase')).toHaveText('RESCATE ABANDONADO');
  await expect(page.getByTestId('explore-area')).toContainText('Superficie');
  await expect(page.getByTestId('mission-waypoint')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('explore-area')).toContainText('Superficie');
  await expect(page.getByTestId('mission-phase')).toHaveText('RESCATE ABANDONADO');
});
