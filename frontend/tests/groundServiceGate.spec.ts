import {expect,test,type Page} from '@playwright/test';

// A second real perimeter entrance, not a painted bridge that officers
// cannot traverse. The exact same saved command history works after F5.
test.use({storageState:{cookies:[],origins:[]}});

async function moveTo(page:Page,x:number,y:number){
 const board=page.getByTestId('ground-squad-board');
 const at=await board.evaluate((element,{x,y})=>{
  const svg=element as SVGSVGElement,point=svg.createSVGPoint();
  point.x=440+(x-y)*40;point.y=52+(x+y)*20;
  const matrix=svg.getScreenCTM();
  if(!matrix)throw new Error('No SVG screen CTM for the actual cell');
  const screen=point.matrixTransform(matrix),rect=svg.getBoundingClientRect();
  return {x:screen.x-rect.left,y:screen.y-rect.top};
 },{x,y});
 await board.click({button:'right',position:at});
}

for(const width of [390,1280]){
 test('southern service gate is traversable, visible under fog and persistent '+width+'px',async({page})=>{
  test.setTimeout(120_000);
  page.setDefaultTimeout(18_000);
  await page.setViewportSize({width,height:850});
  await page.goto('/');
  await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:25_000});
  await page.getByTestId('captain-transport').click({timeout:25_000});
  await page.getByTestId('transport-confirm').click();
  const board=page.getByTestId('ground-squad-board');
  await expect(board).toBeVisible();
  for(const tile of ['8,4','8,5','8,6','8,7','9,6'])
   await expect(board.locator('[data-cell-id="'+tile+'"]')).toHaveCount(1);
  await page.getByTestId('ground-camera-toggle').click();
  await expect(board).toHaveAttribute('viewBox','0 0 1120 550');
  const unknown=await board.locator('[data-fog-state="unknown"]').count();
  expect(unknown).toBeGreaterThan(0);
  // Moving a real officer to the rear maintenance entrance discovers it
  // through the authoritative sight/replay system, never by showing the map.
  await page.getByTestId('ground-select-mira').click();
  await moveTo(page,7,6);
  const mira=page.getByTestId('ground-unit-mira');
  await expect(mira).toHaveAttribute('data-grid-x','7');
  await expect(mira).toHaveAttribute('data-grid-y','6');
  await expect(mira).toHaveAttribute('data-walk-phase','idle',{timeout:18_000});
  const gate=page.getByTestId('ground-service-gate');
  await expect(gate).toHaveCount(1);
  await expect(gate).toHaveAttribute('data-fog','visible');
  const walkable=await board.evaluate(svg=>{
   const blocked=new Set(['8,5','8,7']);
   const items=['8,5','8,6','8,7'].map(tile=>{
    const polygon=svg.querySelector('[data-cell-id="'+tile+'"]');
    return {tile,found:Boolean(polygon),fill:polygon?.getAttribute('fill')};
   });
   return items.map(x=>({...x,isBoundary:blocked.has(x.tile)}));
  });
  expect(walkable.every(x=>x.found)).toBe(true);
  expect(walkable.find(x=>x.tile==='8,6')!.fill).not.toBe(walkable.find(x=>x.tile==='8,5')!.fill);
  await moveTo(page,9,6);
  await expect(mira).toHaveAttribute('data-grid-x','9');
  await expect(mira).toHaveAttribute('data-grid-y','6');
  await expect(mira).toHaveAttribute('data-walk-phase','idle',{timeout:18_000});
  await expect(page.getByTestId('ground-move-status')).toContainText('9:6');
  await expect(gate).toHaveAttribute('data-fog','visible');
  await page.screenshot({path:'test-results/away-south-service-gate-'+width+'.png'});
  await page.reload();
  await expect(board).toBeVisible();
  await expect(page.getByTestId('ground-unit-mira')).toHaveAttribute('data-grid-x','9');
  await expect(page.getByTestId('ground-unit-mira')).toHaveAttribute('data-grid-y','6');
  await expect(page.getByTestId('ground-service-gate')).toHaveAttribute('data-fog','visible');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}
