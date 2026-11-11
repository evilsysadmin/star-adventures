import {expect,test,type Page} from '@playwright/test';
import {waypointRibbonShift} from '../src/groundWaypointRibbon';

test('a near-edge waypoint moves its panel inside the camera while the anchor stays fixed',()=>{
 const frame={left:280,width:260};
 const shift=waypointRibbonShift(520,0,70,frame);
 expect(shift).not.toBeNull();
 expect(shift!).toBeLessThan(0);
 const center=520+shift!;
 const half=70*.78/2;
 expect(center-half).toBeGreaterThanOrEqual(frame.left+8);
 expect(center+half).toBeLessThanOrEqual(frame.left+frame.width-8);
 // A different station with a pre-existing art-directed offset is clamped
 // using that same offset; the world station never changes coordinates.
 const offset=waypointRibbonShift(520,76,68,frame);
 expect(offset).toBeLessThan(0);
 expect(520+76+offset!+68*.78/2).toBeLessThanOrEqual(532);
});

test('onscreen stations remain anchored and offscreen/invalid pins stay offscreen',()=>{
 const frame={left:300,width:250};
 expect(waypointRibbonShift(420,0,65,frame)).toBe(0);
 expect(waypointRibbonShift(290,0,65,frame)).toBeNull();
 expect(waypointRibbonShift(551,0,65,frame)).toBeNull();
 expect(waypointRibbonShift(539,0,65,{left:280,width:260})).toBeNull();
 expect(waypointRibbonShift(420,0,600,frame)).toBeNull();
 expect(waypointRibbonShift(420,0,65,{left:0,width:0})).toBeNull();
 expect(waypointRibbonShift(NaN,0,65,frame)).toBeNull();
 expect(waypointRibbonShift(420,0,65,frame,0)).toBeNull();
});

test.use({storageState:{cookies:[],origins:[]}});
async function land(page:Page){
 await page.goto('/');
 await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:25000});
 await page.getByTestId('captain-transport').click();
 await page.getByTestId('transport-confirm').click();
 await expect(page.getByTestId('ground-squad-board')).toBeVisible();
}

for(const width of [360,390,430]){
 test('focused mobile objective ribbons stay inside real camera '+width,async({page})=>{
  test.setTimeout(100_000);
  await page.setViewportSize({width,height:850});
  await land(page);
  const board=page.getByTestId('ground-squad-board');
  await expect(page.getByTestId('ground-camera-toggle')).toHaveAttribute('aria-pressed','true');
  const observed=await board.evaluate(svg=>{
   const frame=svg.getBoundingClientRect();
   return [...svg.querySelectorAll('[data-testid^="ground-waypoint-label-"]')]
     .filter(n=>getComputedStyle(n).visibility==='visible')
     .map(n=>{
       const r=n.getBoundingClientRect();
       return {id:n.getAttribute('data-testid'),left:r.left-frame.left,
         right:r.right-frame.left,width:frame.width,
         shift:n.getAttribute('data-ribbon-shift'),
         passive:getComputedStyle(n).pointerEvents==='none'};
     });
  });
  // Capture *before* any assertion: failure at a narrow edge still leaves
  // the visual evidence needed to fix geometry instead of guessing.
  await page.screenshot({path:'test-results/away-camera-ribbons-'+width+'.png'});
  expect(observed.length).toBeGreaterThan(0);
  for(const label of observed){
   expect(label.passive,label.id).toBe(true);
   expect(label.left,label.id+' left').toBeGreaterThanOrEqual(-1);
   expect(label.right,label.id+' right').toBeLessThanOrEqual(label.width+1);
  }
  await expect(board.locator('polygon[data-cell-id]')).toHaveCount(216);
  await page.getByTestId('ground-camera-toggle').click();
  await expect(board).toHaveAttribute('viewBox','-72 0 1280 640');
  await expect(page.getByTestId('ground-waypoint-label-probe'))
    .toHaveAttribute('transform','translate(76 -45) scale(.78)');
  // Full-map view uses original art positions; no HUD pinning to viewport.
  await expect(page.getByTestId('ground-waypoint-label-perimeter-uplink'))
    .toHaveAttribute('data-ribbon-shift','0.00');
  await page.reload();
  await expect(page.getByTestId('ground-camera-toggle')).toHaveAttribute('aria-pressed','true');
  await expect(board.locator('[data-cell-id]')).toHaveCount(216);
 });
}
