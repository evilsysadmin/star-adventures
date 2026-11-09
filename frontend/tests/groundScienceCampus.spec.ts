import {expect,test} from '@playwright/test';

test.use({storageState:{cookies:[],origins:[]}});

for(const width of [390,1280]){
 test('one science wing joins real Archive and Sonda without changing their actions '+width,async({page})=>{
  test.setTimeout(100_000);
  await page.setViewportSize({width,height:850});
  await page.goto('/');
  await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:25_000});
  await page.getByTestId('captain-transport').click({timeout:25_000});
  await page.getByTestId('transport-confirm').click();
  const board=page.getByTestId('ground-squad-board');
  const wing=page.getByTestId('ground-science-campus');
  await expect(board).toBeVisible();
  // Canonical initial squad sight may already include this nearby wing.
  // Do not invent a fog state: if present, it requires all three tiles
  // to have been legitimately discovered by the deployed officers.
  if(await wing.count()){
    for(const id of ['2,2','3,2','4,2']){
      await expect(board.locator('[data-fog-cell="'+id+'"][data-fog-state="unknown"]')).toHaveCount(0);
    }
  }
  await page.getByTestId('ground-camera-toggle').click();
  await board.screenshot({path:'test-results/away-science-campus-before-'+width+'.png'});

  // Move the REAL selected officer. No test-only sensor reveal or teleport.
  await board.locator('[data-cell-id="3,3"]').click({button:'right'});
  await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-x','3');
  await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-y','3');
  await expect(page.getByTestId('ground-unit-venn'))
    .toHaveAttribute('data-walk-phase','idle',{timeout:25_000});

  await expect(wing).toHaveAttribute('data-footprint','2,2 3,2 4,2');
  await expect(wing).toHaveAttribute('data-fog','visible');
  await expect(wing).toHaveAttribute('pointer-events','none');
  await expect(page.getByTestId('ground-architecture-wall-3,2')).toHaveCount(0);
  for(const id of ['2,2','3,2','4,2']){
    await expect(board.locator('[data-cell-id="'+id+'"]')).toHaveCount(1);
  }
  await expect(page.getByTestId('ground-landmark-sensor-vault')).toHaveCount(1);
  await expect(page.getByTestId('ground-landmark-probe')).toHaveCount(1);
  await board.screenshot({path:'test-results/away-science-campus-revealed-'+width+'.png'});
  await page.reload();
  await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-x','3');
  await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-y','3');
  await expect(page.getByTestId('ground-science-campus')).toHaveCount(1);
  await expect(page.getByTestId('ground-landmark-sensor-vault')).toHaveCount(1);
  await expect(page.getByTestId('ground-landmark-probe')).toHaveCount(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}
