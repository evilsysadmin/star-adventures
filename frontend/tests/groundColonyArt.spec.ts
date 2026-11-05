import {expect,test,type Page} from '@playwright/test';

test.use({storageState:{cookies:[],origins:[]}});

async function orderCell(page:Page,x:number,y:number){
 const board=page.getByTestId('ground-squad-board');
 const at=await board.evaluate((element,{x,y})=>{
  const svg=element as SVGSVGElement,point=svg.createSVGPoint();
  point.x=440+(x-y)*40;point.y=52+(x+y)*20;
  const matrix=svg.getScreenCTM();
  if(!matrix)throw new Error('No surface picking transform');
  const screen=point.matrixTransform(matrix),rect=svg.getBoundingClientRect();
  return {x:screen.x-rect.left,y:screen.y-rect.top};
 },{x,y});
 await board.click({button:'right',position:at});
}

for(const width of [390,1280]){
 test('original colony set dressing obeys fog and leaves cell picking intact '+width,async({page})=>{
  test.setTimeout(110_000);
  page.setDefaultTimeout(15_000);
  await page.setViewportSize({width,height:850});
  await page.goto('/');
  await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:25_000});
  await page.getByTestId('captain-transport').click({timeout:25_000});
  await page.getByTestId('transport-confirm').click();
  const board=page.getByTestId('ground-squad-board');
  await expect(board).toBeVisible();
  await expect(page.getByTestId('ground-colony-floor')).toHaveCount(1);
  await expect(page.getByTestId('ground-colony-fixtures')).toHaveCount(1);
  await expect(page.getByTestId('ground-dressing-4,4')).toHaveAttribute('data-fog','visible');
  await expect(page.getByTestId('ground-dressing-9,4')).toHaveCount(0);
  await expect(page.getByTestId('ground-cargo-10,2')).toHaveCount(0);
  await page.getByTestId('ground-camera-toggle').click();
  await board.screenshot({path:'test-results/away-colony-initial-'+width+'.png'});
  await orderCell(page,9,4);
  const venn=page.getByTestId('ground-unit-venn');
  await expect(venn).toHaveAttribute('data-grid-x','9');
  await expect(venn).toHaveAttribute('data-walk-phase','idle',{timeout:18_000});
  await expect(page.getByTestId('ground-dressing-9,4')).toHaveAttribute('data-fog','visible');
  await expect(page.getByTestId('ground-cargo-10,2')).toHaveCount(1);
  await board.screenshot({path:'test-results/away-colony-discovered-'+width+'.png'});
  await orderCell(page,4,5);
  await expect(venn).toHaveAttribute('data-walk-phase','idle',{timeout:18_000});
  await expect(page.getByTestId('ground-dressing-9,4')).toHaveAttribute('data-fog','remembered');
  await page.reload();
  await expect(page.getByTestId('ground-dressing-9,4')).toHaveAttribute('data-fog','remembered');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}
