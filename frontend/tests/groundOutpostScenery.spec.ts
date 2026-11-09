import {expect,test} from '@playwright/test';

// Scenic artwork is a view-only replacement: actual tile picking, squad
// selection and checkpoint semantics must remain operational.
test.use({storageState:{cookies:[],origins:[]}});
for(const width of [390,1280]){
 test('authored planetary outpost landmarks and real squad selection '+width+'px',async({page})=>{
  test.setTimeout(100_000);
  page.setDefaultTimeout(15_000);
  await page.setViewportSize({width,height:850});
  await page.goto('/');
  await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:20_000});
  await page.getByTestId('captain-transport').click({timeout:25_000});
  await page.getByTestId('transport-confirm').click();
  const board=page.getByTestId('ground-squad-board');
  await expect(board).toBeVisible();
  await expect(page.getByTestId('ground-planet-backdrop')).toHaveCount(1);
  const exterior=page.getByTestId('ground-exterior-geology');
  await expect(exterior).toHaveCount(1);
  await expect(exterior).toHaveAttribute('pointer-events','none');
  await expect(page.getByTestId('ground-exterior-strata')).toHaveCount(1);
  // This is distant, decorative terrain only: it must add no fake grid cells
  // or hidden game objects, and turning on full-map must not reveal the fog.
  await expect(exterior.locator('[data-cell-id], [data-fog-cell], [data-officer-id]')).toHaveCount(0);
  const initiallyUnknown=await board.locator('[data-fog-state="unknown"]').count();
  expect(initiallyUnknown).toBeGreaterThan(0);
  for(const id of ['probe','sensor-vault','relief-point','perimeter-uplink','beam-out'])
   await expect(page.getByTestId('ground-landmark-'+id)).toHaveCount(1);
  await expect(page.getByTestId('ground-landmark-sensor-vault').locator('text.ground-landmark-name')).toHaveText('ARCHIVO');
  await expect(page.getByTestId('ground-landmark-probe').locator('text.ground-landmark-name')).toHaveText('SONDA');
  await expect(page.getByTestId('ground-landmark-relief-point').locator('text.ground-landmark-name')).toHaveText('SOCORRO');
  await expect(page.getByTestId('ground-landmark-perimeter-uplink').locator('text.ground-landmark-name')).toHaveText('BALIZA');
  await expect(page.getByTestId('ground-landmark-beam-out').locator('text.ground-landmark-name')).toHaveText('EXTRACCIÓN');
  if(width===1280){
   // Normal follow framing now keeps officers/architecture prominent.
   // The full 18x12 authored map remains accessible through overview.
   await expect.poll(async()=>board.evaluate(node=>
     (node as SVGSVGElement).viewBox.baseVal.height)).toBeGreaterThan(330);
   const camera=await board.evaluate(node=>{
     const svg=node as SVGSVGElement,view=svg.viewBox.baseVal;
     const rect=svg.getBoundingClientRect();
     const sprite=svg.querySelector('[data-testid="ground-officer-sprite-venn"]')!
       .getBoundingClientRect();
     const parent=svg.parentElement!.getBoundingClientRect();
     return {
       ratio:view.width/view.height,frameRatio:rect.width/rect.height,
       spriteWidth:sprite.width,spriteHeight:sprite.height,
       sceneHeight:parent.height,
     };
   });
   expect(Math.abs(camera.ratio-camera.frameRatio)).toBeLessThan(.08);
   expect(camera.spriteHeight).toBeGreaterThan(75);
   expect(camera.spriteWidth).toBeGreaterThan(50);
   expect(camera.sceneHeight).toBeGreaterThan(320);
   await expect(page.locator('.ground-squad-event-strip')).toHaveCount(1);
  }
  if(width===390){
   // Mobile follow mode deliberately crops distant facilities: this is the
   // point of tracking an officer. In explicit FULL MAP every named landmark
   // must remain on screen and none of the neighbouring signs may overlap.
   await page.getByTestId('ground-camera-toggle').click();
   await expect(board).toHaveAttribute('viewBox','-72 0 1280 640');
   expect(await board.locator('[data-fog-state="unknown"]').count()).toBe(initiallyUnknown);
   const clipping=await page.evaluate(()=>{
    const board=document.querySelector('[data-testid="ground-squad-board"]')!.getBoundingClientRect();
    return ['relief-point','perimeter-uplink'].map(id=>{
     const sign=document.querySelector('[data-testid="ground-landmark-'+id+'"] text')!.getBoundingClientRect();
     return {id,left:sign.left-board.left,right:board.right-sign.right};
    });
   });
   for(const label of clipping){
    expect(label.left,label.id).toBeGreaterThanOrEqual(0);
    expect(label.right,label.id).toBeGreaterThanOrEqual(0);
   }
   const collides=await page.evaluate(()=>{
     const box=(id:string)=>document.querySelector(
       '[data-testid="ground-landmark-'+id+'"] text')!.getBoundingClientRect();
     return [['probe','sensor-vault'],['relief-point','perimeter-uplink']]
      .map(([a,b])=>{
       const x=box(a),y=box(b);
       return x.left<y.right&&x.right>y.left&&x.top<y.bottom&&x.bottom>y.top;
      });
   });
   expect(collides).toEqual([false,false]);
   await page.getByTestId('ground-camera-toggle').click();
   await expect(page.getByTestId('ground-camera-toggle')).toHaveText('Mapa completo');
  }
  // Artwork is non-interactive: pointer-driven officer selection is unchanged.
  await page.getByTestId('ground-unit-dorn').click();
  await expect(page.getByTestId('ground-select-dorn')).toHaveAttribute('aria-pressed','true');
  await expect(page.getByTestId('ground-select-venn')).toHaveAttribute('aria-pressed','false');
  await page.getByTestId('ground-unit-venn').click();
  await expect(page.getByTestId('ground-select-venn')).toHaveAttribute('aria-pressed','true');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await board.screenshot({path:'test-results/planetary-outpost-'+width+'.png'});
 });
}
