import { test, expect } from '@playwright/test';

const KEY = 'shadowops.star-adventures.combat-replay.v4';
const victory = [
  { type: 'move', officer: 'security', cell: '3:7' },
  { type: 'move', officer: 'security', cell: '5:6' },
  { type: 'fire', officer: 'security', hostile: 'aegis' },
  { type: 'end-turn' },
  { type: 'fire', officer: 'security', hostile: 'aegis' },
  { type: 'fire', officer: 'security', hostile: 'veil' },
  { type: 'fire', officer: 'security', hostile: 'veil' },
];

for (const width of [390, 1280]) {
  test(`bridge displays validated v4 tactical results read-only at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 850 : 820 });
    await page.goto('/');
    const raw = JSON.stringify({ version: 4, scenarioId: 'relay', actions: victory });
    await page.evaluate(([key, value]) => localStorage.setItem(key, value), [KEY, raw]);
    await page.reload();

    const disclosure = page.getByTestId('bridge-combat-report');
    await expect(disclosure).toBeVisible();
    const before = await page.evaluate(() => ({ ...localStorage }));
    await disclosure.locator('summary').click();
    await expect(page.getByTestId('bridge-combat-status')).toHaveText('Amenazas neutralizadas · extracción pendiente');
    await expect(page.getByTestId('bridge-combat-metrics')).toContainText('4 disparos');
    await expect(page.getByTestId('bridge-combat-metrics')).toContainText('2 amenazas neutralizadas');
    await expect(page.getByTestId('bridge-combat-objectives')).toContainText('ninguno todavía');
    await expect(page.getByTestId('bridge-combat-scope')).toContainText('No concede recompensas');
    expect(await page.evaluate(() => ({ ...localStorage }))).toEqual(before);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({ path: `test-results/bridge-combat-report-${width}.png`, fullPage: true });

    // Reopening after F5 must reconstruct from the exact saved commands.
    await page.reload();
    await page.getByTestId('bridge-combat-report').locator('summary').click();
    await expect(page.getByTestId('bridge-combat-status')).toContainText('extracción pendiente');
    expect(await page.evaluate(key => localStorage.getItem(key), KEY)).toBe(raw);
  });
}

test('bridge handles missing and corrupt v4 saves without mutating them', async ({ page }) => {
  await page.goto('/');
  const disclosure = page.getByTestId('bridge-combat-report');
  await disclosure.locator('summary').click();
  await expect(page.getByTestId('bridge-combat-unavailable')).toContainText('no hay un combate v4');
  await disclosure.locator('summary').click();
  await page.evaluate(key => localStorage.setItem(key, '{broken'), KEY);
  await disclosure.locator('summary').click();
  await expect(page.getByTestId('bridge-combat-unavailable')).toContainText('incompatible');
  expect(await page.evaluate(key => localStorage.getItem(key), KEY)).toBe('{broken');
  await page.reload();
  await page.getByTestId('bridge-combat-report').locator('summary').click();
  await expect(page.getByTestId('bridge-combat-unavailable')).toContainText('No se ha modificado');
});

test('experimental tactical report is visible on bridge, not during surface exploration', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('bridge-combat-report')).toBeVisible();
  await page.getByTestId('explore-right').click();
  await page.getByTestId('explore-forward').click();
  await page.getByTestId('explore-right').click();
  await page.getByTestId('explore-use').click();
  await page.getByTestId('transport-confirm').click();
  await expect(page.getByTestId('explore-area')).toContainText('Superficie');
  await expect(page.getByTestId('bridge-combat-report')).toHaveCount(0);
});
