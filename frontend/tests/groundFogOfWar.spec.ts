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
