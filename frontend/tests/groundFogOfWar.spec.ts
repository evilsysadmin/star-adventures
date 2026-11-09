import {expect,test,type Page} from '@playwright/test';

// This is the real immersive bridge -> surface UI. No diagnostic journal mode.
test.use({storageState:{cookies:[],origins:[]}});

async function orderCell(page:Page,x:number,y:number){
 const board=page.getByTestId('ground-squad-board');
 const coords=await board.evaluate((node,{x,y})=>{
  const svg=node as SVGSVGElement,point=svg.createSVGPoint();
  point.x=440+(x-y)*40;point.y=52+(x+y)*20;
  const transform=svg.getScreenCTM();
  if(!transform)throw new Error('No camera transform');
  const result=point.matrixTransform(transform),bounds=svg.getBoundingClientRect();
  return {x:result.x-bounds.left,y:result.y-bounds.top};
 },{x,y});
 await board.click({button:'right',position:coords});
}

for(const width of [390,1280]){
 test('fog blocks unseen intel, walking reveals valley, F5 remembers only what was seen '+width,async({page})=>{
  test.setTimeout(115_000);
  page.setDefaultTimeout(18_000);
  await page.setViewportSize({width,height:850});
  await page.goto('/');
  await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:25_000});
  await page.getByTestId('captain-transport').click({timeout:25_000});
  await page.getByTestId('transport-confirm').click();
  const board=page.getByTestId('ground-squad-board');
  await expect(board).toBeVisible();
  await page.getByTestId('ground-camera-toggle').click();
  await expect(board).toHaveAttribute('viewBox','-72 0 1280 640');
  await expect(page.getByTestId('ground-fog-layer')).toHaveCount(1);
  await expect(board.locator('[data-fog-cell="10,4"]')).toHaveAttribute('data-fog-state','unknown');
  // The never-explored sector is one continuous, opaque world-space
  // atmosphere: no per-cell palette revealing an obvious checkerboard.
  const continuous=page.getByTestId('ground-undiscovered-continuous-field');
  await expect(continuous).toHaveAttribute('fill','url(#ground-undiscovered-gradient)');
  await expect(continuous).toHaveAttribute('pointer-events','none');
  const fogMaterial=await board.evaluate(root=>{
    const cells=[...root.querySelectorAll('[data-fog-state="unknown"]')];
    const gradient=root.querySelector('#ground-undiscovered-gradient');
    const field=root.querySelector('[data-testid="ground-undiscovered-continuous-field"]');
    return {
      count:cells.length,
      fills:[...new Set(cells.map(cell=>cell.getAttribute('fill')))],
      opaque:cells.every(cell=>cell.getAttribute('fill-opacity')==='1'&&
        cell.getAttribute('stroke-opacity')==='0'),
      worldSpace:gradient?.getAttribute('gradientUnits'),
      unionPathLength:field?.getAttribute('d')?.length??0,
    };
  });
  expect(fogMaterial.count).toBeGreaterThan(40);
  expect(fogMaterial.fills).toEqual(['url(#ground-undiscovered-gradient)']);
  expect(fogMaterial.opaque).toBe(true);
  expect(fogMaterial.worldSpace).toBe('userSpaceOnUse');
  expect(fogMaterial.unionPathLength).toBeGreaterThan(300);

  await expect(page.getByTestId('ground-scenery-crystal-5')).toHaveAttribute('visibility','hidden');
  await board.screenshot({path:'test-results/away-fog-unknown-'+width+'.png'});

  // A long move is an exploration order: the new area is learned from the
  // real route, not from a map legend or pre-revealed mission marker.
  await orderCell(page,9,4);
  const venn=page.getByTestId('ground-unit-venn');
  await expect(venn).toHaveAttribute('data-grid-x','9');
  await expect(venn).toHaveAttribute('data-grid-y','4');
  await expect(venn).toHaveAttribute('data-walk-phase','idle',{timeout:18_000});
  await expect(board.locator('[data-fog-cell="10,4"]')).toHaveCount(0);
  await board.screenshot({path:'test-results/away-fog-visible-'+width+'.png'});
  await orderCell(page,4,5);
  await expect(venn).toHaveAttribute('data-grid-x','4');
  await expect(venn).toHaveAttribute('data-walk-phase','idle',{timeout:18_000});
  await expect(board.locator('[data-fog-cell="10,4"]')).toHaveAttribute('data-fog-state','remembered');
  await expect(board.locator('[data-fog-cell="10,4"]'))
    .toHaveAttribute('fill-opacity','0.6');
  // The expanded east edge is still wholly unknown at this point.
  await expect(board.locator('[data-fog-cell="16,10"]'))
    .toHaveAttribute('data-fog-state','unknown');
  await board.screenshot({path:'test-results/away-fog-memory-'+width+'.png'});

  await page.reload();
  await expect(page.getByTestId('ground-squad-board')).toBeVisible();
  await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-x','4');
  await expect(page.getByTestId('ground-squad-board').locator('[data-fog-cell="10,4"]'))
   .toHaveAttribute('data-fog-state','remembered');
  const hasDuplicateFogSave=await page.evaluate(()=>Object.keys(localStorage).some(key=>key.includes('ground-fog')));
  expect(hasDuplicateFogSave).toBe(false);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}
