import {expect,test} from '@playwright/test';

test.use({storageState:{cookies:[],origins:[]}});

for(const width of [390,1280]){
 test('one science wing joins real Archive and Sonda without changing their actions '+width,async({page})=>{
  test.setTimeout(100_000);
  await page.setViewportSize({width,height:850});
  await page.goto('/');
  await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:25_000});
  await page.getByTestId('captain-transport').click({timeout:25_000});
  await page.getByTestId('transport-confirm').click();
  const board=page.getByTestId('ground-squad-board');
  const wing=page.getByTestId('ground-science-campus');
  await expect(board).toBeVisible();
  // Canonical initial squad sight may already include this nearby wing.
  // Do not invent a fog state: if present, it requires all three tiles
  // to have been legitimately discovered by the deployed officers.
  if(await wing.count()){
    for(const id of ['2,2','3,2','4,2']){
      await expect(board.locator('[data-fog-cell="'+id+'"][data-fog-state="unknown"]')).toHaveCount(0);
    }
  }
  await page.getByTestId('ground-camera-toggle').click();
  await board.screenshot({path:'test-results/away-science-campus-before-'+width+'.png'});

  // Move the REAL selected officer. No test-only sensor reveal or teleport.
  // 3,3 is visually overlapped by another officer in this isometric view;
  // 2,4 has a genuine unobstructed hit point and sight to all three cells.
  await board.locator('[data-cell-id="2,4"]').click({button:'right'});
  await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-x','2');
  await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-y','4');
  await expect(page.getByTestId('ground-unit-venn'))
    .toHaveAttribute('data-walk-phase','idle',{timeout:25_000});

  await expect(wing).toHaveAttribute('data-footprint','2,2 3,2 4,2');
  await expect(wing).toHaveAttribute('data-fog','visible');

  await expect(wing).toHaveAttribute('data-render-class','k47-research-superstructure');
  await expect(wing.getByTestId('ground-science-upper-atrium')).toHaveCount(1);
  await expect(wing.getByTestId('ground-science-roof-plant')).toHaveCount(1);
  await expect(wing.getByTestId('ground-science-glazed-bay')).toHaveCount(5);
  // Test actual painted scale, not just the existence of a new decorative node.
  const volume=await wing.evaluate(node=>{
    const root=node as SVGGraphicsElement;
    const outer=root.getBBox();
    const upper=root.querySelector('[data-testid="ground-science-upper-atrium"]') as SVGGraphicsElement;
    const roof=upper.getBBox();
    return {
      wide:outer.width>=155,
      tall:outer.height>=135,
      atriumWide:roof.width>=65,
      atriumTall:roof.height>=50,
      passive:getComputedStyle(root).pointerEvents==='none',
      noPhantomCells:root.querySelectorAll('[data-cell-id],[data-officer-id]').length===0,
    };
  });
  expect(volume).toEqual({
    wide:true,tall:true,atriumWide:true,atriumTall:true,
    passive:true,noPhantomCells:true,
  });
  // Screenshot the actual mission with a true, discovered science sector.
  // This is not a separately invented image or a new fake game board.
  await board.screenshot({path:'test-results/k47-science-superstructure-'+width+'.png'});

  await expect(wing).toHaveAttribute('pointer-events','none');
  await expect(page.getByTestId('ground-architecture-wall-3,2')).toHaveCount(0);
  for(const id of ['2,2','3,2','4,2']){
    await expect(board.locator('[data-cell-id="'+id+'"]')).toHaveCount(1);
  }
  await expect(page.getByTestId('ground-landmark-sensor-vault')).toHaveCount(1);
  await expect(page.getByTestId('ground-landmark-probe')).toHaveCount(1);
  await board.screenshot({path:'test-results/away-science-campus-revealed-'+width+'.png'});
  await page.reload();
  await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-x','2');
  await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-y','4');
  await expect(page.getByTestId('ground-science-campus')).toHaveCount(1);
  await expect(page.getByTestId('ground-landmark-sensor-vault')).toHaveCount(1);
  await expect(page.getByTestId('ground-landmark-probe')).toHaveCount(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}
