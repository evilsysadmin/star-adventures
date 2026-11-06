import {expect,test,type Page} from '@playwright/test';

// The camera is presentation only: resizing it must not change the pure
// 13×10 landing grid, route planning, squad state, fog or F5 continuity.
test.use({storageState:{cookies:[],origins:[]}});

async function land(page:Page){
 await page.goto('/');
 await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:20_000});
 await page.getByTestId('captain-transport').click({timeout:25_000});
 await page.getByTestId('transport-confirm').click();
 await expect(page.getByTestId('ground-squad-board')).toBeVisible();
}

async function cameraMetrics(page:Page){
 return page.getByTestId('ground-squad-board').evaluate(node=>{
  const svg=node as SVGSVGElement,view=svg.viewBox.baseVal;
  const rect=svg.getBoundingClientRect();
  return {
   width:view.width,height:view.height,
   screenWidth:rect.width,screenHeight:rect.height,
   aspectError:Math.abs(view.width/view.height-rect.width/rect.height),
  };
 });
}

test('desktop zoom fits real viewport and still picks exact grid cells after resize',async({page})=>{
 test.setTimeout(110_000);
 page.setDefaultTimeout(16_000);
 await page.setViewportSize({width:1280,height:850});
 await land(page);
 const board=page.getByTestId('ground-squad-board'),venn=page.getByTestId('ground-unit-venn');
 await expect.poll(async()=>(await cameraMetrics(page)).height).toBe(280);
 // A full sprite atlas is not necessarily painted at its geometric center.
 // Clicking the officer <g> must still select the actual officer, not floor.
 await page.getByTestId('ground-unit-dorn').click();
 await expect(page.getByTestId('ground-select-dorn')).toHaveAttribute('aria-pressed','true');
 await page.getByTestId('ground-unit-mira').click();
 await expect(page.getByTestId('ground-select-mira')).toHaveAttribute('aria-pressed','true');
 await page.getByTestId('ground-unit-venn').click();
 await expect(page.getByTestId('ground-select-venn')).toHaveAttribute('aria-pressed','true');
 const before=await cameraMetrics(page);
 expect(before.aspectError).toBeLessThan(.08);
 expect(before.screenHeight).toBeGreaterThan(320);
 await board.locator('[data-cell-id="5,4"]').click({button:'right'});
 await expect(venn).toHaveAttribute('data-grid-x','5');
 await expect(venn).toHaveAttribute('data-grid-y','4');
 await page.setViewportSize({width:1600,height:900});
 await expect.poll(async()=>(await cameraMetrics(page)).aspectError,{timeout:10_000})
  .toBeLessThan(.08);
 const resized=await cameraMetrics(page);
 expect(resized.width).not.toBe(before.width);
 await board.locator('[data-cell-id="6,3"]').click({button:'right'});
 await expect(venn).toHaveAttribute('data-grid-x','6');
 await expect(venn).toHaveAttribute('data-grid-y','3');
 await board.screenshot({path:'test-results/away-desktop-large-zoom.png'});
 await page.getByTestId('ground-camera-toggle').click();
 await expect(board).toHaveAttribute('viewBox','0 0 1120 550');
 await page.getByTestId('ground-camera-toggle').click();
 await expect.poll(async()=>(await cameraMetrics(page)).height).toBe(280);
 await page.reload();
 await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-x','6');
 await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-y','3');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('mobile follow keeps existing playable framing and larger officer art',async({page})=>{
 test.setTimeout(90_000);
 await page.setViewportSize({width:390,height:850});
 await land(page);
 const camera=await cameraMetrics(page);
 expect(camera.height).toBe(300);
 expect(camera.width).toBe(440);
 const art=page.getByTestId('ground-officer-sprite-venn');
 await expect(art).toHaveAttribute('width','54');
 await expect(art).toHaveAttribute('height','80');
 await page.getByTestId('ground-unit-dorn').click();
 await expect(page.getByTestId('ground-select-dorn')).toHaveAttribute('aria-pressed','true');
 await page.getByTestId('ground-unit-mira').click();
 await expect(page.getByTestId('ground-select-mira')).toHaveAttribute('aria-pressed','true');
 await page.getByTestId('ground-squad-board').screenshot({
  path:'test-results/away-mobile-legible-squad.png',
 });
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
