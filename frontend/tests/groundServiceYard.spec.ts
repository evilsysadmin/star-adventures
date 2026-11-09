import {expect,test,type Page} from '@playwright/test';

test.use({storageState:{cookies:[],origins:[]}});

// Use the actual SVG world-coordinate pointer path; never bypass selection,
// mission state or the canonical movement rules in order to visit the yard.
async function walk(page:Page,x:number,y:number){
  const board=page.getByTestId('ground-squad-board');
  const point=await board.evaluate((node,{x,y})=>{
    const svg=node as SVGSVGElement,p=svg.createSVGPoint();
    p.x=440+(x-y)*40;p.y=52+(x+y)*20;
    const transform=svg.getScreenCTM();
    if(!transform)throw new Error('Missing SVG transform');
    const q=p.matrixTransform(transform),rect=svg.getBoundingClientRect();
    return {x:q.x-rect.left,y:q.y-rect.top};
  },{x,y});
  await board.click({button:'right',position:point});
  const officer=page.getByTestId('ground-unit-venn');
  await expect(officer).toHaveAttribute('data-grid-x',String(x));
  await expect(officer).toHaveAttribute('data-grid-y',String(y));
  await expect(officer).toHaveAttribute('data-walk-phase','idle',{timeout:20_000});
}

for(const width of [390,1280]){
  test('the service yard remains a real explored extension of both gates '+width,async({page})=>{
    test.setTimeout(135_000);
    await page.setViewportSize({width,height:850});
    await page.goto('/');
    await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:25_000});
    await page.getByTestId('captain-transport').click({timeout:25_000});
    await page.getByTestId('transport-confirm').click();
    const board=page.getByTestId('ground-squad-board');
    await expect(board).toBeVisible();
    const yard=page.getByTestId('ground-service-yard');
    await expect(yard).toHaveAttribute('data-topology-valid','true');
    expect(await yard.evaluate(node=>({
      hidden:node.getAttribute('aria-hidden'),
      events:getComputedStyle(node).pointerEvents,
    }))).toEqual({hidden:'true',events:'none'});

    // No advance map reveal. Blocked stations and terrain can never become
    // painted walkable floor just because they lie inside the workyard.
    await expect(page.getByTestId('ground-yard-floor-11,7')).toHaveCount(0);
    await expect(page.getByTestId('ground-yard-floor-10,6')).toHaveCount(0);
    await expect(page.getByTestId('ground-yard-loading-turntable')).toHaveCount(0);
    await board.screenshot({path:'test-results/away-workyard-initial-'+width+'.png'});

    await page.getByTestId('ground-camera-toggle').click();
    await walk(page,10,4);
    await expect(page.getByTestId('ground-yard-floor-10,4'))
      .toHaveAttribute('data-fog','visible');
    const turntable=page.getByTestId('ground-yard-loading-turntable');
    await expect(turntable).toHaveAttribute('data-fog','visible');
    const footprint=await turntable.evaluate(node=>{
      const box=(node as SVGGraphicsElement).getBBox();
      return {width:box.width,height:box.height};
    });
    expect(footprint.width).toBeGreaterThan(140);
    expect(footprint.height).toBeGreaterThan(60);
    await expect(page.getByTestId('ground-yard-lane-9,4-to-10,4'))
      .toHaveAttribute('data-fog','visible');

    await walk(page,11,7);
    await expect(page.getByTestId('ground-yard-floor-11,7'))
      .toHaveAttribute('data-fog','visible');
    await expect(page.getByTestId('ground-yard-curb-11,7-east'))
      .toHaveAttribute('data-wall-cell','12,7');
    // The 8,6 service gate is still a real open, selectable passage.
    await expect(page.getByTestId('ground-gateway-8,6'))
      .toHaveAttribute('data-gateway-kind','service');
    await board.screenshot({path:'test-results/away-workyard-revealed-'+width+'.png'});
    await page.getByTestId('ground-camera-toggle').click();
    await board.screenshot({path:'test-results/away-workyard-follow-'+width+'.png'});
    await page.reload();
    await expect(page.getByTestId('ground-yard-floor-11,7')).toHaveCount(1);
    await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-x','11');
    await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-y','7');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
      .toBe(true);
  });
}
