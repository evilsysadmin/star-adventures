import {expect,test,type Page} from '@playwright/test';

test.use({storageState:{cookies:[],origins:[]}});

async function land(page:Page){
 await page.goto('/');
 await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:25000});
 await page.getByTestId('captain-transport').click({timeout:25000});
 await page.getByTestId('transport-confirm').click();
 const board=page.getByTestId('ground-squad-board');
 await expect(board).toBeVisible();
 return board;
}
async function approach(page:Page){
 const board=page.getByTestId('ground-squad-board');
 await board.locator('[data-cell-id="5,4"]').click({button:'right'});
 await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-x','5');
 await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-y','4');
 await expect(page.getByTestId('ground-unit-venn'))
  .toHaveAttribute('data-walk-phase','idle',{timeout:27000});
}

for(const width of [390,1280]){
 test('large connected industrial apron is visible on only real K-47 free cells '+width,
 async({page,browser})=>{
  test.setTimeout(145000);
  await page.setViewportSize({width,height:850});
  const baseline=await browser.newContext({
   viewport:{width,height:850},storageState:{cookies:[],origins:[]},
  });
  try{
   const old=await baseline.newPage();
   await old.addInitScript(()=>{
    (window as typeof window&{__k47LegacyIndustrialApron?:boolean})
      .__k47LegacyIndustrialApron=true;
   });
   const oldBoard=await land(old);
   await expect(old.getByTestId('ground-industrial-apron')).toHaveCount(0);
   await oldBoard.screenshot({
    path:'test-results/k47-macro-apron-before-landing-'+width+'.png'});
   const board=await land(page);
   const apron=page.getByTestId('ground-industrial-apron');
   await expect(apron).toHaveCount(1);
   const ids=(await apron.getAttribute('data-known-cell-ids')||'')
    .split(' ').filter(Boolean);
   expect(ids.length).toBeGreaterThanOrEqual(8);
   expect(new Set(ids).size).toBe(ids.length);
   for(const id of ids){
    await expect(board.locator('[data-cell-id="'+id+'"]')).toHaveCount(1);
    await expect(board.locator(
      '[data-fog-cell="'+id+'"][data-fog-state="unknown"]')).toHaveCount(0);
    await expect(page.getByTestId('ground-bay-floor-'+id)).toHaveCount(1);
   }
   const art=await apron.evaluate(element=>({
    passive:getComputedStyle(element).pointerEvents==='none',
    inputTargets:element.querySelectorAll('[data-cell-id],[data-officer-id],button').length,
    visibleClip:element.querySelectorAll('#k47-apron-visible-clip path').length,
    unknownCells:element.querySelectorAll('[data-fog-state="unknown"]').length,
   }));
   expect(art.passive).toBe(true);
   expect(art.inputTargets).toBe(0);
   expect(art.visibleClip).toBeGreaterThan(0);
   expect(art.unknownCells).toBe(0);
   await expect(page.getByTestId('ground-bay-central-hatch')).toHaveCount(1);
   await board.screenshot({
    path:'test-results/k47-macro-apron-after-landing-'+width+'.png'});
   await approach(old);
   await oldBoard.screenshot({
    path:'test-results/k47-macro-apron-before-follow-'+width+'.png'});
   await approach(page);
   await board.screenshot({
    path:'test-results/k47-macro-apron-after-follow-'+width+'.png'});
   await expect(board.locator('polygon[data-cell-id]')).toHaveCount(216);
   await page.reload();
   await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-x','5');
   await expect(apron).toHaveCount(1);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
    .toBe(true);
  }finally{await baseline.close();}
 });
}
