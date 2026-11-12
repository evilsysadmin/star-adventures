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
 await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-walk-phase','idle',{timeout:30000});
 return board;
}
for(const width of [390,1280])test('real K-47 connected industrial deck A/B '+width,async({page,browser})=>{
 test.setTimeout(135000);
 await page.setViewportSize({width,height:850});
 const board=await land(page),bay=page.getByTestId('ground-rescue-bay');
 await expect(bay).toHaveAttribute('data-bay-floor-visual','industrial-v2');
 await expect(page.getByTestId('ground-bay-industrial-skin')).toHaveCount(1);
 const originalCells=await board.locator('[data-testid^="ground-bay-floor-"]').count();
 expect(originalCells).toBeGreaterThan(12);
 const fog=await board.locator('[data-fog-state="unknown"]').count();
 await expect(board.locator('[data-cell-id]')).toHaveCount(216);
 const clipped=await bay.evaluate(el=>[
  el.querySelectorAll('#ground-bay-visible-panels path').length,
  el.querySelectorAll('#ground-bay-remembered-panels path').length
 ]);
 expect(clipped[0]+clipped[1]).toBe(originalCells);
 await board.screenshot({path:'test-results/k47-industrial-deck-after-'+width+'.png'});
 await page.reload();
 await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-x','2');
 await expect(page.getByTestId('ground-bay-industrial-skin')).toHaveCount(1);
 expect(await board.locator('[data-fog-state="unknown"]').count()).toBe(fog);
 const old=await browser.newContext({viewport:{width,height:850}});
 try{
  await old.addInitScript(()=>{
   (window as typeof window&{__k47LegacyIndustrialFloor?:boolean}).__k47LegacyIndustrialFloor=true;
  });
  const before=await old.newPage(),prior=await land(before);
  await expect(before.getByTestId('ground-rescue-bay')).toHaveAttribute('data-bay-floor-visual','legacy');
  await expect(before.getByTestId('ground-bay-industrial-skin')).toHaveCount(0);
  expect(await prior.locator('[data-fog-state="unknown"]').count()).toBe(fog);
  await expect(prior.locator('[data-cell-id]')).toHaveCount(216);
  await prior.screenshot({path:'test-results/k47-industrial-deck-before-'+width+'.png'});
 }finally{await old.close();}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
