import {expect,test,type Page} from '@playwright/test';

test.use({storageState:{cookies:[],origins:[]}});

async function clickGround(page:Page,x:number,y:number,button:'left'|'right'='right'){
  const board=page.getByTestId('ground-squad-board');
  const p=await board.evaluate((element,{x,y})=>{
    const svg=element as SVGSVGElement;
    const center=svg.createSVGPoint();
    center.x=440+(x-y)*40;
    center.y=52+(x+y)*20;
    const matrix=svg.getScreenCTM();
    if(!matrix)throw new Error('Missing isometric projection');
    const screen=center.matrixTransform(matrix),rect=svg.getBoundingClientRect();
    return {x:screen.x-rect.left,y:screen.y-rect.top};
  },{x,y});
  await board.click({position:p,button});
}

const pose=async(page:Page)=>{
  const officer=page.getByTestId('ground-unit-venn');
  return {x:Number(await officer.getAttribute('data-world-x')),
    y:Number(await officer.getAttribute('data-world-y'))};
};

for(const width of [390,1280]){
  test('continuous away walk: real retarget, fog, F5 and safe classic rollback '+width,async({page})=>{
    test.setTimeout(110_000);
    await page.setViewportSize({width,height:850});
    await page.goto('/');
    await expect(page.getByTestId('captain-controls')).toBeVisible();
    await page.getByTestId('captain-transport').click();
    await page.getByTestId('transport-confirm').click();
    await expect(page.getByTestId('ground-squad-board')).toBeVisible();
    const officer=page.getByTestId('ground-unit-venn');
    await expect(officer).toHaveAttribute('data-world-x','4.000');

    // Explicit opt-in keeps the current grid gameplay untouched by default.
    await page.locator('.ground-squad-instructions summary').click();
    const toggle=page.getByTestId('ground-realtime-toggle');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed','true');
    await page.getByTestId('ground-camera-toggle').click(); // whole map for distant order
    if(width<=520)await page.getByTestId('ground-map-sector').selectOption('all');
    await clickGround(page,9,4);
    await expect(officer).toHaveAttribute('data-walk-phase','moving');
    await expect(page.locator('[data-fog-cell="10,4"]')).toHaveAttribute('data-fog-state','unknown');

    await expect.poll(async()=>{
      const p=await pose(page);
      return Math.hypot(p.x-4,p.y-5);
    },{timeout:6000}).toBeGreaterThan(.08);
    const mid=await pose(page);
    expect(Math.hypot(mid.x-9,mid.y-4)).toBeGreaterThan(1);
    // Capture the *actual gameplay follow camera* as well: the overview
    // previously made this improvement almost invisible in screenshots.
    await page.getByTestId('ground-camera-toggle').click();
    await page.getByTestId('ground-squad-board').screenshot({
      path:'test-results/away-realtime-follow-'+width+'.png',
    });
    await page.getByTestId('ground-camera-toggle').click();
    if(width<=520)await page.getByTestId('ground-map-sector').selectOption('all');
    await page.getByTestId('ground-squad-board').screenshot({
      path:'test-results/away-realtime-moving-'+width+'.png',
    });

    // Retarget from the actual fractional position, not from 9:4.
    await clickGround(page,3,5);
    await expect(officer).toHaveAttribute('data-walk-phase','moving');
    const saved=await page.evaluate(()=>{
      const raw=localStorage.getItem('shadowops.star-adventures.ground-realtime.v1');
      return raw?JSON.parse(raw):null;
    });
    expect(saved?.version).toBe(2);
    const last=saved?.motion.officers.find((o:{id:string})=>o.id==='venn').route.at(-1);
    // Browser hit coordinates have finite CSS pixel precision: the movement
    // remains truly subcellular rather than snapping to integer centers.
    expect(Math.abs(last.x-3)).toBeLessThan(.03);
    expect(Math.abs(last.y-5)).toBeLessThan(.03);
    const beforeReload=await pose(page);
    await page.reload();
    await expect(page.getByTestId('ground-realtime-toggle')).toHaveAttribute('aria-pressed','true');
    const resumed=page.getByTestId('ground-unit-venn');
    const afterReload=await pose(page);
    expect(Math.hypot(afterReload.x-beforeReload.x,afterReload.y-beforeReload.y))
      .toBeLessThan(.7);
    await expect(resumed).toHaveAttribute('data-walk-phase','idle',{timeout:8000});
    const arrived=await pose(page);
    expect(Math.abs(arrived.x-3)).toBeLessThan(.03);
    expect(Math.abs(arrived.y-5)).toBeLessThan(.03);

    // F5 restores the close follow camera: use overview for a distant
    // group target, rather than clicking an offscreen point.
    await page.getByTestId('ground-camera-toggle').click();
    if(width<=520)await page.getByTestId('ground-map-sector').selectOption('all');
    await expect(page.getByTestId('ground-camera-toggle'))
      .toHaveAttribute('aria-pressed','false');
    // Group movement remains explicitly unavailable until collision avoidance.
    await page.getByTestId('ground-select-all').click();
    await clickGround(page,6,5);
    await expect(page.getByTestId('ground-move-status')).toContainText('único oficial');

    // Classic rollback removes the experimental sidecar and restores v1.
    await page.locator('.ground-squad-instructions summary').click();
    await page.getByTestId('ground-realtime-toggle').click();
    await expect(page.getByTestId('ground-realtime-toggle')).toHaveAttribute('aria-pressed','false');
    await expect(resumed).toHaveAttribute('data-world-x','4.000');
    expect(await page.evaluate(()=>localStorage.getItem(
      'shadowops.star-adventures.ground-realtime.v1'))).toBeNull();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}
