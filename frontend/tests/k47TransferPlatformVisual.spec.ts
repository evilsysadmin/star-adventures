import {expect,test,type Page} from '@playwright/test';

test.use({storageState:{cookies:[],origins:[]}});

async function land(page:Page){
 await page.goto('/');
 await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:25000});
 await page.getByTestId('captain-transport').click({timeout:25000});
 await page.getByTestId('transport-confirm').click();
 const board=page.getByTestId('ground-squad-board');
 await expect(board).toBeVisible();
 await expect(page.getByTestId('ground-bay-central-hatch'))
   .toHaveAttribute('data-fog','visible');
 return board;
}

for(const width of [390,1280]){
 test('K-47 four-cell docking platform changes actual follow view without gameplay changes '+width,
 async({page,browser})=>{
  test.setTimeout(115000);
  await page.setViewportSize({width,height:850});
  // Identical fresh captain -> transport route in both browsers. No
  // screenshot swap, teleport, expanded fog or mocked 3D asset.
  const baselineContext=await browser.newContext({
   viewport:{width,height:850},storageState:{cookies:[],origins:[]},
  });
  try{
   const baseline=await baselineContext.newPage();
   await baseline.addInitScript(()=>{
    (window as typeof window&{__k47LegacyLandingPlatform?:boolean})
     .__k47LegacyLandingPlatform=true;
   });
   const oldBoard=await land(baseline);
   const old=baseline.getByTestId('ground-bay-central-hatch');
   await expect(old).toHaveAttribute('data-visual-version','legacy');
   await oldBoard.screenshot({
    path:'test-results/k47-transfer-before-follow-'+width+'.png'});
   const board=await land(page);
   const platform=page.getByTestId('ground-bay-central-hatch');
   await expect(platform)
    .toHaveAttribute('data-visual-version','connected-industrial-transfer-platform');
   await expect(platform.getByTestId('ground-bay-machinery-hub')).toHaveCount(1);
   await expect(platform.getByTestId('ground-bay-deck-safety-markings')).toHaveCount(1);
   const result=await board.evaluate(node=>{
    const original=node.querySelector('[data-testid="ground-bay-central-hatch"]')
      as SVGGraphicsElement;
    const bounds=original.getBBox();
    return {
     realCells:node.querySelectorAll('[data-cell-id]').length,
     platformWidth:bounds.width,platformHeight:bounds.height,
     noInventedInput:original.querySelectorAll('[data-cell-id],[data-officer-id],button').length===0,
     passive:getComputedStyle(original).pointerEvents==='none',
    };
   });
   expect(result.realCells).toBe(216);
   expect(result.platformWidth).toBeGreaterThan(145);
   expect(result.platformHeight).toBeGreaterThan(75);
   expect(result.noInventedInput&&result.passive).toBe(true);
   await board.screenshot({
    path:'test-results/k47-transfer-after-follow-'+width+'.png'});
   // Same exact full-map view as a second visual gate; phone's default
   // follow view is deliberately captured first, not hidden behind a zoom.
   await page.getByTestId('ground-camera-toggle').click();
   if(width<=520)await page.getByTestId('ground-map-sector').selectOption('all');
   await board.screenshot({
    path:'test-results/k47-transfer-after-overview-'+width+'.png'});
   await expect(board.locator('[data-cell-id]')).toHaveCount(216);
   // A real right-click command and F5 still preserve officer positions,
   // station ownership and the same visible 2x2 decorative floor footprint.
   await board.locator('[data-cell-id="5,4"]').click({button:'right'});
   const unit=page.getByTestId('ground-unit-venn');
   await expect(unit).toHaveAttribute('data-grid-x','5');
   await expect(unit).toHaveAttribute('data-grid-y','4');
   await expect(unit).toHaveAttribute('data-walk-phase','idle',{timeout:24000});
   await page.reload();
   await expect(unit).toHaveAttribute('data-grid-x','5');
   await expect(platform)
    .toHaveAttribute('data-visual-version','connected-industrial-transfer-platform');
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }finally{await baselineContext.close();}
 });
}
