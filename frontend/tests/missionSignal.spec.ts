import { test, expect, type Page } from '@playwright/test';

async function reachSurface(page: Page) {
  // Bridge spawn 3:5 N; transporter is physically at 4:6.
  await page.getByTestId('explore-right').click();
  await page.getByTestId('explore-forward').click();
  await page.getByTestId('explore-right').click();
  await page.getByTestId('explore-use').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByTestId('transport-confirm').click();
}

for (const width of [390, 1280]) {
  test(`real mission signal follows bridge → rescue → extraction → debrief at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 850 : 820 });
    await page.goto('/');
    const signal = page.getByTestId('mission-transmission');
    const route = signal.getByRole('listitem');
    await expect(page.getByTestId('mission-phase')).toHaveText('TRANSMISIÓN ENTRANTE');
    await expect(page.getByTestId('mission-next')).toContainText('sala de transporte');
    await expect(route.nth(0)).toHaveAttribute('data-state', 'current');
    await expect(route.nth(1)).toHaveAttribute('data-state', 'pending');
    await page.screenshot({ path: `test-results/mission-briefing-${width}.png`, fullPage: true });

    await reachSurface(page);
    await expect(page.getByTestId('mission-phase')).toHaveText('MISIÓN EN SUPERFICIE');
    await expect(page.getByTestId('mission-next')).toContainText('puesto de socorro');
    await expect(route.nth(0)).toHaveAttribute('data-state', 'done');
    await expect(route.nth(1)).toHaveAttribute('data-state', 'current');
    await page.screenshot({ path: `test-results/mission-field-${width}.png`, fullPage: true });

    // A verified medical intervention, not merely a visited tile or UI click,
    // advances the story toward extraction.
    await page.getByTestId('explore-forward').click();
    await page.getByTestId('explore-right').click();
    await page.getByTestId('explore-forward').click();
    await expect(page.getByTestId('mission-phase')).toHaveText('MISIÓN EN SUPERFICIE');
    await page.getByTestId('explore-use').click();
    await expect(page.getByTestId('mission-phase')).toHaveText('RESCATE CONFIRMADO');
    await expect(route.nth(1)).toHaveAttribute('data-state', 'done');
    await expect(route.nth(2)).toHaveAttribute('data-state', 'current');
    await page.screenshot({ path: `test-results/mission-extraction-${width}.png`, fullPage: true });

    // Return physically, without inventing a mission-completion shortcut.
    await page.getByTestId('explore-right').click();
    await page.getByTestId('explore-forward').click();
    await page.getByTestId('explore-right').click();
    await page.getByTestId('explore-forward').click();
    await page.getByTestId('explore-left').click();
    await page.getByTestId('explore-use').click();
    await page.getByTestId('transport-confirm').click();
    await expect(page.getByTestId('mission-phase')).toHaveText('REGRESO AL PUENTE');
    await expect(route.nth(2)).toHaveAttribute('data-state', 'done');
    const report = page.getByTestId('mission-return-report');
    await expect(report).toBeVisible();
    await expect(report).toContainText('Civiles a salvo');
    await expect(page.getByTestId('mission-perimeter-outcome')).toContainText('Sin resolución táctica registrada');
    await expect(report).not.toContainText('núcleo');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({ path: `test-results/mission-debrief-${width}.png`, fullPage: true });

    await page.reload();
    await expect(page.getByTestId('mission-phase')).toHaveText('REGRESO AL PUENTE');
    await expect(page.getByTestId('mission-next')).toContainText('archivo de órdenes');
    await expect(page.getByTestId('mission-return-report')).toBeVisible();

    // A replay is a genuinely fresh rescue, not just a bridge camera reset
    // with civilians already evacuated in the underlying mission record.
    await page.getByTestId('mission-replay').click();
    await expect(page.getByTestId('mission-phase')).toHaveText('TRANSMISIÓN ENTRANTE');
    await expect(page.getByTestId('mission-return-report')).toHaveCount(0);
    await expect(page.getByTestId('mission-next')).toContainText('sala de transporte');
    await expect(page.getByTestId('medical-report')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() =>
      JSON.parse(localStorage.getItem('shadowops.star-adventures.outpost-orders.v1') || '{}').actions?.length
    )).toBe(0);
    await page.reload();
    await expect(page.getByTestId('mission-phase')).toHaveText('TRANSMISIÓN ENTRANTE');
  });
}

test('a legacy simulated rescue cannot claim the team returned from a real mission', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('shadowops.star-adventures.outpost-orders.v1', JSON.stringify({
      saveVersion: 1, mandateId: 'outpost-orders', actions: [
        { type: 'record', incidentId: 'survivors-evacuated', orderId: 'evacuate',
          kind: 'rescue', witnesses: ['mira'], public: true },
        { type: 'resolve', orderId: 'evacuate', incidentId: 'survivors-evacuated', status: 'completed' },
      ],
    }));
  });
  await page.reload();
  await expect(page.getByTestId('mission-phase')).toHaveText('TRANSMISIÓN ENTRANTE');
  await expect(page.getByTestId('mission-next')).toContainText('sala de transporte');
});
