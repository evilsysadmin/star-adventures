import {expect,test,type Page} from '@playwright/test';
test.use({storageState:{cookies:[],origins:[]}});

async function orderCell(page:Page,x:number,y:number){
 const board=page.getByTestId('ground-squad-board');
 const local=await board.evaluate((node,{x,y})=>{
  const svg=node as SVGSVGElement,p=svg.createSVGPoint();
  p.x=440+(x-y)*40;p.y=52+(x+y)*20;
  const matrix=svg.getScreenCTM();
  if(!matrix)throw new Error('No world-to-screen matrix');
  const q=p.matrixTransform(matrix),bounds=svg.getBoundingClientRect();
  return {x:q.x-bounds.left,y:q.y-bounds.top};
 },{x,y});
 await board.click({button:'right',position:local});
 await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-x',String(x));
 await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-y',String(y));
 await expect(page.getByTestId('ground-unit-venn'))
  .toHaveAttribute('data-walk-phase','idle',{timeout:25000});
}

for(const width of [390,1280]){
 test('wider east plaza can be explored, selected and restored at '+width,async({page})=>{
  test.setTimeout(150_000);
  page.setDefaultTimeout(15_000);
  await page.setViewportSize({width,height:850});
  await page.goto('/');
  await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:25000});
  await page.getByTestId('captain-transport').click({timeout:25000});
  await page.getByTestId('transport-confirm').click();
  const board=page.getByTestId('ground-squad-board');
  await expect(board).toBeVisible();
  await expect(page.getByTestId('ground-plaza-floor-15,5')).toHaveCount(0);
  for(const id of ['12,4','12,6','15,5','16,8']){
   await expect(board.locator('[data-cell-id="'+id+'"]')).toHaveCount(1);
  }
  await page.getByTestId('ground-camera-toggle').click();
  await expect(board).toHaveAttribute('viewBox','-72 0 1280 640');
  await board.screenshot({path:'test-results/away-wide-colony-initial-'+width+'.png'});

  // The wider destination lies beyond the original east edge; Playwright
  // exercises real right-click picking with the SVG's actual CTM, not a
  // fabricated test-only reveal or a teleported officer.
  await orderCell(page,15,5);
  await expect(page.getByTestId('ground-plaza-floor-15,5'))
    .toHaveAttribute('data-fog','visible');
  // Three adjacent canonical obstacles become ONE explored industrial bay.
  // No separate box-art remains, while the original blocked cell IDs exist.
  const hangar=page.getByTestId('ground-colony-industrial-bay');
  await expect(hangar).toHaveAttribute('data-footprint','14,2 15,2 16,2');
  await expect(hangar).toHaveAttribute('pointer-events','none');
  for(const id of ['14,2','15,2','16,2']){
    await expect(page.getByTestId('ground-architecture-wall-'+id)).toHaveCount(0);
    await expect(board.locator('[data-cell-id="'+id+'"]')).toHaveCount(1);
  }

  await expect(page.getByTestId('ground-plaza-light-15,4'))
    .toHaveAttribute('data-fog','visible');
  await expect(page.getByTestId('ground-landmark-sensor-vault')).toHaveCount(1);
  await board.screenshot({path:'test-results/away-wide-colony-east-'+width+'.png'});

  await page.getByTestId('ground-camera-toggle').click();
  await expect(board).not.toHaveAttribute('viewBox','-72 0 1280 640');
  await board.screenshot({path:'test-results/away-wide-colony-follow-'+width+'.png'});
  await page.reload();
  await expect(page.getByTestId('ground-unit-venn'))
    .toHaveAttribute('data-grid-x','15');
  await expect(page.getByTestId('ground-unit-venn'))
    .toHaveAttribute('data-grid-y','5');
  await expect(page.getByTestId('ground-plaza-floor-15,5'))
    .toHaveAttribute('data-fog','visible');  await expect(page.getByTestId('ground-colony-industrial-bay')).toHaveCount(1);

  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
    .toBe(true);
 });
}
