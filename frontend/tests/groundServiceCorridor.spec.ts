import {expect,test,type Page} from '@playwright/test';

test.use({storageState:{cookies:[],origins:[]}});

// Issue the same actual world-space pointer command as the player. No
// component-internal dispatch, direct snapshot editing or bypassed picking.
async function walk(page:Page,x:number,y:number){
 const board=page.getByTestId('ground-squad-board');
 const point=await board.evaluate((node,{x,y})=>{
  const svg=node as SVGSVGElement,p=svg.createSVGPoint();
  p.x=440+(x-y)*40;p.y=52+(x+y)*20;
  const m=svg.getScreenCTM();
  if(!m)throw new Error('Missing SVG picking transform');
  const q=p.matrixTransform(m),rect=svg.getBoundingClientRect();
  return {x:q.x-rect.left,y:q.y-rect.top};
 },{x,y});
 await board.click({button:'right',position:point});
 const venn=page.getByTestId('ground-unit-venn');
 await expect(venn).toHaveAttribute('data-grid-x',String(x));
 await expect(venn).toHaveAttribute('data-grid-y',String(y));
 await expect(venn).toHaveAttribute('data-walk-phase','idle',{timeout:20_000});
}

for(const width of [390,1280]){
 test('a real continuous passage opens into both existing gateways '+width,async({page})=>{
  test.setTimeout(125_000);
  await page.setViewportSize({width,height:850});
  await page.goto('/');
  await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:25_000});
  await page.getByTestId('captain-transport').click({timeout:25_000});
  await page.getByTestId('transport-confirm').click();
  const board=page.getByTestId('ground-squad-board');
  await expect(board).toBeVisible();
  const corridor=page.getByTestId('ground-connected-service-corridor');
  await expect(corridor).toHaveAttribute('data-topology-valid','true');
  const props=await corridor.evaluate(node=>({
   events:getComputedStyle(node).pointerEvents,
   hidden:node.getAttribute('aria-hidden'),
  }));
  expect(props.events).toBe('none');
  expect(props.hidden).toBe('true');
  // An undiscovered wall/room must remain unrendered until actually seen.
  await expect(page.getByTestId('ground-service-floor-8,3')).toHaveCount(0);
  await expect(page.getByTestId('ground-service-floor-8,5')).toHaveCount(0);
  await expect(page.getByTestId('ground-service-floor-8,7')).toHaveCount(0);
  await expect(page.getByTestId('ground-service-floor-9,4')).toHaveCount(0);
  await expect(page.getByTestId('ground-service-wall-8,4-north')).toHaveCount(0);
  await expect(page.getByTestId('ground-bay-central-hatch')).toHaveCount(1);
  await board.screenshot({path:'test-results/away-connected-corridor-initial-'+width+'.png'});

  await page.getByTestId('ground-camera-toggle').click();
  await expect(board).toHaveAttribute('viewBox','0 0 1120 550');
  await walk(page,9,4);
  await expect(page.getByTestId('ground-service-floor-9,4'))
    .toHaveAttribute('data-fog','visible');
  await expect(page.getByTestId('ground-service-conduit-8,4-to-9,4'))
    .toHaveAttribute('data-fog','visible');
  // The tall glazing belongs to existing wall 8:3, never a fictitious wall
  // in the walkable gateway square 8:4.
  const wall=page.getByTestId('ground-service-wall-8,4-north');
  await expect(wall).toHaveAttribute('data-wall-cell','8,3');
  await expect(wall).toHaveAttribute('data-fog','visible');
  await expect(page.getByTestId('ground-gateway-8,4'))
    .toHaveAttribute('data-gateway-kind','entry');

  await walk(page,9,6);
  await walk(page,8,6);
  await expect(page.getByTestId('ground-service-wall-8,6-north'))
    .toHaveAttribute('data-wall-cell','8,5');
  await expect(page.getByTestId('ground-gateway-8,6'))
    .toHaveAttribute('data-gateway-kind','service');
  await expect(page.getByTestId('ground-service-floor-8,6'))
    .toHaveAttribute('data-fog','visible');
  await board.screenshot({path:'test-results/away-connected-corridor-revealed-'+width+'.png'});

  await walk(page,4,5);
  await expect(wall).toHaveAttribute('data-fog','remembered');
  await page.reload();
  await expect(page.getByTestId('ground-service-wall-8,4-north'))
    .toHaveAttribute('data-fog','remembered');
  await expect(page.getByTestId('ground-service-floor-8,6'))
    .toHaveAttribute('data-fog','remembered');
  await expect(page.getByTestId('ground-unit-venn'))
    .toHaveAttribute('data-grid-x','4');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
    .toBe(true);
 });
}
