import {test,expect,type Page} from '@playwright/test';
test.use({storageState:{cookies:[],origins:[]}});
async function reveal(page:Page){
 await page.goto('/');
 await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:25000});
 await page.getByTestId('captain-transport').click({timeout:25000});
 await page.getByTestId('transport-confirm').click();
 const board=page.getByTestId('ground-squad-board');
 const court=page.getByTestId('ground-landing-court-3d');
 await expect(court).toHaveAttribute('data-renderer-state','ready',{timeout:25000});
 await board.locator('[data-cell-id="2,4"]').click({button:'right'});
 await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-x','2');
 await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-walk-phase','idle',{timeout:30000});
 return board;
}
for(const width of [390,1280])test('same mission atlas versus old per-tile textures '+width,async({page,browser})=>{
 test.setTimeout(125000);await page.setViewportSize({width,height:850});
 const board=await reveal(page);
 const fog=await board.locator('[data-fog-state="unknown"]').count();
 await board.screenshot({path:'test-results/k47-world-atlas-after-'+width+'.png'});
 await page.reload();
 await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-y','4');
 expect(await board.locator('[data-fog-state="unknown"]').count()).toBe(fog);
 const old=await browser.newContext({viewport:{width,height:850}});
 try{
  await old.addInitScript(()=>{
   (window as typeof window & {__k47LegacyTiles?:boolean}).__k47LegacyTiles=true;
  });
  const before=await old.newPage(),prior=await reveal(before);
  await prior.screenshot({path:'test-results/k47-world-atlas-before-'+width+'.png'});
  expect(await prior.locator('[data-fog-state="unknown"]').count()).toBe(fog);
  await expect(prior.locator('[data-cell-id]')).toHaveCount(216);
 }finally{await old.close();}
});
