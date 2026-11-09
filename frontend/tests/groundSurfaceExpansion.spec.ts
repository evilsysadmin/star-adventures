import {expect,test} from '@playwright/test';

test.use({storageState:{cookies:[],origins:[]}});

async function clickCell(page:import('@playwright/test').Page,x:number,y:number){
  const board=page.getByTestId('ground-squad-board');
  const local=await board.evaluate((node,{x,y})=>{
    const svg=node as SVGSVGElement;
    const point=svg.createSVGPoint();
    point.x=440+(x-y)*40;point.y=52+(x+y)*20;
    const matrix=svg.getScreenCTM();
    if(!matrix)throw new Error('Camera transform unavailable');
    const screen=point.matrixTransform(matrix),rect=svg.getBoundingClientRect();
    return {x:screen.x-rect.left,y:screen.y-rect.top};
  },{x,y});
  await board.click({button:'right',position:local});
}

for(const width of [390,1280]){
 test('real 18x12 east sector, follow/full-map camera and F5 '+width+'px',async({page})=>{
  test.setTimeout(105_000);
  page.setDefaultTimeout(15_000);
  await page.setViewportSize({width,height:850});
  await page.goto('/');
  await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:20_000});
  await page.getByTestId('captain-transport').click({timeout:25_000});
  await page.getByTestId('transport-confirm').click();
  const board=page.getByTestId('ground-squad-board');
  await expect(board).toBeVisible();
  for(const key of ['9,4','10,4','11,4','11,7']){
    await expect(board.locator('[data-cell-id="'+key+'"]')).toHaveCount(1);
  }
  await expect(page.getByTestId('ground-wild-sector-scenery')).toBeVisible();
  await expect(page.getByTestId('ground-camera-toggle')).toHaveAttribute('aria-pressed','true');
  await page.getByTestId('ground-camera-toggle').click();
  await expect(board).toHaveAttribute('viewBox','-72 0 1280 640');
  await board.screenshot({path:'test-results/ground-expanded-all-'+width+'.png'});
  await clickCell(page,9,4);
  const venn=page.getByTestId('ground-unit-venn');
  await expect(venn).toHaveAttribute('data-grid-x','9');
  await expect(venn).toHaveAttribute('data-grid-y','4');
  await expect(page.getByTestId('ground-unit-dorn')).toHaveAttribute('data-grid-x','4');
  await expect(page.getByTestId('ground-move-status')).toContainText('9:4');
  await page.getByTestId('ground-camera-toggle').click();
  await expect(page.getByTestId('ground-camera-toggle')).toHaveAttribute('aria-pressed','true');
  await expect(board).not.toHaveAttribute('viewBox','-72 0 1280 640');
  await expect(venn).toHaveAttribute('data-walk-phase','idle',{timeout:12_000});
  await board.screenshot({path:'test-results/ground-expanded-follow-'+width+'.png'});
  await page.reload();
  await expect(page.getByTestId('ground-squad-board')).toBeVisible();
  await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-x','9');
  await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-y','4');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}
