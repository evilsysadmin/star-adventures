import {expect,test,type Page} from '@playwright/test';

test.use({storageState:{cookies:[],origins:[]}});

async function move(page:Page,x:number,y:number){
 const board=page.getByTestId('ground-squad-board');
 const offset=await board.evaluate((node,{x,y})=>{
  const svg=node as SVGSVGElement,p=svg.createSVGPoint();
  p.x=440+(x-y)*40;p.y=52+(x+y)*20;
  const m=svg.getScreenCTM();
  if(!m)throw new Error('SVG picking transform missing');
  const q=p.matrixTransform(m),box=svg.getBoundingClientRect();
  return {x:q.x-box.left,y:q.y-box.top};
 },{x,y});
 await board.click({button:'right',position:offset});
 await expect(page.getByTestId('ground-unit-venn'))
  .toHaveAttribute('data-grid-x',String(x));
 await expect(page.getByTestId('ground-unit-venn'))
  .toHaveAttribute('data-grid-y',String(y));
 await expect(page.getByTestId('ground-unit-venn'))
  .toHaveAttribute('data-walk-phase','idle',{timeout:20000});
}

for(const width of [390,1280]){
 test('real archive 3D volume renders only after discovery and remains click-through '+width,async({page})=>{
  test.setTimeout(140_000);
  await page.setViewportSize({width,height:850});
  await page.goto('/');
  await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:25000});
  await page.getByTestId('captain-transport').click({timeout:25000});
  await page.getByTestId('transport-confirm').click();
  const board=page.getByTestId('ground-squad-board');
  await expect(board).toBeVisible();
  const archive=page.getByTestId('ground-archive-volume-3d');
  await expect(archive).toHaveAttribute('data-topology-valid','true');
  await expect(archive).toHaveAttribute('data-fog','unknown');
  await expect(archive).toHaveAttribute('visibility','hidden');
  // No WebGL is needed for an unseen sector; old SVG gameplay remains live.
  await board.screenshot({path:'test-results/away-archive-before-'+width+'.png'});

  // Travel through the authored open approach. This is a true right-click
  // order, not a synthetic snapshot or fake reveal of the target structure.
  await page.getByTestId('ground-camera-toggle').click();
  await move(page,2,3);
  await expect(archive).toHaveAttribute('visibility','visible');
  await expect(archive).toHaveAttribute('data-renderer-state','ready',{timeout:20000});
  await expect(archive).toHaveAttribute('data-fog','visible');
  const layer=await archive.evaluate(node=>{
   const canvas=node.querySelector('canvas') as HTMLCanvasElement|null;
   return {pointer:getComputedStyle(node).pointerEvents,
     childPointer:canvas?getComputedStyle(canvas).pointerEvents:null,
     width:canvas?.width,height:canvas?.height};
  });
  expect(layer).toEqual({pointer:'none',childPointer:'none',width:1120,height:550});
  await board.screenshot({path:'test-results/away-archive-discovered-'+width+'.png'});

  // The world-space WebGL layer cannot take a move order from any true tile.
  await move(page,1,4);
  await expect(page.getByTestId('ground-landmark-sensor-vault')).toHaveCount(1);
  await page.getByTestId('ground-camera-toggle').click();
  await board.screenshot({path:'test-results/away-archive-follow-'+width+'.png'});
  await page.reload();
  await expect(board).toBeVisible();
  await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-x','1');
  await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-y','4');
  await expect(page.getByTestId('ground-archive-volume-3d'))
    .toHaveAttribute('data-renderer-state','ready',{timeout:20000});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
    .toBe(true);
 });
}
