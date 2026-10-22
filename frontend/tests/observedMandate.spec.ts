import { test, expect, type Page } from '@playwright/test';

async function visitProbe(page: Page) {
  // Physical bridge spawn 3:5 N -> transporter at 4:6, then surface probe.
  await page.getByTestId('explore-right').click();
  await page.getByTestId('explore-forward').click();
  await page.getByTestId('explore-right').click();
  await page.getByTestId('explore-use').click();
  await page.getByTestId('transport-confirm').click();
  await expect(page.getByTestId('explore-area')).toContainText('Superficie planetaria');
  await page.getByTestId('explore-forward').click();
  await page.getByTestId('explore-forward').click();
  await expect(page.getByTestId('explore-target')).toContainText('Sonda científica');
  await page.getByTestId('explore-use').click();
}

async function openOrders(page: Page) {
  await page.getByTestId('mandate-archive').locator('summary').first().click();
  await expect(page.getByTestId('mandate-real-survey')).toBeVisible();
}

test('public science report requires a real first-person away expedition and survives F5', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 850 });
  await page.goto('/');
  await openOrders(page);
  await expect(page.getByTestId('mandate-survey-status')).toHaveText('Pendiente');
  await expect(page.getByTestId('mandate-public-events')).toHaveCount(0);
  await expect(page.getByTestId('mandate-real-survey')).not.toContainText('Completada');
  // Nothing in the captain's archive can fabricate the physical discovery.
  await expect(page.getByTestId('mandate-archive').getByRole('button', {name:/registrar.*sonda/i})).toHaveCount(0);
  await visitProbe(page);
  await expect(page.getByTestId('away-finding')).toContainText('firma mineral registrada');
  await expect(page.getByTestId('mandate-survey-status')).toHaveText('Completada');
  await expect(page.getByTestId('mandate-public-events')).toContainText('evidence');
  await expect.poll(() => page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('shadowops.star-adventures.outpost-orders.v1') || '{}');
    return data.actions?.filter((x: { incidentId?: string }) => x.incidentId === 'probe-signature-verified').length;
  })).toBe(2);
  await page.reload();
  await openOrders(page);
  await expect(page.getByTestId('mandate-survey-status')).toHaveText('Completada');
  await expect(page.getByTestId('mandate-public-events')).toContainText('evidence');
  await expect(page.getByTestId('science-score')).toHaveText('00');
  await page.getByTestId('mandate-reset').click();
  await expect(page.getByTestId('mandate-survey-status')).toHaveText('Completada');
  await page.screenshot({path:'test-results/mandate-real-science-390.png',fullPage:true});
});

test('an underqualified expedition does not receive public science credit', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('away-slot-0').selectOption('varela');
  await page.getByTestId('away-slot-2').selectOption('solan');
  await openOrders(page);
  await expect(page.getByTestId('mandate-survey-status')).toHaveText('Pendiente');
  await visitProbe(page);
  await expect(page.getByTestId('away-finding')).toContainText('Investigación insuficiente');
  await expect(page.getByTestId('mandate-survey-status')).toHaveText('Pendiente');
  await page.reload();
  await openOrders(page);
  await expect(page.getByTestId('mandate-survey-status')).toHaveText('Pendiente');
});

test('a broken story-lab checkpoint recovers the authentic discovery on reload', async ({ page }) => {
  await page.goto('/');
  await visitProbe(page);
  await page.evaluate(() => localStorage.setItem('shadowops.star-adventures.outpost-orders.v1', '{invalid'));
  await page.reload();
  await openOrders(page);
  await expect(page.getByTestId('mandate-survey-status')).toHaveText('Completada');
  await expect(page.getByTestId('mandate-save-notice')).toContainText('incompatible');
  await expect(page.getByTestId('science-score')).toHaveText('00');
});
