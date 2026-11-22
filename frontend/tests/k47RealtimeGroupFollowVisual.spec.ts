import {expect,test,type Page} from '@playwright/test';

test.use({storageState:{cookies:[],origins:[]}});

async function clickGround(page:Page,x:number,y:number){
 const board=page.getByTestId('ground-squad-board');
 const local=await board.evaluate((node,{x,y})=>{
  const svg=node as SVGSVGElement;
  const p=svg.createSVGPoint();
  p.x=440+(x-y)*40;p.y=52+(x+y)*20;
  const m=svg.getScreenCTM(),rect=svg.getBoundingClientRect();
  if(!m)throw new Error('No canonical SVG CTM');
  const q=p.matrixTransform(m);
  return {x:q.x-rect.left,y:q.y-rect.top};
 },{x,y});
 await board.click({position:local,button:'right'});
}

async function metrics(page:Page){
 return page.getByTestId('ground-squad-board').evaluate(node=>{
  const svg=node as SVGSVGElement,v=svg.viewBox.baseVal;
  const stage=svg.getBoundingClientRect();
  const people=['venn','dorn','mira'].map(id=>{
   const unit=svg.querySelector('[data-testid="ground-unit-'+id+'"]')!;
   const r=unit.getBoundingClientRect();
   const x=(r.left+r.right)/2,y=(r.top+r.bottom)/2;
   return {id,x,y,visible:x>stage.left+1&&x<stage.right-1&&
     y>stage.top+1&&y<stage.bottom-1};
  });
  return {x:v.x,y:v.y,height:v.height,width:v.width,
    fits:svg.getAttribute('data-group-frame-fits'),
    follow:svg.getAttribute('data-group-follow'),
    people,aspectError:Math.abs(v.width/v.height-stage.width/stage.height)};
 });
}

for(const width of [390,1280]){
 test('real moving selected trio has readable group follow, same-state A/B and F5 '+width,
 async({page})=>{
  test.setTimeout(180000);
  page.setDefaultTimeout(16000);
  await page.setViewportSize({width,height:850});
  await page.goto('/');
  await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:25000});
  await page.getByTestId('captain-transport').click();
  await page.getByTestId('transport-confirm').click();
  const board=page.getByTestId('ground-squad-board'),venn=page.getByTestId('ground-unit-venn');
  await expect(board).toBeVisible();
  await page.locator('.ground-squad-instructions summary').click();
  await page.getByTestId('ground-realtime-toggle').click();
  await expect(page.getByTestId('ground-realtime-toggle')).toHaveAttribute('aria-pressed','true');

  // Start the REAL continuous solo walk first: selected teammates remain in
  // place. The old leader-only follow would lose them on a narrow phone.
  await page.getByTestId('ground-camera-toggle').click();
  if(width<=520)await page.getByTestId('ground-map-sector').selectOption('all');
  await clickGround(page,9,4);
  await expect(venn).toHaveAttribute('data-walk-phase','moving');
  await page.getByTestId('ground-select-all').click();
  await page.getByTestId('ground-camera-toggle').click();
  await expect(board).toHaveAttribute('data-group-follow','on');

  // Real position, not a destination snap: camera follows the team's
  // changing physical bounding rectangle while Venn is still walking.
  const first=await metrics(page);
  await expect.poll(async()=>Number(await venn.getAttribute('data-world-x')),
    {timeout:9000}).toBeGreaterThan(5);
  const moving=await metrics(page);
  expect(moving.follow).toBe('on');
  expect(moving.aspectError).toBeLessThan(.08);
  for(const p of moving.people)expect(p.visible,p.id+' must stay in active view').toBe(true);
  await page.screenshot({path:'test-results/k47-realtime-group-moving-'+width+'.png'});
  await expect(venn).toHaveAttribute('data-walk-phase','idle',{timeout:10000});
  await expect(venn).toHaveAttribute('data-grid-x','9');
  await expect(venn).toHaveAttribute('data-grid-y','4');
  const after=await metrics(page);
  expect(after.fits).toBe('true');
  for(const p of after.people)expect(p.visible,p.id+' visible at full dispersion').toBe(true);
  expect(after.aspectError).toBeLessThan(.08);
  expect(await board.locator('[data-cell-id]').count()).toBe(216);
  await expect(page.locator('[data-fog-cell="16,10"]')).toHaveAttribute('data-fog-state','unknown');
  await page.screenshot({path:'test-results/k47-realtime-group-after-'+width+'.png'});

  // Same officer positions, same real fog, same view button: compare against
  // the old single-leader camera through a DEV-only rendering flag.
  await page.evaluate(()=>{
   (window as Window&{__k47LegacyGroupFollow?:boolean}).__k47LegacyGroupFollow=true;
  });
  await page.getByTestId('ground-camera-toggle').click();
  await page.getByTestId('ground-camera-toggle').click();
  const before=await metrics(page);
  expect(before.follow).toBe('off');
  expect(after.x!==before.x||after.height!==before.height).toBe(true);
  await page.screenshot({path:'test-results/k47-realtime-group-before-'+width+'.png'});
  if(width<=520)
   expect(before.people.some(p=>!p.visible)).toBe(true);

  await page.evaluate(()=>{
   (window as Window&{__k47LegacyGroupFollow?:boolean}).__k47LegacyGroupFollow=false;
  });
  await page.getByTestId('ground-camera-toggle').click();
  await page.getByTestId('ground-camera-toggle').click();
  await expect(board).toHaveAttribute('data-group-follow','on');
  const returned=await metrics(page);
  expect(returned.x).toBe(after.x);
  expect(returned.height).toBe(after.height);
  // On F5 selection resets to one officer, but every *physical* position and
  // the unmodified classic history are restored. Reselect all to inspect.
  await page.reload();
  await expect(page.getByTestId('ground-realtime-toggle')).toHaveAttribute('aria-pressed','true');
  await expect(venn).toHaveAttribute('data-grid-x','9');
  await page.getByTestId('ground-select-all').click();
  await expect(board).toHaveAttribute('data-group-follow','on');
  const reloaded=await metrics(page);
  expect(reloaded.x).toBe(after.x);
  expect(reloaded.height).toBe(after.height);
  expect(reloaded.people.every(p=>p.visible)).toBe(true);
  // Classic rollback remains authoritative and must never inherit the beta
  // body's destination, camera frame, or continuous terrain memory.
  await page.locator('.ground-squad-instructions summary').click();
  await page.getByTestId('ground-realtime-toggle').click();
  await expect(page.getByTestId('ground-realtime-toggle')).toHaveAttribute('aria-pressed','false');
  await expect(board).toHaveAttribute('data-group-follow','off');
  await expect(venn).toHaveAttribute('data-world-x','4.000');
  expect(await page.evaluate(()=>localStorage.getItem(
   'shadowops.star-adventures.ground-realtime.v1'))).toBeNull();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}
