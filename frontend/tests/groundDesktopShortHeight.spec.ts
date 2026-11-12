import {expect,test,type Page} from '@playwright/test';

test.use({storageState:{cookies:[],origins:[]}});

async function land(page:Page){
 await page.goto('/');
 await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:25_000});
 await page.getByTestId('captain-transport').click();
 await page.getByTestId('transport-confirm').click();
 await expect(page.getByTestId('ground-squad-board')).toBeVisible();
}

for(const {width,height} of [
 {width:1462,height:666}, // 1828x832 screen at ~125% browser zoom
 {width:1280,height:700}, // boundary with the tall K-47 desktop stage
 {width:1757,height:720},
]){
 test('short-height desktop radio does not obscure world labels '+width+'x'+height,async({page})=>{
  test.setTimeout(100_000);
  await page.setViewportSize({width,height});
  await land(page);
  const mission=page.getByTestId('mission-transmission');
  await expect(mission).toBeVisible();
  const result=await page.evaluate(()=>{
   const box=(selector:string)=>document.querySelector(selector)!.getBoundingClientRect();
   const mission=box('[data-testid="mission-transmission"]');
   const status=box('.ground-squad-event-strip');
   const toolbar=box('.ground-squad-toolbar');
   const camera=box('.ground-squad-viewbar');
   const crew=box('[data-testid="ground-crew-rail"]');
   const overlap=(a:DOMRect,b:DOMRect)=>a.left<b.right&&a.right>b.left
    &&a.top<b.bottom&&a.bottom>b.top;
   const labels=[...document.querySelectorAll('[data-testid^="ground-waypoint-label-"]')]
    .filter(n=>getComputedStyle(n).visibility!=='hidden')
    .map(n=>({id:n.getAttribute('data-testid'),
     hit:overlap(mission,n.getBoundingClientRect())}));
   const units=['venn','dorn','mira'].map(id=>({
    id,hit:overlap(mission,box('[data-testid="ground-unit-'+id+'"]'))
   }));
   return {
    top:mission.top,bottom:mission.bottom,x:mission.left,
    computedBottom:getComputedStyle(document.querySelector('[data-testid="mission-transmission"]')!).bottom,
    crewTop:crew.top,
    statusTop:status.top,
    cameraHit:overlap(mission,camera),
    toolbarHit:overlap(mission,toolbar),
    crewHit:overlap(mission,crew),
    labels,units,
    noHorizontalOverflow:document.documentElement.scrollWidth<=innerWidth
   };
  });
  // Capture the actual regression window *before* assertions, so a failure
  // preserves evidence even when the station's live position changes.
  await page.screenshot({path:'test-results/away-short-desktop-'+width+'x'+height+'.png'});
  expect(result.computedBottom).toBe('140px');
  expect(result.top).toBeGreaterThan(300);
  expect(result.bottom).toBeLessThan(result.statusTop-8);
  expect(result.noHorizontalOverflow).toBe(true);
  expect(result.cameraHit).toBe(false);
  expect(result.toolbarHit).toBe(false);
  expect(result.crewHit).toBe(false);
  expect(result.labels.filter(x=>x.hit)).toEqual([]);
  expect(result.units.filter(x=>x.hit)).toEqual([]);
  if(height===666)expect(result.crewTop).toBeGreaterThan(200);
  await expect(page.getByTestId('ground-squad-board').locator('[data-cell-id]')).toHaveCount(216);
  if(height===666){
   await expect.poll(()=>page.evaluate(()=>localStorage.getItem(
    'shadowops.star-adventures.spatial.v1'))).toContain('surface');
   // Match the actual user's abandoned-rescue desktop screenshot, not a
   // separate synthetic scene or a mission reset.
   await page.evaluate(()=>localStorage.setItem(
    'shadowops.star-adventures.outpost-orders.v1',JSON.stringify({
      saveVersion:1,mandateId:'outpost-orders',actions:[
        {type:'record',incidentId:'rescue-abandoned',orderId:'evacuate',
         kind:'refusal',witnesses:[],public:true},
        {type:'resolve',orderId:'evacuate',incidentId:'rescue-abandoned',status:'refused'}
      ]})));
   await page.reload();
   await expect(page.getByTestId('mission-phase')).toHaveText('RESCATE ABANDONADO');
   const button=page.getByTestId('abandoned-return');
   await expect(button).toBeVisible();
   const fullyVisible=await mission.evaluate(el=>{
    const r=el.getBoundingClientRect();
    const a=el.querySelector('[data-testid="abandoned-return"]')!.getBoundingClientRect();
    return a.top>=r.top&&a.bottom<=r.bottom&&el.scrollHeight<=el.clientHeight+1;
   });
   expect(fullyVisible).toBe(true);
   await page.screenshot({path:'test-results/away-short-desktop-abandoned-1462x666.png'});
   await button.click();
   await expect(page.getByTestId('explore-area')).toContainText('Puente');
  }
 });
}
