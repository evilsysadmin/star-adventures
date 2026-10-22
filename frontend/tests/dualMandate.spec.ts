import { test, expect, type Page } from '@playwright/test';

async function openArchive(page: Page) {
  const archive = page.getByTestId('mandate-archive');
  await expect(archive.locator('summary').first()).toBeVisible();
  await archive.locator('summary').first().click();
  await expect(page.getByTestId('mandate-public-log')).toBeVisible();
}
async function openVault(page: Page) {
  await page.getByTestId('mandate-vault').locator('summary').first().click();
  await expect(page.getByTestId('mandate-classified-log')).toBeVisible();
}

test('official rescue and refused hidden directive create two different records and survive F5', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('mandate-archive')).toBeVisible();
  await expect(page.getByTestId('mandate-classified-order')).not.toBeVisible();
  await openArchive(page);
  await expect(page.getByTestId('mandate-official-status')).toHaveText('Pendiente');
  await expect(page.getByTestId('mandate-classified-order')).not.toBeVisible();
  await page.getByTestId('mandate-rescue').click();
  await expect(page.getByTestId('mandate-official-status')).toHaveText('Completada');
  await expect(page.getByTestId('mandate-public-events')).toContainText('Civiles evacuados');
  await openVault(page);
  await expect(page.getByTestId('mandate-covert-status')).toHaveText('Pendiente');
  await page.getByTestId('mandate-refuse').click();
  await expect(page.getByTestId('mandate-covert-status')).toHaveText('Rechazada');
  await expect(page.getByTestId('mandate-knowledge')).toContainText('Solo el capitán');
  await expect(page.getByTestId('mandate-public-log')).not.toContainText('directiva');
  await expect.poll(() => page.evaluate(() =>
    JSON.parse(localStorage.getItem('shadowops.star-adventures.outpost-orders.v1') || '{}').actions?.length,
  )).toBe(4);
  await page.reload();
  await openArchive(page);
  await expect(page.getByTestId('mandate-official-status')).toHaveText('Completada');
  await openVault(page);
  await expect(page.getByTestId('mandate-covert-status')).toHaveText('Rechazada');
  await expect(page.getByTestId('mandate-save-notice')).toContainText('Bitácoras restauradas');
  // A story lab action must not fabricate Border Signal science stats.
  await expect(page.getByTestId('science-score')).toHaveText('00');
});

test('only an explicitly informed officer knows the secret and deliberate disclosure is sanitized', async ({ page }) => {
  await page.goto('/');
  await openArchive(page);
  await openVault(page);
  await page.getByTestId('mandate-recover').click();
  await expect(page.getByTestId('mandate-covert-status')).toHaveText('Completada');
  await expect(page.getByTestId('mandate-knowledge')).toContainText('La oficial científica conoce');
  await expect(page.getByTestId('mandate-knowledge')).not.toContainText('primer oficial');
  await page.getByTestId('mandate-inform').click();
  await expect(page.getByTestId('mandate-knowledge')).toContainText('primer oficial también está informado');
  await expect(page.getByTestId('mandate-inform')).toHaveCount(0);
  await expect(page.getByTestId('mandate-public-log')).not.toContainText('Pruebas recuperadas');
  await page.getByTestId('mandate-publish').click();
  await expect(page.getByTestId('mandate-public-events')).toContainText('Pruebas recuperadas');
  await expect(page.getByTestId('mandate-public-log')).not.toContainText('Recuperación discreta');
  await page.reload();
  await openArchive(page);
  await expect(page.getByTestId('mandate-public-events')).toContainText('Pruebas recuperadas');
  await openVault(page);
  await expect(page.getByTestId('mandate-knowledge')).toContainText('primer oficial también está informado');
});

test('reset/corrupt experimental archive is isolated from saved Border Signal mission and squad', async ({ page }) => {
  await page.goto('/');
  await openArchive(page);
  await page.getByTestId('mandate-failure').click();
  await expect(page.getByTestId('mandate-official-status')).toHaveText('Fallida');
  const old = await page.evaluate(() => ({
    crew: localStorage.getItem('shadowops.star-adventures.border-signal.v2'),
    away: localStorage.getItem('shadowops.star-adventures.away-team.v1'),
  }));
  await page.getByTestId('mandate-reset').click();
  await expect(page.getByTestId('mandate-official-status')).toHaveText('Pendiente');
  await page.evaluate(() => localStorage.setItem('shadowops.star-adventures.outpost-orders.v1', '{invalid'));
  await page.reload();
  await openArchive(page);
  await expect(page.getByTestId('mandate-official-status')).toHaveText('Pendiente');
  await expect(page.getByTestId('mandate-save-notice')).toContainText('incompatible');
  const after = await page.evaluate(() => ({
    crew: localStorage.getItem('shadowops.star-adventures.border-signal.v2'),
    away: localStorage.getItem('shadowops.star-adventures.away-team.v1'),
  }));
  expect(after).toEqual(old);
});

for (const width of [360, 390, 1280]) {
  test(`captain's two records remain legible at ${width}px without horizontal scrolling`, async ({ page }) => {
    await page.setViewportSize({ width, height: 880 });
    await page.goto('/');
    await openArchive(page);
    await page.getByTestId('mandate-rescue').click();
    await openVault(page);
    await page.getByTestId('mandate-recover').click();
    await expect(page.getByTestId('mandate-public-log')).toBeVisible();
    await expect(page.getByTestId('mandate-classified-log')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({ path: `test-results/mandate-records-${width}.png`, fullPage:true });
  });
}
