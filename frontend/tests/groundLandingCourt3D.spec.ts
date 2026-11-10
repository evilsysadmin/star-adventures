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
  await expect(court).toHaveAttribute('data-terrace-kit','k47-industrial-terrace-v1');
  await expect(court).toHaveAttribute('data-canyon-kit','k47-ambient-canyon-v2');
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
  // The new rocky retaining wall may replace only real, already discovered
  // blocked cells. Their SVG artwork remains a WebGL-failure fallback.
  for(const column of wallReveal.columns){
    const oldWall=board.locator('[data-testid="ground-architecture-wall-'+column+',7"]');
    await expect(oldWall).toHaveCount(1);
    await expect(oldWall).toHaveCSS('opacity','0');
  }
  expect(structure.cells).toBe(216);
  expect(structure.courtCells).toBeGreaterThan(14);
  expect(structure.canvasSize).toEqual(['1120','550']);
  expect(structure.passive&&structure.hiddenFromAssistive&&structure.noInputTargets).toBe(true);
  expect(structure.onTopOfRealTiles&&structure.belowGroundFog&&structure.belowDecorations).toBe(true);
  await expect(board.locator('[data-fog-cell="10,4"]'))
    .toHaveAttribute('data-fog-state','unknown');
  await board.screenshot({path:'test-results/away-industrial-pbr-court-'+width+'.png'});
  await page.screenshot({path:'test-results/away-k47-terrace-full-'+width+'.png'});

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
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}

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
 await expect(court).toHaveAttribute('data-terrace-kit','k47-industrial-terrace-v1');
  await expect(court).toHaveAttribute('data-canyon-kit','k47-ambient-canyon-v2');
 for(const column of [3,4,5,6,7]){
   const wall=board.locator('[data-testid="ground-architecture-wall-'+column+',7"]');
   if(await wall.count())await expect(wall).not.toHaveCSS('opacity','0');
 }
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
