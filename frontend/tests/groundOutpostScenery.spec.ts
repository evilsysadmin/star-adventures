import {expect,test} from '@playwright/test';

// Scenic artwork is a view-only replacement: actual tile picking, squad
// selection and checkpoint semantics must remain operational.
test.use({storageState:{cookies:[],origins:[]}});
for(const width of [390,1280]){
 test('authored planetary outpost landmarks and real squad selection '+width+'px',async({page})=>{
  test.setTimeout(100_000);
  page.setDefaultTimeout(15_000);
  await page.setViewportSize({width,height:850});
  await page.goto('/');
  await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:20_000});
  await page.getByTestId('captain-transport').click({timeout:25_000});
  await page.getByTestId('transport-confirm').click();
  const board=page.getByTestId('ground-squad-board');
  await expect(board).toBeVisible();
  await expect(page.getByTestId('ground-planet-backdrop')).toHaveCount(1);
  for(const id of ['probe','sensor-vault','relief-point','perimeter-uplink','beam-out'])
   await expect(page.getByTestId('ground-landmark-'+id)).toHaveCount(1);
  await expect(page.getByTestId('ground-landmark-sensor-vault').locator('text.ground-landmark-name')).toHaveText('ARCHIVO');
  await expect(page.getByTestId('ground-landmark-probe').locator('text.ground-landmark-name')).toHaveText('SONDA');
  await expect(page.getByTestId('ground-landmark-relief-point').locator('text.ground-landmark-name')).toHaveText('SOCORRO');
  await expect(page.getByTestId('ground-landmark-perimeter-uplink').locator('text.ground-landmark-name')).toHaveText('BALIZA');
  await expect(page.getByTestId('ground-landmark-beam-out').locator('text.ground-landmark-name')).toHaveText('EXTRACCIÓN');
  // Artwork is non-interactive: pointer-driven officer selection is unchanged.
  await page.getByTestId('ground-unit-dorn').click();
  await expect(page.getByTestId('ground-select-dorn')).toHaveAttribute('aria-pressed','true');
  await expect(page.getByTestId('ground-select-venn')).toHaveAttribute('aria-pressed','false');
  await page.getByTestId('ground-unit-venn').click();
  await expect(page.getByTestId('ground-select-venn')).toHaveAttribute('aria-pressed','true');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await board.screenshot({path:'test-results/planetary-outpost-'+width+'.png'});
 });
}
