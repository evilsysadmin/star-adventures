import { test, expect, type Page } from '@playwright/test';

async function reachReliefStation(page: Page) {
  // Bridge spawn 3:5 N -> transporter at 4:6 -> surface 4:5 N.
  await page.getByTestId('explore-right').click();
  await page.getByTestId('explore-forward').click();
  await page.getByTestId('explore-right').click();
  await page.getByTestId('explore-use').click();
  await page.getByTestId('transport-confirm').click();
  await expect(page.getByTestId('explore-area')).toContainText('Superficie planetaria');
  // Surface spawn 4:5 N -> 4:4 E -> 5:4 E faces relief point at 6:4.
  await page.getByTestId('explore-forward').click();
  await page.getByTestId('explore-right').click();
  await page.getByTestId('explore-forward').click();
  await expect(page.getByTestId('explore-target')).toContainText('Puesto de socorro');
}

async function openArchive(page: Page) {
  await page.getByTestId('mandate-archive').locator('summary').first().click();
  await expect(page.getByTestId('mandate-public-log')).toBeVisible();
}

test('real medical evacuation requires a physical station, succeeds with Mira and survives F5', async ({ page }) => {
  await page.setViewportSize({width: 390, height: 850});
  await page.goto('/');
  await openArchive(page);
  await expect(page.getByTestId('mandate-official-status')).toHaveText('Pendiente');
  await expect(page.getByTestId('mandate-rescue')).toHaveCount(0);
  await expect(page.getByTestId('mandate-failure')).toHaveCount(0);
  await reachReliefStation(page);
  await expect(page.getByTestId('mandate-official-status')).toHaveText('Pendiente');
  await page.getByTestId('explore-use').click();
  await expect(page.getByTestId('medical-report')).toContainText('Evacuación completada por Isa Mira');
  await expect(page.getByTestId('mandate-official-status')).toHaveText('Completada');
  await expect(page.getByTestId('mandate-public-events')).toContainText('Civiles evacuados');
  await expect.poll(() => page.evaluate(() =>
    JSON.parse(localStorage.getItem('shadowops.star-adventures.outpost-orders.v1') || '{}').actions?.length
  )).toBe(2);
  await page.reload();
  await openArchive(page);
  await expect(page.getByTestId('mandate-official-status')).toHaveText('Completada');
  await expect(page.getByTestId('mandate-public-events')).toContainText('Civiles evacuados');
  await expect(page.getByTestId('science-score')).toHaveText('00');
  await expect(page.getByTestId('mandate-save-notice')).toContainText('Bitácoras restauradas');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({path: 'test-results/medical-relief-real-390.png',fullPage:true});
  await page.setViewportSize({width:1280,height:900});
  await expect(page.getByTestId('mandate-official-status')).toHaveText('Completada');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({path: 'test-results/medical-relief-real-1280.png',fullPage:true});
});

test('insufficient medicine does not fabricate an evacuation', async ({page}) => {
  await page.goto('/');
  await page.getByTestId('away-slot-0').selectOption('varela');
  await page.getByTestId('away-slot-1').selectOption('solan');
  await page.getByTestId('away-slot-2').selectOption('dorn');
  await openArchive(page);
  await reachReliefStation(page);
  await page.getByTestId('explore-use').click();
  await expect(page.getByTestId('medical-report')).toContainText('Asistencia insuficiente');
  await expect(page.getByTestId('mandate-official-status')).toHaveText('Pendiente');
  await expect(page.getByTestId('mandate-public-events')).toHaveCount(0);
  await page.reload();
  await openArchive(page);
  await expect(page.getByTestId('mandate-official-status')).toHaveText('Pendiente');
});

test('a deliberate archive reset erases rescue, while keeping the actual probe finding', async ({page}) => {
  await page.goto('/');
  await openArchive(page);
  await reachReliefStation(page);
  await page.getByTestId('explore-use').click();
  await expect(page.getByTestId('mandate-official-status')).toHaveText('Completada');
  await page.getByTestId('mandate-reset').click();
  await expect(page.getByTestId('mandate-official-status')).toHaveText('Pendiente');
  await page.getByTestId('explore-use').click();
  await expect(page.getByTestId('mandate-official-status')).toHaveText('Completada');
  await expect(page.getByTestId('mandate-public-events')).toContainText('Civiles evacuados');
});


test('old simulated v1 rescue stays readable and distinct from physical rescue', async ({page}) => {
  await page.goto('/');
  const legacy = {
    saveVersion: 1, mandateId: 'outpost-orders', actions: [
      { type: 'record', incidentId: 'survivors-evacuated', orderId: 'evacuate',
        kind: 'rescue', witnesses: ['mira'], public: true },
      { type: 'resolve', orderId: 'evacuate', incidentId: 'survivors-evacuated',
        status: 'completed' },
    ],
  };
  await page.evaluate(checkpoint =>
    localStorage.setItem('shadowops.star-adventures.outpost-orders.v1', JSON.stringify(checkpoint)), legacy);
  await page.reload();
  await openArchive(page);
  await expect(page.getByTestId('mandate-official-status')).toHaveText('Completada');
  await expect(page.getByTestId('mandate-legacy-rescue')).toContainText('antigua simulación');
  await page.getByTestId('mandate-reset').click();
  await expect(page.getByTestId('mandate-official-status')).toHaveText('Pendiente');
  await expect(page.getByTestId('mandate-legacy-rescue')).toHaveCount(0);
  await reachReliefStation(page);
  await page.getByTestId('explore-use').click();
  await expect(page.getByTestId('mandate-official-status')).toHaveText('Completada');
  await expect(page.getByTestId('mandate-legacy-rescue')).toHaveCount(0);
});
