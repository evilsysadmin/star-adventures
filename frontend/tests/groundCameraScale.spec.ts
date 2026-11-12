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

for(const width of [390,430]){
 test('mobile full map can inspect actual sectors without resizing game state '+width,async({page})=>{
  test.setTimeout(160_000);
  page.setDefaultTimeout(15_000);
  await page.setViewportSize({width,height:850});
  await land(page);
  const board=page.getByTestId('ground-squad-board');
  const squad=page.getByTestId('ground-unit-venn');
  await expect(page.getByTestId('ground-map-sector')).toHaveCount(0);
  await page.getByTestId('ground-camera-toggle').click();

  const sectors=page.getByTestId('ground-map-sector');
  await expect(sectors).toBeVisible();
  await expect(sectors).toHaveValue('west');
  await expect(board).not.toHaveAttribute('viewBox','-72 0 1280 640');
  await board.screenshot({path:'test-results/away-sector-default-'+width+'.png'});

  // The all-map choice remains one explicit tap away with exact old frame,
  // complete fog and all 216 canonical selectable cells.
  await sectors.selectOption('all');
  await expect(board).toHaveAttribute('viewBox','-72 0 1280 640');
  await expect(board.locator('[data-cell-id]')).toHaveCount(216);
  await board.screenshot({path:'test-results/away-overview-portrait-'+width+'.png'});

  // Unknown regions cannot masquerade as an empty/broken viewport.
  // The option unlocks ONLY once the squad actually charts that sector.
  await expect(sectors.locator('option[value="west"]')).toBeEnabled();
  // Chromium's accessibility-enabled state for <option> is not always
  // identical to the native HTML disabled flag. Assert the actual browser
  // property AND serialized attribute instead of a misleading role matcher.
  const eastOption=sectors.locator('option[value="east"]');
  await expect(eastOption).toHaveAttribute('disabled','');
  expect(await eastOption.evaluate(node=>(node as HTMLOptionElement).disabled)).toBe(true);
  const initial=await squad.getAttribute('data-grid-x');
  await sectors.selectOption('west');
  const west=await board.evaluate(node=>{
    const svg=node as SVGSVGElement,v=svg.viewBox.baseVal,r=svg.getBoundingClientRect();
    return {x:v.x,y:v.y,width:v.width,height:v.height,
      aspectError:Math.abs(v.width/v.height-r.width/r.height)};
  });
  expect(west.width).toBeLessThan(400);
  expect(west.height).toBe(520);
  expect(west.aspectError).toBeLessThan(.08);
  await expect(squad).toHaveAttribute('data-grid-x',initial!);
  // The inspector is docked away from the actual officer silhouette and
  // mission briefing, including at the narrowest tested portrait width.
  const overlaps=await page.evaluate(()=>{
    const box=(sel:string)=>document.querySelector(sel)!.getBoundingClientRect();
    const i=box('.ground-squad-viewbar');
    const unit=box('[data-testid="ground-unit-venn"]');
    const mission=box('.mission-transmission');
    const hit=(a:DOMRect,b:DOMRect)=>a.left<b.right&&a.right>b.left&&
      a.top<b.bottom&&a.bottom>b.top;
    return {unit:hit(i,unit),mission:hit(i,mission)};
  });
  expect(overlaps).toEqual({unit:false,mission:false});
  // A real right-click order must still select a canonical free tile after
  // changing the world-space camera projection.
  await board.locator('[data-cell-id="2,4"]').click({button:'right'});
  await expect(squad).toHaveAttribute('data-grid-x','2');
  await expect(squad).toHaveAttribute('data-grid-y','4');
  await expect(squad).toHaveAttribute('data-walk-phase','idle',{timeout:25000});
  await board.screenshot({path:'test-results/away-sector-west-'+width+'.png'});

  await sectors.selectOption('all');
  await expect(board).toHaveAttribute('viewBox','-72 0 1280 640');
  // Actually explore the east service yard before offering a close-up;
  // no direct state mutation or test-only fog override is permitted.
  await board.locator('[data-cell-id="15,5"]').click({button:'right'});
  await expect(squad).toHaveAttribute('data-grid-x','15');
  await expect(squad).toHaveAttribute('data-grid-y','5');
  await expect(squad).toHaveAttribute('data-walk-phase','idle',{timeout:30000});
  await expect(eastOption).not.toHaveAttribute('disabled');
  expect(await eastOption.evaluate(node=>(node as HTMLOptionElement).disabled)).toBe(false);
  await sectors.selectOption('east');
  const east=await board.evaluate(node=>{
    const svg=node as SVGSVGElement,v=svg.viewBox.baseVal,r=svg.getBoundingClientRect();
    return {x:v.x,width:v.width,height:v.height,
      aspectError:Math.abs(v.width/v.height-r.width/r.height)};
  });
  expect(east.x-west.x).toBeGreaterThan(250);
  expect(east.width).toBeLessThan(400);
  expect(east.height).toBe(520);
  expect(east.aspectError).toBeLessThan(.08);
  await expect(board.locator('[data-fog-cell="15,5"]')).toHaveCount(0);
  await expect(board.locator('[data-fog-cell="16,10"]')).toHaveAttribute('data-fog-state','unknown');
  await board.screenshot({path:'test-results/away-sector-east-'+width+'.png'});

  await sectors.selectOption('all');
  await expect(board).toHaveAttribute('viewBox','-72 0 1280 640');
  await page.getByTestId('ground-camera-toggle').click();
  await expect(sectors).toHaveCount(0);
  const followed=await cameraMetrics(page);
  // Returning from the 520-unit sector inspector restores the intentionally
  // closer 480-unit squad follow camera, not the sector framing.
  expect(followed.height).toBe(480);
  await page.reload();
  await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-x','15');
  await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-y','5');
  await expect(page.getByTestId('ground-map-sector')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}

test('desktop map remains a full, uncropped 18x12 overview without mobile sector HUD',async({page})=>{
 await page.setViewportSize({width:1280,height:850});
 await land(page);
 await page.getByTestId('ground-camera-toggle').click();
 await expect(page.getByTestId('ground-squad-board')).toHaveAttribute('viewBox','-72 0 1280 640');
 await expect(page.getByTestId('ground-map-sector')).toHaveCount(0);
});
