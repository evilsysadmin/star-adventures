import { test, expect, type Page } from '@playwright/test';

async function openVault(page: Page) {
  await page.getByTestId('mandate-archive').locator('summary').first().click();
  await page.getByTestId('mandate-vault').locator('summary').first().click();
  await expect(page.getByTestId('mandate-classified-log')).toBeVisible();
}
async function visitCore(page: Page) {
  // Bridge 3:5 N -> transporter 4:6 -> surface spawn 4:5 N -> archive at 2:2.
  await page.getByTestId('explore-right').click();
  await page.getByTestId('explore-forward').click();
  await page.getByTestId('explore-right').click();
  await page.getByTestId('explore-use').click();
  await page.getByTestId('transport-confirm').click();
  await page.getByTestId('explore-forward').click();
  await page.getByTestId('explore-forward').click();
  await page.getByTestId('explore-left').click();
  await page.getByTestId('explore-forward').click();
  await page.getByTestId('explore-forward').click();
  await page.getByTestId('explore-right').click();
  await expect(page.getByTestId('explore-target')).toContainText('Archivo de sensores');
}

test('actual technical retrieval is private, credited to Venn, replayed after F5 and deliberately publishable', async ({page}) => {
  await page.setViewportSize({width:390,height:850});
  await page.goto('/');
  await openVault(page);
  await expect(page.getByTestId('mandate-covert-status')).toHaveText('Pendiente');
  await expect(page.getByTestId('mandate-recover')).toHaveCount(0);
  await visitCore(page);
  await expect(page.getByTestId('mandate-covert-status')).toHaveText('Pendiente');
  await page.getByTestId('explore-use').click();
  await expect(page.getByTestId('core-report')).toContainText('Núcleo asegurado por Nara Venn');
  await expect(page.getByTestId('mandate-covert-status')).toHaveText('Completada');
  await expect(page.getByTestId('mandate-legacy-core')).toHaveCount(0);
  await expect(page.getByTestId('mandate-knowledge')).toContainText('La oficial científica conoce');
  await expect(page.getByTestId('mandate-public-log')).not.toContainText('Pruebas recuperadas');
  await expect.poll(() => page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('shadowops.star-adventures.outpost-orders.v1') || '{}');
    return raw.actions?.filter((a: {incidentId?:string}) => a.incidentId === 'field-core-extracted')?.length;
  })).toBe(2);
  await page.reload();
  await openVault(page);
  await expect(page.getByTestId('mandate-covert-status')).toHaveText('Completada');
  await expect(page.getByTestId('mandate-knowledge')).not.toContainText('primer oficial también');
  await page.getByTestId('mandate-inform').click();
  await expect(page.getByTestId('mandate-knowledge')).toContainText('primer oficial también está informado');
  await page.getByTestId('mandate-publish').click();
  await expect(page.getByTestId('mandate-public-events')).toContainText('Pruebas recuperadas');
  await expect(page.getByTestId('mandate-public-log')).not.toContainText('Recuperación discreta');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/core-recovery-real-390.png',fullPage:true});
  await page.setViewportSize({width:1280,height:900});
  await expect(page.getByTestId('mandate-covert-status')).toHaveText('Completada');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/core-recovery-real-1280.png',fullPage:true});
});

test('unqualified away squad cannot invent a covert success even at the correct physical archive', async ({page}) => {
  await page.goto('/');
  await page.getByTestId('away-slot-0').selectOption('varela');
  await page.getByTestId('away-slot-2').selectOption('solan');
  await openVault(page);
  await visitCore(page);
  await page.getByTestId('explore-use').click();
  await expect(page.getByTestId('core-report')).toContainText('Acceso insuficiente');
  await expect(page.getByTestId('mandate-covert-status')).toHaveText('Pendiente');
  await expect(page.getByTestId('mandate-knowledge')).toHaveCount(0);
  await page.reload();
  await openVault(page);
  await expect(page.getByTestId('mandate-covert-status')).toHaveText('Pendiente');
});

test('consciously refusing covert order prevents later extraction', async ({page}) => {
  await page.goto('/');
  await openVault(page);
  await page.getByTestId('mandate-refuse').click();
  await expect(page.getByTestId('mandate-covert-status')).toHaveText('Rechazada');
  await visitCore(page);
  await page.getByTestId('explore-use').click();
  await expect(page.getByTestId('core-report')).toContainText('ya está resuelta');
  await expect(page.getByTestId('mandate-covert-status')).toHaveText('Rechazada');
  await expect(page.getByTestId('mandate-public-log')).not.toContainText('directiva');
});

test('old simulated covert success remains readable, labelled and resettable without forged physical evidence', async ({page}) => {
  await page.goto('/');
  const old = { saveVersion:1, mandateId:'outpost-orders', actions:[
    {type:'record',incidentId:'sensor-core-recovered',orderId:'recover-core',
      kind:'evidence',witnesses:['venn'],public:false},
    {type:'resolve',orderId:'recover-core',incidentId:'sensor-core-recovered',status:'completed'},
  ] };
  await page.evaluate(data => localStorage.setItem(
    'shadowops.star-adventures.outpost-orders.v1', JSON.stringify(data)),old);
  await page.reload();
  await openVault(page);
  await expect(page.getByTestId('mandate-covert-status')).toHaveText('Completada');
  await expect(page.getByTestId('mandate-legacy-core')).toContainText('simulación anterior');
  await page.getByTestId('mandate-reset').click();
  await expect(page.getByTestId('mandate-covert-status')).toHaveText('Pendiente');
  await visitCore(page);
  await page.getByTestId('explore-use').click();
  await expect(page.getByTestId('mandate-covert-status')).toHaveText('Completada');
  await expect(page.getByTestId('mandate-legacy-core')).toHaveCount(0);
});
