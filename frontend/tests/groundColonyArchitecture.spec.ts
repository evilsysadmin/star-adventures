import {expect,test,type Page} from '@playwright/test';

// Environment is decoration, not a replacement for real landing orders.
test.use({storageState:{cookies:[],origins:[]}});
async function orderCell(page:Page,x:number,y:number) {
 const board=page.getByTestId('ground-squad-board');
 const point=await board.evaluate((node,{x,y})=>{
  const svg=node as SVGSVGElement,p=svg.createSVGPoint();
  p.x=440+(x-y)*40;p.y=52+(x+y)*20;
  const ctm=svg.getScreenCTM();
  if(!ctm)throw new Error('Missing SVG picking transform');
  const q=p.matrixTransform(ctm),rect=svg.getBoundingClientRect();
  return {x:q.x-rect.left,y:q.y-rect.top};
 },{x,y});
 await board.click({button:'right',position:point});
}

for(const width of [390,1280]) {
 test('outpost buildings occupy real blocked cells and obey fog at '+width,async({page})=>{
  test.setTimeout(120_000);
  page.setDefaultTimeout(20_000);
  await page.setViewportSize({width,height:850});
  await page.goto('/');
  await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:25_000});
  await page.getByTestId('captain-transport').click({timeout:25_000});
  await page.getByTestId('transport-confirm').click();
  const board=page.getByTestId('ground-squad-board');
  await expect(board).toBeVisible();
  await page.getByTestId('ground-camera-toggle').click();
  await expect(board).toHaveAttribute('viewBox','-72 0 1280 640');
  await expect(page.getByTestId('ground-colony-walls')).toHaveCount(1);
  await expect(page.getByTestId('ground-colony-connected-roofs')).toHaveCount(1);
  await expect(page.getByTestId('ground-colony-gateways')).toHaveCount(1);
  // Never reveal an unopened entry before both physical wall ends are known.
  await expect(page.getByTestId('ground-gateway-8,4')).toHaveCount(0);
  await expect(page.getByTestId('ground-gateway-8,6')).toHaveCount(0);
  // Two visible contiguous wall cells share an actual roof. The distant
  // eastern wall must not disclose an unseen connection through the fog.
  await expect(page.getByTestId('ground-colony-roof-5,7-to-6,7')).toHaveCount(1);
  const facade=page.getByTestId('ground-colony-facade-5,7-to-6,7');
  await expect(facade).toHaveAttribute('data-fog','visible');
  // The actual connected wall carries two glazing panes and structural
  // mullions. It must be tall enough to read as a building, not floor trim.
  const paneSize=await facade.evaluate(element=>{
    const bounds=(element as SVGGraphicsElement).getBBox();
    return {width:bounds.width,height:bounds.height,
      pointerEvents:getComputedStyle(element).pointerEvents};
  });
  expect(paneSize.width).toBeGreaterThan(35);
  expect(paneSize.height).toBeGreaterThan(25);
  expect(paneSize.pointerEvents).toBe('none');
  const deck=page.getByTestId('ground-colony-roof-deck-5,7-to-6,7');
  await expect(deck).toHaveCount(1);
  const dimensions=await deck.evaluate(node=>{
    const bounds=(node as SVGGraphicsElement).getBBox();
    return {width:bounds.width,height:bounds.height};
  });
  expect(dimensions.width).toBeGreaterThan(35);
  expect(dimensions.height).toBeGreaterThan(20);
  // The only eastern entry (8,4) stays physically open. No visual canopy
  // may bridge an open tile or reveal an unobserved pair of blocked tiles.
  await expect(page.getByTestId('ground-colony-roof-8,3-to-8,4')).toHaveCount(0);
  // Never glaze a physical door or bridge a gap between blocked structures.
  await expect(page.getByTestId('ground-colony-facade-8,3-to-8,4')).toHaveCount(0);
  await expect(page.getByTestId('ground-colony-facade-8,2-to-8,3')).toHaveCount(0);
  await expect(page.getByTestId('ground-colony-roof-deck-8,1-to-8,2')).toHaveCount(0);
  await expect(page.getByTestId('ground-outpost-landmarks')).toHaveCount(1);
  await expect(page.getByTestId('ground-architecture-wall-3,2')).toHaveCount(1);
  await expect(page.getByTestId('ground-architecture-wall-8,3')).toHaveCount(0);
  // Unknown ground is genuinely opaque: no misleading checkerboard contours
  // or hints of unrevealed obstacles remain in the dark part of the scene.
  const unseen=board.locator('[data-fog-cell="11,7"]');
  await expect(unseen).toHaveAttribute('data-fog-state','unknown');
  await expect(unseen).toHaveAttribute('fill-opacity','1');
  await expect(unseen).toHaveAttribute('stroke-opacity','0');
  for(const id of ['probe','sensor-vault','relief-point','perimeter-uplink','beam-out'])
   await expect(page.getByTestId('ground-landmark-'+id)).toHaveCount(1);
  await board.screenshot({path:'test-results/away-architecture-initial-'+width+'.png'});
  // The east building doesn't leak through fog; only an accepted real path
  // reveals it. Rendering must never intercept the right-click ground command.
  await orderCell(page,9,4);
  const venn=page.getByTestId('ground-unit-venn');
  await expect(venn).toHaveAttribute('data-grid-x','9');
  await expect(venn).toHaveAttribute('data-walk-phase','idle',{timeout:18_000});
  await expect(page.getByTestId('ground-architecture-wall-8,3')).toHaveAttribute('data-fog','visible');
  const gateway=page.getByTestId('ground-gateway-8,4');
  await expect(gateway).toHaveAttribute('data-fog','visible');
  await expect(gateway).toHaveAttribute('data-gateway-kind','entry');
  await expect(board.locator('[data-cell-id="8,4"]')).toHaveCount(1);
  const portal=await gateway.evaluate(node=>{
    const rect=(node as SVGGraphicsElement).getBBox();
    return {width:rect.width,height:rect.height,
      pointerEvents:getComputedStyle(node).pointerEvents};
  });
  expect(portal.width).toBeGreaterThan(35);
  expect(portal.height).toBeGreaterThan(35);
  expect(portal.pointerEvents).toBe('none');
  await expect(page.getByTestId('ground-architecture-wall-10,2')).toHaveCount(0);
  await expect(page.getByTestId('ground-cargo-10,2')).toHaveCount(1);
  await expect(page.getByTestId('ground-cargo-3,2')).toHaveCount(0);
  await board.screenshot({path:'test-results/away-architecture-revealed-'+width+'.png'});
  await orderCell(page,4,5);
  await expect(venn).toHaveAttribute('data-grid-x','4');
  await expect(venn).toHaveAttribute('data-walk-phase','idle',{timeout:18_000});
  await expect(page.getByTestId('ground-architecture-wall-8,3')).toHaveAttribute('data-fog','remembered');
  await expect(gateway).toHaveAttribute('data-fog','remembered');
  await page.reload();
  await expect(page.getByTestId('ground-architecture-wall-8,3')).toHaveAttribute('data-fog','remembered');
  await expect(page.getByTestId('ground-gateway-8,4')).toHaveAttribute('data-fog','remembered');
  await expect(page.getByTestId('ground-colony-facade-5,7-to-6,7')).toHaveCount(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}
