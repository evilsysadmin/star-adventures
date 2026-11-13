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
async function move(page:Page){
 const board=page.getByTestId('ground-squad-board');
 await board.locator('[data-cell-id="5,6"]').click({button:'right'});
 await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-x','5');
 await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-y','6');
 await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute(
  'data-walk-phase','idle',{timeout:30000});
 await expect(page.getByTestId('ground-landing-court-3d'))
  .toHaveAttribute('data-hangar-ready','true',{timeout:25000});
}

for(const width of [390,1280]){
 test('K-47 industrial skyline is visible above existing floor in actual follow view '+width,
 async({page,browser})=>{
  test.setTimeout(160000);
  await page.setViewportSize({width,height:850});
  const comparison=await browser.newContext({
   viewport:{width,height:850},storageState:{cookies:[],origins:[]},
  });
  try{
   const before=await comparison.newPage();
   await before.addInitScript(()=>{
    (window as typeof window&{__k47LegacyIndustrialSkyline?:boolean})
      .__k47LegacyIndustrialSkyline=true;
   });
   const oldBoard=await land(before);
   await expect(before.getByTestId('ground-industrial-skyline')).toHaveCount(0);
   await oldBoard.screenshot({
    path:'test-results/k47-skyline-before-landing-'+width+'.png'});
   const board=await land(page);
   const skyline=page.getByTestId('ground-industrial-skyline');
   await expect(skyline).toHaveCount(1);
   const group=skyline.locator(
    '[data-architectural-form="connected-glazed-research-industrial-gallery"]'+
    '[data-footprint~="5,7"][data-footprint~="6,7"]');
   await expect(group).toHaveCount(1);
   const footprint=(await group.getAttribute('data-footprint'))!.split(' ');
   await expect(group.getByTestId('ground-industrial-skyline-window'))
     .toHaveCount(footprint.length*2);
   await expect(group.getByTestId('ground-industrial-skyline-roof-plant'))
     .toHaveCount(1);
   const volume=await group.evaluate(node=>{
    const group=node as SVGGraphicsElement;
    const bounds=group.getBBox();
    return {
     width:bounds.width,height:bounds.height,
     passive:getComputedStyle(group).pointerEvents==='none',
     fakeCells:group.querySelectorAll('[data-cell-id],[data-officer-id],button,a').length,
    };
   });
   expect(volume.width).toBeGreaterThan(90);
   expect(volume.height).toBeGreaterThan(115);
   expect(volume.passive).toBe(true);
   expect(volume.fakeCells).toBe(0);
   await board.screenshot({
    path:'test-results/k47-skyline-after-landing-'+width+'.png'});
   // Same *real* movement and follow camera in both styles; never reveal
   // decorative walls by directly modifying game state.
   await move(before);
   await oldBoard.screenshot({
    path:'test-results/k47-skyline-before-follow-'+width+'.png'});
   await move(page);
   await board.screenshot({
    path:'test-results/k47-skyline-after-follow-'+width+'.png'});
   expect(await board.locator('polygon[data-cell-id]').count()).toBe(216);
   const unit=page.getByTestId('ground-unit-venn');
   await page.reload();
   await expect(unit).toHaveAttribute('data-grid-y','6');
   await expect(skyline).toHaveCount(1);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
     .toBe(true);
  }finally{await comparison.close();}
 });
}
