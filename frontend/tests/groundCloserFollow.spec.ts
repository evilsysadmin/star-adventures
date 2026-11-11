import {expect,test,type Page} from '@playwright/test';

// The zoom is presentation-only. Source terrain, fog, navigation and campaign
// saves remain the exact same 18x12 canonical data, not enlarged fake tiles.
test.use({storageState:{cookies:[],origins:[]}});

async function land(page:Page){
 await page.goto('/');
 await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:25000});
 await page.getByTestId('captain-transport').click({timeout:25000});
 await page.getByTestId('transport-confirm').click();
 await expect(page.getByTestId('ground-squad-board')).toBeVisible();
}

for(const width of [360,390,430]){
 test('closer mobile follow fills playable vertical stage without hiding orders '+width,async({page})=>{
  test.setTimeout(110_000);
  await page.setViewportSize({width,height:850});
  await land(page);
  const board=page.getByTestId('ground-squad-board');
  const metrics=await board.evaluate(node=>{
   const svg=node as SVGSVGElement,frame=svg.getBoundingClientRect(),v=svg.viewBox.baseVal;
   const top=document.querySelector('.ground-squad-event-strip')!.getBoundingClientRect().top;
   const squad=['venn','dorn','mira'].map(id=>{
    const unit=svg.querySelector('[data-testid="ground-unit-'+id+'"]')!;
    const r=unit.getBoundingClientRect();
    return {id,top:r.top,bottom:r.bottom,left:r.left,right:r.right};
   });
   return {
    cameraHeight:v.height,cameraWidth:v.width,
    aspectError:Math.abs(v.width/v.height-frame.width/frame.height),
    horizontalTilePixels:80*frame.width/v.width,
    statusTop:top,squad,
    noOverflow:document.documentElement.scrollWidth<=innerWidth,
   };
  });
  expect(metrics.cameraHeight).toBe(480);
  expect(metrics.aspectError).toBeLessThan(.05);
  expect(metrics.horizontalTilePixels).toBeGreaterThan(135);
  expect(metrics.noOverflow).toBe(true);
  for(const officer of metrics.squad){
   expect(officer.left,officer.id+' left').toBeGreaterThanOrEqual(-1);
   expect(officer.right,officer.id+' right').toBeLessThanOrEqual(width+1);
   expect(officer.bottom,officer.id+' bottom').toBeLessThan(metrics.statusTop-3);
  }
  await expect(board.locator('polygon[data-cell-id]')).toHaveCount(216);
  await page.screenshot({path:'test-results/away-closer-follow-'+width+'.png'});
  await board.locator('[data-cell-id="2,4"]').click({button:'right'});
  await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-x','2');
  await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-y','4');
  await page.reload();
  await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-x','2');
  await page.getByTestId('ground-camera-toggle').click();
  await expect(board).toHaveAttribute('viewBox','-72 0 1280 640');
  await page.getByTestId('ground-camera-toggle').click();
  await expect.poll(async()=>board.evaluate(el=>(el as SVGSVGElement).viewBox.baseVal.height))
   .toBe(480);
 });
}
