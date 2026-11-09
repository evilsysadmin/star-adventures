import {expect,test,type Page} from '@playwright/test';

// The camera is presentation only: resizing it must not change the pure
// 18×12 landing grid, route planning, squad state, fog or F5 continuity.
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
 await expect.poll(async()=>(await cameraMetrics(page)).height).toBeGreaterThan(330);
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
 // Old follow camera was effectively a nearly full 18x12 map (height ~548).
 // Gameplay camera must show more of the actual officer and environment.
 expect(before.height).toBeLessThan(430);
 const horizontalTilePixels=before.screenWidth*80/before.width;
 expect(horizontalTilePixels).toBeGreaterThan(165);
 const unknown=page.locator('[data-fog-cell="10,4"]');
 await expect(unknown).toHaveAttribute('data-fog-state','unknown');
 const shroud=await unknown.evaluate(el=>({
   fill:el.getAttribute('fill'),
   opacity:el.getAttribute('fill-opacity'),
   pointerEvents:getComputedStyle(el.parentElement?.parentElement).pointerEvents,
 }));
 expect(shroud.fill).toBe('url(#ground-undiscovered-gradient)');
 expect(shroud.opacity).toBe('1');
 expect(shroud.pointerEvents).toBe('none');
 await board.screenshot({path:'test-results/away-gameplay-framing-1280.png'});
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
 await expect(board).toHaveAttribute('viewBox','-72 0 1280 640');
 await page.getByTestId('ground-camera-toggle').click();
 await expect.poll(async()=>(await cameraMetrics(page)).height).toBeGreaterThan(330);
 await page.reload();
 await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-x','6');
 await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-y','3');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('mobile follow keeps existing playable framing and larger officer art',async({page})=>{
 test.setTimeout(90_000);
 await page.setViewportSize({width:390,height:850});
 await land(page);
 await expect.poll(async()=>(await cameraMetrics(page)).aspectError).toBeLessThan(.08);
 const camera=await cameraMetrics(page);
 // Follow camera matches the full portrait stage, rather than preserving
 // the old 440×300 letterboxed viewport.
 expect(camera.height).toBeGreaterThan(300);
 expect(camera.width).toBeLessThan(440);
 expect(camera.aspectError).toBeLessThan(.08);
 expect(camera.screenHeight).toBeGreaterThan(700);
 expect(camera.width).toBeGreaterThan(215);
 expect(camera.width).toBeLessThan(300);
 await expect(page.locator('[data-fog-cell="10,4"]'))
   .toHaveAttribute('data-fog-state','unknown');
 await page.getByTestId('ground-squad-board').screenshot({
  path:'test-results/away-gameplay-framing-390.png',
 });
 // The wider world needs smaller people, not smaller accessible hit targets.
 const scaled=page.getByTestId('ground-officer-visible-art-venn');
 await expect(scaled).toHaveAttribute('transform','translate(0 9) scale(.76) translate(0 -9)');
 await expect(scaled).toHaveCSS('pointer-events','none');
 await expect(page.getByTestId('ground-officer-hit-venn')).toHaveAttribute('width','36');
 await expect(page.getByTestId('ground-officer-hit-venn')).toHaveAttribute('height','57');
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
