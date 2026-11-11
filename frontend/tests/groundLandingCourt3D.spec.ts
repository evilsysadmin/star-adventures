import {expect,test,type Page} from '@playwright/test';

test.use({storageState:{cookies:[],origins:[]}});

async function land(page:Page){
 await page.goto('/');
 await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:25000});
 await page.getByTestId('captain-transport').click({timeout:25000});
 await page.getByTestId('transport-confirm').click();
 await expect(page.getByTestId('ground-squad-board')).toBeVisible();
}

for(const width of [390,1280]){
 test('original textured 3D arrival court respects the real iso grid and fog '+width,async({page})=>{
  test.setTimeout(125_000);
  page.setDefaultTimeout(18_000);
  await page.setViewportSize({width,height:850});
  await land(page);
  const board=page.getByTestId('ground-squad-board');
  const court=page.getByTestId('ground-landing-court-3d');
  await expect(court).toHaveAttribute('data-topology-valid','true');
  await expect(court).toHaveAttribute('visibility','visible');
  await expect(court).toHaveAttribute('data-renderer-state','ready',{timeout:20000});
  await expect(court).toHaveAttribute('data-modular-region','3,4:4x3');
  const modular=await board.evaluate(root=>{
    const court=root.querySelector('[data-testid="ground-landing-court-3d"]');
    const cells=(court?.getAttribute('data-modular-cell-ids')||'')
      .split(' ').filter(Boolean);
    return {
      tiles:Number(court?.getAttribute('data-modular-tiles')),
      edges:Number(court?.getAttribute('data-modular-edges')),
      prefabs:Number(court?.getAttribute('data-modular-prefabs')),
      realCells:cells.every(cell=>!!root.querySelector('[data-cell-id="'+cell+'"]')),
      noUnknown:cells.every(cell=>!root.querySelector(
       '[data-fog-cell="'+cell+'"][data-fog-state="unknown"]')),
      unique:new Set(cells).size===cells.length,
    };
  });
  expect(modular.tiles).toBeGreaterThanOrEqual(4);
  expect(modular.tiles).toBeLessThanOrEqual(10);
  expect(modular.prefabs).toBeLessThanOrEqual(1);
  expect(modular.realCells&&modular.noUnknown&&modular.unique).toBe(true);
  // The existing solid SVG floor must actually uncover the 3D art, while
  // keeping the separately rendered mission/hatch decorations above it.
  await expect(board.locator('[data-testid^="ground-bay-floor-"]').first())
    .toHaveCSS('opacity','0.08');
  const structure=await board.evaluate(root=>{
    const court=root.querySelector('[data-testid="ground-landing-court-3d"]');
    const canvas=court?.querySelector('canvas');
    const tile=root.querySelector('polygon[data-cell-id]');
    const fog=root.querySelector('[data-testid="ground-fog-layer"]');
    const decorations=root.querySelector('[data-testid="ground-colony-floor"]');
    return {
      cells:root.querySelectorAll('polygon[data-cell-id]').length,
      courtCells:Number(court?.getAttribute('data-painted-cells')),
      canvasSize:[canvas?.getAttribute('width'),canvas?.getAttribute('height')],
      passive:!!court&&getComputedStyle(court).pointerEvents==='none'&&
        !!canvas&&getComputedStyle(canvas).pointerEvents==='none',
      hiddenFromAssistive:court?.getAttribute('aria-hidden')==='true',
      noInputTargets:court?.querySelectorAll(
        '[data-cell-id],[data-officer-id],[data-fog-cell],button,a').length===0,
      onTopOfRealTiles:!!court&&!!tile&&
        Boolean(tile.compareDocumentPosition(court)&Node.DOCUMENT_POSITION_FOLLOWING),
      belowGroundFog:!!court&&!!fog&&
        Boolean(court.compareDocumentPosition(fog)&Node.DOCUMENT_POSITION_FOLLOWING),
      belowDecorations:!!court&&!!decorations&&
        Boolean(court.compareDocumentPosition(decorations)&Node.DOCUMENT_POSITION_FOLLOWING),
    };
  });
  const wallReveal=await board.evaluate(root=>{
    const columns=(root.querySelector('[data-testid="ground-landing-court-3d"]')
      ?.getAttribute('data-discovered-wall-columns')??'')
      .split(',').filter(Boolean).map(Number);
    const leaking=columns.filter(x=>
      root.querySelector('[data-fog-cell="'+x+',7"]')
        ?.getAttribute('data-fog-state')==='unknown');
    return {columns,leaking};
  });
  expect(wallReveal.columns.every(x=>[3,4,5,6,7].includes(x))).toBe(true);
  expect(wallReveal.leaking).toEqual([]);
  expect(structure.cells).toBe(216);
  expect(structure.courtCells).toBeGreaterThan(14);
  expect(structure.canvasSize).toEqual(['1120','550']);
  expect(structure.passive&&structure.hiddenFromAssistive&&structure.noInputTargets).toBe(true);
  expect(structure.onTopOfRealTiles&&structure.belowGroundFog&&structure.belowDecorations).toBe(true);
  await expect(board.locator('[data-fog-cell="10,4"]'))
    .toHaveAttribute('data-fog-state','unknown');
  await board.screenshot({path:'test-results/away-industrial-pbr-court-'+width+'.png'});
  await board.screenshot({path:'test-results/away-modular-terrain-pilot-'+width+'.png'});

  // A live move command still resolves against the exact canonical cell.
  await board.locator('[data-cell-id="5,4"]').click({button:'right'});
  const unit=page.getByTestId('ground-unit-venn');
  await expect(unit).toHaveAttribute('data-grid-x','5');
  await expect(unit).toHaveAttribute('data-grid-y','4');
  await expect(unit).toHaveAttribute('data-walk-phase','idle',{timeout:26000});
  await page.reload();
  await expect(unit).toHaveAttribute('data-grid-x','5');
  await expect(unit).toHaveAttribute('data-grid-y','4');
  await expect(page.getByTestId('ground-landing-court-3d'))
    .toHaveAttribute('data-renderer-state','ready',{timeout:20000});
  expect(Number(await page.getByTestId('ground-landing-court-3d')
    .getAttribute('data-modular-tiles'))).toBeGreaterThanOrEqual(modular.tiles);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}

for(const width of [390,1280]){
 test('connected industrial 3D span does not duplicate SVG and survives F5 '+width,async({page})=>{
  test.setTimeout(125_000);
  await page.setViewportSize({width,height:850});
  await land(page);
  const board=page.getByTestId('ground-squad-board');
  const court=page.getByTestId('ground-landing-court-3d');
  await expect(court).toHaveAttribute('data-renderer-state','ready',{timeout:20000});
  await board.locator('[data-cell-id="5,6"]').click({button:'right'});
  await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-y','6');
  await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-walk-phase','idle',{timeout:26000});
  await expect(court).toHaveAttribute('data-hangar-ready','true',{timeout:20000});
  const eligible=board.locator('[data-testid^="ground-south-industrial-hangar-"][data-hangar-3d-eligible="true"]');
  expect(await eligible.count()).toBeGreaterThan(0);
  expect(Number(await court.getAttribute('data-hangar-count'))).toBe(await eligible.count());
  await expect(eligible.first()).toHaveCSS('visibility','hidden');
  // Visited-but-out-of-sight architecture must be a quiet memory, not
  // a bright translucent duplicate floating over the active colony.
  const rememberedArchitecture=board.locator(
    '[data-testid="ground-colony-walls"] [data-fog="remembered"]');
  expect(await rememberedArchitecture.count()).toBeGreaterThan(0);
  await expect(rememberedArchitecture.first()).toHaveCSS('opacity','0.28');
  await expect(board.locator('polygon[data-cell-id]')).toHaveCount(216);
  await board.screenshot({path:'test-results/away-3d-connected-hangar-'+width+'.png'});
  await page.reload();
  await expect(court).toHaveAttribute('data-hangar-ready','true',{timeout:20000});
  await expect(eligible.first()).toHaveCSS('visibility','hidden');
 });
}

test('WebGL-denied industrial hangar keeps canonical SVG frontage',async({page})=>{
 test.setTimeout(100_000);
 await page.setViewportSize({width:390,height:850});
 await page.addInitScript(()=>{
  const original=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(id,...args){
   if(String(id).startsWith('webgl'))return null;
   return (original as (...values:unknown[])=>unknown).call(this,id,...args);
  } as typeof original;
 });
 await land(page);
 const board=page.getByTestId('ground-squad-board');
 const court=page.getByTestId('ground-landing-court-3d');
 await board.locator('[data-cell-id="5,6"]').click({button:'right'});
 await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-y','6');
 await expect(court).toHaveAttribute('data-renderer-state','fallback');
 await expect(court).toHaveAttribute('data-hangar-ready','false');
 const eligible=board.locator('[data-testid^="ground-south-industrial-hangar-"][data-hangar-3d-eligible="true"]');
 expect(await eligible.count()).toBeGreaterThan(0);
 await expect(eligible.first()).toHaveCSS('visibility','visible');
 await expect(board.locator('polygon[data-cell-id]')).toHaveCount(216);
});

test('WebGL failure leaves the original entire SVG landing fully playable',async({page})=>{
 test.setTimeout(100_000);
 await page.setViewportSize({width:390,height:850});
 // Prevent ONLY WebGL contexts; 2D canvas, game logic and the SVG still work.
 await page.addInitScript(()=>{
   const original=HTMLCanvasElement.prototype.getContext;
   HTMLCanvasElement.prototype.getContext=function(id,...args){
     if(String(id).startsWith('webgl'))return null;
     return (original as (...values:unknown[])=>unknown).call(this,id,...args);
   } as typeof original;
 });
 await land(page);
 const board=page.getByTestId('ground-squad-board');
 const court=page.getByTestId('ground-landing-court-3d');
 await expect(court).toHaveAttribute('data-renderer-state','fallback');
 // No WebGL means no new canvas layer, new picking target or blank terrain.
 await expect(court).toHaveAttribute('data-modular-region','3,4:4x3');
 // The original SVG floor must remain fully legible if there is no WebGL.
 await expect(board.locator('[data-testid^="ground-bay-floor-"]').first())
   .not.toHaveCSS('opacity','0.08');
 await expect(board.locator('polygon[data-cell-id]')).toHaveCount(216);
 await board.locator('[data-cell-id="5,4"]').click({button:'right'});
 await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-x','5');
 await page.reload();
 await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-x','5');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
