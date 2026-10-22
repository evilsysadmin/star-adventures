import { test, expect, type Page } from '@playwright/test';

async function openArchive(page: Page) {
  await page.getByTestId('mandate-archive').locator('summary').first().click();
  await expect(page.getByTestId('mandate-public-log')).toBeVisible();
}

async function arriveAtCaptainChair(page: Page) {
  // Bridge spawn at (3,5,N): chair at (4,4); approach from (4,5,N).
  await page.getByTestId('explore-right').click();
  await page.getByTestId('explore-forward').click();
  await page.getByTestId('explore-left').click();
  await expect(page.getByTestId('explore-target')).toContainText('Sillón del capitán');
  await page.getByTestId('explore-use').click();
}

async function discoverProbe(page: Page) {
  // Bridge spawn at (3,5,N), transporter (4,6), probe (4,2).
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
  await expect(page.getByTestId('away-finding')).toContainText('firma mineral registrada');
}

async function returnToBridge(page: Page) {
  // From probe position (4,3,N), face S and interact with transporter (4,6).
  await page.getByTestId('explore-right').click();
  await page.getByTestId('explore-right').click();
  await page.getByTestId('explore-forward').click();
  await page.getByTestId('explore-forward').click();
  await expect(page.getByTestId('explore-target')).toContainText('teletransporte de regreso');
  await page.getByTestId('explore-use').click();
  await page.getByTestId('transport-confirm').click();
  await expect(page.getByTestId('explore-area')).toContainText('Puente de mando');
}

test('authentic away finding opens one officer briefing only at the accessed captain chair and survives F5', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 850 });
  await page.goto('/');
  await arriveAtCaptainChair(page);
  await openArchive(page);
  await expect(page.getByTestId('mandate-field-briefing')).toHaveCount(0);
  await expect(page.getByTestId('mandate-brief-science')).toHaveCount(0);

  // Restart location only, preserving the previous fresh briefing save.
  await page.getByRole('button', { name: /Reiniciar/ }).last().click();
  await discoverProbe(page);
  await expect(page.getByTestId('mandate-survey-status')).toHaveText('Completada');
  await expect(page.getByTestId('mandate-field-knowledge')).toContainText('todavía no');
  await expect(page.getByTestId('mandate-brief-science')).toHaveCount(0);

  await returnToBridge(page);
  await expect(page.getByTestId('mandate-brief-science')).toHaveCount(0,
    'being on the bridge is not enough without accessing command');
  await arriveAtCaptainChair(page);
  await expect(page.getByTestId('mandate-brief-science')).toBeVisible();
  await page.getByTestId('mandate-brief-science').click();
  await expect(page.getByTestId('mandate-field-knowledge')).toContainText('ha recibido el informe');
  await expect(page.getByTestId('mandate-brief-science')).toHaveCount(0);
  const after = await page.evaluate(() => {
    const checkpoint = JSON.parse(localStorage.getItem('shadowops.star-adventures.outpost-orders.v1') || '{}');
    return checkpoint.actions?.filter((action: { type: string; incidentId: string }) =>
      action.type === 'inform' && action.incidentId === 'probe-signature-verified');
  });
  expect(after).toEqual([{ type: 'inform', incidentId: 'probe-signature-verified',
    from: 'captain', to: 'solan' }]);

  await page.reload();
  await openArchive(page);
  await expect(page.getByTestId('mandate-field-knowledge')).toContainText('ha recibido el informe');
  await expect(page.getByTestId('mandate-brief-science')).toHaveCount(0);
  await expect(page.getByTestId('science-score')).toHaveText('00');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/science-briefing-390.png', fullPage: true });
});
