import {expect,test,type Page} from '@playwright/test';
test.use({storageState:{cookies:[],origins:[]}});
async function land(page:Page){
 await page.goto('/');
 await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:25000});
 await page.getByTestId('captain-transport').click({timeout:25000});
 await page.getByTestId('transport-confirm').click();
 const board=page.getByTestId('ground-squad-board');
 await expect(board).toBeVisible();
 await board.locator('[data-cell-id="2,4"]').click({button:'right'});
 await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-x','2');
 await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-y','4');
 await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-walk-phase','idle',{timeout:30000});
 return board;
}
for(const width of [390,1280]){
 test('visible industrial macro-patina on real rescue bay versus original floor '+width,async({page,browser})=>{
  test.setTimeout(125000);
  await page.setViewportSize({width,height:850});
  const after=await land(page);
  const bay=page.getByTestId('ground-rescue-bay');
  await expect(bay).toHaveAttribute('data-visible-deck-wear','k47-v1');
  await expect(after.locator('[data-cell-id]')).toHaveCount(216);
  const fog=await after.locator('[data-fog-state="unknown"]').count();
  const oldFloor=await after.locator('[data-testid^="ground-bay-floor-"]').count();
  expect(oldFloor).toBeGreaterThan(12);
  expect(await after.locator('path[fill="url(#ground-bay-industrial-wear)"]').count()).toBe(oldFloor);
  await after.screenshot({path:'test-results/k47-visible-deck-after-'+width+'.png'});
  await page.reload();
  await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-x','2');
  await expect(page.getByTestId('ground-rescue-bay')).toHaveAttribute('data-visible-deck-wear','k47-v1');
  expect(await after.locator('[data-fog-state="unknown"]').count()).toBe(fog);
  const previous=await browser.newContext({viewport:{width,height:850}});
  try{
   await previous.addInitScript(()=>{
    (window as typeof window&{__k47LegacyBayFloor?:boolean}).__k47LegacyBayFloor=true;
   });
   const before=await previous.newPage(),old=await land(before);
   await expect(before.getByTestId('ground-rescue-bay')).toHaveAttribute('data-visible-deck-wear','legacy');
   await expect(old.locator('path[fill="url(#ground-bay-industrial-wear)"]')).toHaveCount(0);
   expect(await old.locator('[data-fog-state="unknown"]').count()).toBe(fog);
   expect(await old.locator('[data-cell-id]').count()).toBe(216);
   await old.screenshot({path:'test-results/k47-visible-deck-before-'+width+'.png'});
  }finally{await previous.close();}
 });
}
