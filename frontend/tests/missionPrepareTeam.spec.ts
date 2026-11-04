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
    await expect(page.getByTestId('away-medical-readiness')).toContainText('Isa Mira · Medicina 4/5');
    await slot.selectOption('solan');
    await expect(slot).toHaveValue('solan');
    await page.getByTestId('away-continue-transport').click();
    await expect(page.getByRole('dialog')).toContainText('Confirmar desembarco');
    await expect(page.getByRole('dialog')).toContainText('Idris Solan');
    await expect(page.getByRole('dialog')).toContainText('Isa Mira');
    if (width === 390 || width === 1280) await page.screenshot({ path: `test-results/away-deployment-confirm-${width}.png` });
    if (width === 390) {
      await page.getByTestId('transport-decline').click();
      await expect(page.getByTestId('explore-area')).toContainText('Puente');
      await page.getByTestId('mission-prepare-team').click();
      await expect(page.getByTestId('away-slot-0')).toHaveValue('solan');
      await page.getByTestId('away-continue-transport').click();
      await expect(page.getByRole('dialog')).toContainText('Idris Solan');
    }
    await page.getByTestId('transport-confirm').click();
    await expect(page.getByTestId('away-party')).toContainText('Idris Solan');
    await expect(page.getByTestId('mission-prepare-team')).toHaveCount(0);
  });
}

for (const width of [390, 1280]) {
  test(`medical readiness follows actual selected officers and does not block deployment at ${width}px`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width, height: 850 });
    await page.goto('/');
    await page.getByTestId('mission-prepare-team').click();
    await page.getByTestId('away-slot-0').selectOption('varela');
    await page.getByTestId('away-slot-2').selectOption('solan');
    await expect(page.getByTestId('away-medical-readiness')).toContainText('se necesita 3/5');
    await expect(page.getByTestId('away-medical-readiness')).toContainText('Medicina 1/5');
    await page.screenshot({ path: `test-results/away-team-preparation-${width}.png` });
    await page.getByTestId('away-continue-transport').click();
    await expect(page.getByRole('dialog')).toContainText('Adrián Varela');
    await expect(page.getByRole('dialog')).toContainText('Idris Solan');
    await expect(page.getByTestId('transport-medical-warning')).toContainText('se necesita 3/5');
    await page.screenshot({ path: `test-results/away-deployment-warning-${width}.png` });
    await page.getByTestId('transport-confirm').click();
    await expect(page.getByTestId('away-party')).toContainText('Idris Solan');
    await page.reload();
    await expect(page.getByTestId('away-party')).toContainText('Idris Solan');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('walking bridge returns to the real route instead of transporting remotely', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('shadowops.star-adventures.presentation.v1',
    JSON.stringify({ version:1, layout:'journal', hints:true, muted:false, volume:.6 })));
  await page.setViewportSize({ width:390, height:850 });
  await page.goto('/');
  await page.getByTestId('mission-prepare-team').click();
  await page.getByTestId('away-continue-transport').click();
  await expect(page.getByTestId('explore-forward')).toBeFocused();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTestId('explore-area')).toContainText('Puente');
});
