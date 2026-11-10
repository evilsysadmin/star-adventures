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
  // A single manufacturing wing replaces *both* the isolated 2-cell roof
  // and tiny per-wall modules. Its footprint must be the real discovered
  // south walls (including the originally visible contiguous 5,7/6,7 pair).
  const south=page.getByTestId('ground-south-industrial-wing');
  const hangar=south.locator('[data-render-class="single-continuous-industrial-hangar"]'+
    '[data-footprint~="5,7"][data-footprint~="6,7"]');
  await expect(hangar).toHaveCount(1);
  const footprint=await hangar.getAttribute('data-footprint');
  expect(footprint!.split(' ').length).toBeGreaterThanOrEqual(2);
  for(const tile of footprint!.split(' ')){
    expect(['2,7','3,7','4,7','5,7','6,7','7,7']).toContain(tile);
    await expect(board.locator('[data-cell-id="'+tile+'"]')).toHaveCount(1);
    await expect(board.locator('[data-fog-cell="'+tile+'"][data-fog-state="unknown"]')).toHaveCount(0);
  }
  const silhouette=await hangar.evaluate(element=>{
    const bounds=(element as SVGGraphicsElement).getBBox();
    return {width:bounds.width,height:bounds.height,
      passive:getComputedStyle(element).pointerEvents==='none'};
  });
  expect(silhouette.width).toBeGreaterThan(90);
  expect(silhouette.height).toBeGreaterThan(70);
  expect(silhouette.passive).toBe(true);
  for(const x of [5,6]){
    await expect(page.getByTestId('ground-architecture-wall-'+x+',7')).toHaveCount(0);
  }
  await expect(page.getByTestId('ground-colony-roof-5,7-to-6,7')).toHaveCount(0);
  // The old WebGL court must not place yet another brick under this wing.
  const remaining=(await page.getByTestId('ground-landing-court-3d')
    .getAttribute('data-pbr-wall-fallback-columns'))?.split(',')??[];
  expect(remaining).not.toContain('5');
  expect(remaining).not.toContain('6');
  // The only eastern entry (8,4) stays physically open. No visual canopy
  // may bridge an open tile or reveal an unobserved pair of blocked tiles.
  await expect(page.getByTestId('ground-colony-roof-8,3-to-8,4')).toHaveCount(0);
  // Never glaze a physical door or bridge a gap between blocked structures.
  await expect(page.getByTestId('ground-colony-facade-8,3-to-8,4')).toHaveCount(0);
  await expect(page.getByTestId('ground-colony-facade-8,2-to-8,3')).toHaveCount(0);
  await expect(page.getByTestId('ground-colony-roof-deck-8,1-to-8,2')).toHaveCount(0);
  await expect(page.getByTestId('ground-outpost-landmarks')).toHaveCount(1);
  // The same physically blocked middle wall is now part of a single
  // Archive–Sonda wing. Verify both the shared real footprint and the
  // absence of a duplicate little building on that wall tile.
  const scienceWing=page.getByTestId('ground-science-campus');
  await expect(scienceWing).toHaveAttribute('data-footprint','2,2 3,2 4,2');
  await expect(scienceWing).toHaveAttribute('pointer-events','none');
  await expect(page.getByTestId('ground-architecture-wall-3,2')).toHaveCount(0);
  for(const id of ['2,2','3,2','4,2']){
    await expect(board.locator('[data-cell-id="'+id+'"]')).toHaveCount(1);
    await expect(board.locator('[data-fog-cell="'+id+'"][data-fog-state="unknown"]')).toHaveCount(0);
  }
  await expect(page.getByTestId('ground-architecture-wall-8,3')).toHaveCount(0);
  // Unknown ground is genuinely opaque: no misleading checkerboard contours
  // or hints of unrevealed obstacles remain in the dark part of the scene.
  const unseen=board.locator('[data-fog-cell="11,7"]');
  await expect(unseen).toHaveAttribute('data-fog-state','unknown');
  await expect(unseen).toHaveAttribute('fill-opacity','1');
  await expect(unseen).toHaveAttribute('stroke-opacity','0');
  for(const id of ['probe','sensor-vault','relief-point','perimeter-uplink','beam-out'])
   await expect(page.getByTestId('ground-landmark-'+id)).toHaveCount(1);
  // The authored science objective is now an actual volumetric receiver,
  // not a generic icon. Its position, fog ownership and picking are unchanged.
  const station=page.getByTestId('ground-landmark-probe');
  const dish=station.getByTestId('ground-probe-array');
  await expect(dish).toHaveCount(1);
  await expect(station).toHaveAttribute('data-fog','visible');
  const probeBounds=await dish.evaluate(node=>{
    const rect=(node as SVGGraphicsElement).getBBox();
    return {width:rect.width,height:rect.height,
      passive:getComputedStyle(node).pointerEvents==='none',
      ariaHidden:node.getAttribute('aria-hidden')==='true'};
  });
  expect(probeBounds.width).toBeGreaterThan(85);
  expect(probeBounds.height).toBeGreaterThan(130);
  expect(probeBounds.passive&&probeBounds.ariaHidden).toBe(true);
  await expect(page.getByTestId('ground-waypoint-label-probe'))
    .toHaveAttribute('transform','translate(76 -45) scale(.78)');
  // Real browser paint order: ground fog must NOT amputate a discovered
  // tall mast into a free-floating dish. Officers still render last.
  const stationLayer=await board.evaluate(root=>{
    const fog=root.querySelector('[data-testid="ground-fog-layer"]');
    const stations=root.querySelector('[data-testid="ground-outpost-landmarks"]');
    const unit=root.querySelector('[data-testid="ground-unit-venn"]');
    return {
      stationsAfterFog:!!fog&&!!stations&&
        Boolean(fog.compareDocumentPosition(stations)&Node.DOCUMENT_POSITION_FOLLOWING),
      unitsAfterStations:!!stations&&!!unit&&
        Boolean(stations.compareDocumentPosition(unit)&Node.DOCUMENT_POSITION_FOLLOWING),
      noExtraPickTargets:stations?.querySelectorAll('[data-cell-id],[data-officer-id]').length===0,
      fogStillPresent:!!fog,
    };
  });
  expect(stationLayer).toEqual({
    stationsAfterFog:true,unitsAfterStations:true,
    noExtraPickTargets:true,fogStillPresent:true,
  });
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
  await expect(page.getByTestId('ground-south-industrial-wing')
    .locator('[data-render-class="single-continuous-industrial-hangar"]'+
      '[data-footprint~="5,7"][data-footprint~="6,7"]')).toHaveCount(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}
