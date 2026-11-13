import {expect,test,type Page} from '@playwright/test';

test.use({storageState:{cookies:[],origins:[]}});

async function land(page:Page){
 await page.goto('/');
 await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:25000});
 await page.getByTestId('captain-transport').click({timeout:25000});
 await page.getByTestId('transport-confirm').click();
 const board=page.getByTestId('ground-squad-board');
 await expect(board).toBeVisible();
 const court=page.getByTestId('ground-landing-court-3d');
 await expect(court).toHaveAttribute('data-renderer-state','ready',{timeout:25000});
 return {board,court};
}

async function approachHangar(page:Page){
 const board=page.getByTestId('ground-squad-board');
 // Accepted real squad move; no test-only fog injection or teleport.
 await board.locator('[data-cell-id="5,6"]').click({button:'right'});
 const venn=page.getByTestId('ground-unit-venn');
 await expect(venn).toHaveAttribute('data-grid-x','5');
 await expect(venn).toHaveAttribute('data-grid-y','6');
 await expect(venn).toHaveAttribute('data-walk-phase','idle',{timeout:30000});
 const court=page.getByTestId('ground-landing-court-3d');
 await expect(court).toHaveAttribute('data-hangar-ready','true',{timeout:25000});
 expect(Number(await court.getAttribute('data-hangar-count'))).toBeGreaterThan(0);
 return board;
}

for(const width of [390,1280]){
 test('authored tiered industrial hall is visible in actual follow camera '+width,
 async({page,browser})=>{
  test.setTimeout(170000);
  await page.setViewportSize({width,height:850});
  const original=await browser.newContext({
   viewport:{width,height:850},storageState:{cookies:[],origins:[]},
  });
  try{
   const before=await original.newPage();
   await before.addInitScript(()=>{
    (window as typeof window&{__k47LegacyIndustrialHangar?:boolean})
      .__k47LegacyIndustrialHangar=true;
   });
   const old=await land(before);
   await expect(old.court).toHaveAttribute('data-industrial-art-style','single-storey-legacy');
   await old.board.screenshot({
    path:'test-results/k47-hangar-before-landing-'+width+'.png',
   });
   const now=await land(page);
   await expect(now.court).toHaveAttribute('data-industrial-art-style',
    'tiered-glazed-engineering-hall');
   await now.board.screenshot({
    path:'test-results/k47-hangar-after-landing-'+width+'.png',
   });
   await approachHangar(before);
   await old.board.screenshot({
    path:'test-results/k47-hangar-before-follow-'+width+'.png',
   });
   const board=await approachHangar(page);
   // The same real blocked-cell hangar is rendered by WebGL; SVG is hidden
   // only after a genuine canvas first frame, not by a fake artwork flag.
   const eligible=board.locator(
    '[data-testid^="ground-south-industrial-hangar-"][data-hangar-3d-eligible="true"]');
   expect(await eligible.count()).toBeGreaterThan(0);
   await expect(eligible.first()).toHaveCSS('visibility','hidden');
   await board.screenshot({
    path:'test-results/k47-hangar-after-follow-'+width+'.png',
   });
   const counts=await board.evaluate(node=>({
    canonicalCells:node.querySelectorAll('polygon[data-cell-id]').length,
    inputSurfaces:node.querySelectorAll(
      '[data-testid="ground-landing-court-3d"] [data-cell-id],[data-testid="ground-landing-court-3d"] [data-officer-id]').length,
    officers:node.querySelectorAll('[data-officer-id]').length,
   }));
   expect(counts.canonicalCells).toBe(216);
   expect(counts.inputSurfaces).toBe(0);
   expect(counts.officers).toBeGreaterThanOrEqual(3);
   await page.reload();
   await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-y','6');
   await expect(page.getByTestId('ground-landing-court-3d'))
    .toHaveAttribute('data-hangar-ready','true',{timeout:25000});
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }finally{await original.close();}
 });
}
