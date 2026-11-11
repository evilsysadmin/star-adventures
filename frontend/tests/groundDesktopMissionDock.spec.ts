import {expect,test,type Page} from '@playwright/test';

// Desktop-first visual QA: inspect real CSS boxes of the authored world
// and mission channel, not only a static screenshot or a mocked DOM.
test.use({storageState:{cookies:[],origins:[]}});

async function land(page:Page){
 await page.goto('/');
 await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:25_000});
 await page.getByTestId('captain-transport').click();
 await page.getByTestId('transport-confirm').click();
 await expect(page.getByTestId('ground-squad-board')).toBeVisible();
}

for(const {width,height} of [
 {width:1280,height:850},
 {width:1757,height:800},
 {width:1828,height:832},
]){
 test('desktop service radio leaves world objectives uncovered '+width,async({page})=>{
  test.setTimeout(110_000);
  await page.setViewportSize({width,height});
  await land(page);
  const mission=page.getByTestId('mission-transmission');
  await expect(mission).toBeVisible();
  const view=await page.evaluate(()=>{
   const box=(selector:string)=>document.querySelector(selector)!.getBoundingClientRect();
   const radio=box('[data-testid="mission-transmission"]');
   const consoleArea=box('.ground-squad-event-strip');
   const controls=box('.ground-squad-toolbar');
   const cam=box('.ground-squad-viewbar');
   const crew=box('[data-testid="ground-crew-rail"]');
   const overlap=(a:DOMRect,b:DOMRect)=>a.left<b.right&&a.right>b.left
      &&a.top<b.bottom&&a.bottom>b.top;
   const names=[...document.querySelectorAll('[data-testid^="ground-waypoint-label-"]')]
    .filter(n=>getComputedStyle(n).visibility!=='hidden')
    .map(n=>({id:n.getAttribute('data-testid'),
      overlaps:overlap(radio,n.getBoundingClientRect())}));
   const officers=['venn','dorn','mira'].map(id=>({
    id,overlaps:overlap(radio,box('[data-testid="ground-unit-'+id+'"]'))
   }));
   return {top:radio.top,bottom:radio.bottom,
     right:radio.right,left:radio.left,height:radio.height,
     consoleTop:consoleArea.top,crew:overlap(radio,crew),
     controls:overlap(radio,controls),camera:overlap(radio,cam),
     names,officers,noOverflow:document.documentElement.scrollWidth<=innerWidth};
  });
  // Preserve visual evidence even when a strict overlap assertion fails.
  await page.screenshot({path:'test-results/away-desktop-radio-docked-'+width+'.png'});
  expect(view.top).toBeGreaterThan(300);
  expect(view.bottom).toBeLessThan(view.consoleTop-10);
  expect(view.right).toBeLessThanOrEqual(width+1);
  expect(view.left).toBeGreaterThan(width-360);
  expect(view.height).toBeLessThanOrEqual(228);
  expect(view.noOverflow).toBe(true);
  expect(view.crew).toBe(false);
  expect(view.controls).toBe(false);
  expect(view.camera).toBe(false);
  expect(view.names.filter(n=>n.overlaps)).toEqual([]);
  expect(view.officers.filter(n=>n.overlaps)).toEqual([]);
  // The dock never becomes an input interceptor: unchanged canonical board
  // still accepts a real command to a known free cell.
  await expect(page.getByTestId('ground-squad-board').locator('[data-cell-id]')).toHaveCount(216);
  await page.getByTestId('ground-squad-board').locator('[data-cell-id="2,4"]').click({button:'right'});
  await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-x','2');
  await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-y','4');
  if(width===1828){
   await expect.poll(()=>page.evaluate(()=>
    localStorage.getItem('shadowops.star-adventures.spatial.v1'))).toContain('surface');
   // Same abandoned-rescue state as the reported real desktop screenshot.
   await page.evaluate(()=>localStorage.setItem(
    'shadowops.star-adventures.outpost-orders.v1',JSON.stringify({
     saveVersion:1,mandateId:'outpost-orders',actions:[
      {type:'record',incidentId:'rescue-abandoned',orderId:'evacuate',
       kind:'refusal',witnesses:[],public:true},
      {type:'resolve',orderId:'evacuate',incidentId:'rescue-abandoned',status:'refused'},
     ],
    })));
   await page.reload();
   await expect(page.getByTestId('mission-phase')).toHaveText('RESCATE ABANDONADO');
   const returnButton=page.getByTestId('abandoned-return');
   await expect(returnButton).toBeVisible();
   const state=await page.evaluate(()=>{
    const radio=document.querySelector('[data-testid="mission-transmission"]')!;
    const action=radio.querySelector('[data-testid="abandoned-return"]')!;
    const r=radio.getBoundingClientRect(),a=action.getBoundingClientRect();
    return {actionInside:a.top>=r.top&&a.bottom<=r.bottom,
     noInnerScroll:radio.scrollHeight<=radio.clientHeight+1};
   });
   expect(state.actionInside).toBe(true);
   expect(state.noInnerScroll).toBe(true);
   await page.screenshot({path:'test-results/away-desktop-abandoned-docked-1828.png'});
   await returnButton.click();
   await expect(page.getByTestId('explore-area')).toContainText('Puente');
  }
 });
}
