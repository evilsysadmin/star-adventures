import {expect,test,type Page} from '@playwright/test';

test.use({storageState:{cookies:[],origins:[]},hasTouch:true});

async function cellScreen(page:Page,x:number,y:number){
 return page.getByTestId('ground-squad-board').evaluate((el,{x,y})=>{
  const svg=el as SVGSVGElement,matrix=svg.getScreenCTM(),rect=svg.getBoundingClientRect();
  if(!matrix)throw new Error('Missing physical surface projection');
  const p=svg.createSVGPoint();p.x=440+(x-y)*40;p.y=52+(x+y)*20;
  const screen=p.matrixTransform(matrix);
  return {x:screen.x-rect.left,y:screen.y-rect.top};
 },{x,y});
}
async function tapCell(page:Page,x:number,y:number){
 const position=await cellScreen(page,x,y);
 await page.getByTestId('ground-squad-board').tap({position});
}
async function land(page:Page){
 await page.goto('/');
 await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:25000});
 await page.getByTestId('captain-transport').click();
 await page.getByTestId('transport-confirm').click();
 await expect(page.getByTestId('ground-squad-board')).toBeVisible();
}

for(const width of [390,430]){
 test('touch beta: select officer, one-tap solo + team movement, F5 and classic two-tap rollback '+width,
 async({page})=>{
  test.setTimeout(180000);
  page.setDefaultTimeout(16000);
  await page.setViewportSize({width,height:850});
  await land(page);
  const board=page.getByTestId('ground-squad-board'),venn=page.getByTestId('ground-unit-venn');
  const move=page.getByTestId('ground-move-mode');
  await expect(venn).toHaveAttribute('data-world-x','4.000');
  // The DEFAULT classic mode must not silently issue orders on one floor tap.
  await tapCell(page,3,5);
  await expect(venn).toHaveAttribute('data-world-x','4.000');
  await expect(move).toHaveAttribute('aria-pressed','false');
  await page.locator('.ground-squad-instructions summary').tap();
  await page.getByTestId('ground-realtime-toggle').tap();
  await expect(page.getByTestId('ground-realtime-toggle')).toHaveAttribute('aria-pressed','true');
  await expect(page.getByTestId('ground-move-status'))
    .toContainText('Toca el terreno');

  // Tap the actual officer body: selection, never movement. Crew rail can
  // return selection to Venn without entering an action mode.
  await page.getByTestId('ground-unit-dorn').tap();
  await expect(page.getByTestId('ground-select-dorn')).toHaveAttribute('aria-pressed','true');
  await expect(venn).toHaveAttribute('data-world-x','4.000');
  await page.getByTestId('ground-select-venn').tap();
  await expect(page.getByTestId('ground-select-venn')).toHaveAttribute('aria-pressed','true');

  // Genuine browser touch on terrain accepts a real free-walk command
  // immediately, with NO preceding Mover button press.
  await tapCell(page,3,5);
  await expect(move).toHaveAttribute('aria-pressed','false');
  await expect(venn).toHaveAttribute('data-walk-phase','moving',{timeout:8000});
  await expect(venn).toHaveAttribute('data-walk-facing','left');
  await expect(venn).toHaveAttribute('data-walk-phase','idle',{timeout:10000});
  await expect(venn).toHaveAttribute('data-walk-facing','left');
  await expect(page.getByTestId('ground-officer-sprite-venn')).toHaveAttribute('transform','scale(-1 1)');
  await expect(page.getByTestId('ground-unit-dorn')).toHaveAttribute('data-walk-facing','neutral');
  await expect(venn).toHaveAttribute('data-grid-x','3');
  await expect(venn).toHaveAttribute('data-grid-y','5');
  await page.getByTestId('ground-select-all').tap();
  await tapCell(page,2,5);
  await expect(page.getByTestId('ground-move-status')).toContainText('Formación de 3 oficiales');
  await expect(move).toHaveAttribute('aria-pressed','false');
  await expect.poll(async()=>page.evaluate(()=>{
   const saved=localStorage.getItem('shadowops.star-adventures.ground-realtime.v1');
   return saved?JSON.parse(saved).motion.officers.filter(
    (unit:{route:unknown[]})=>unit.route.length>0).length:0;
  }),{timeout:8000}).toBeGreaterThanOrEqual(2);
  await page.screenshot({path:'test-results/k47-touch-direct-moving-'+width+'.png'});
  await expect.poll(async()=>page.evaluate(()=>{
   const saved=localStorage.getItem('shadowops.star-adventures.ground-realtime.v1');
   return saved?JSON.parse(saved).motion.officers.every(
    (unit:{route:unknown[]})=>unit.route.length===0):false;
  }),{timeout:22000}).toBe(true);
  const team=await page.evaluate(()=>{
   const saved=localStorage.getItem('shadowops.star-adventures.ground-realtime.v1');
   return JSON.parse(saved!).motion.officers as Array<{id:string;x:number;y:number}>;
  });
  expect(new Set(team.map(u=>u.x.toFixed(3)+','+u.y.toFixed(3))).size).toBe(3);
  await expect(page.getByTestId('ground-move-status')).toContainText('ha llegado a');
  await page.screenshot({path:'test-results/k47-touch-direct-arrived-'+width+'.png'});
  await expect(board.locator('[data-cell-id]')).toHaveCount(216);
  await expect(board.locator('[data-fog-cell="16,10"]')).toHaveAttribute('data-fog-state','unknown');
  await page.reload();
  await expect(page.getByTestId('ground-realtime-toggle')).toHaveAttribute('aria-pressed','true');
  const reloaded=await page.evaluate(()=>{
   const saved=localStorage.getItem('shadowops.star-adventures.ground-realtime.v1');
   return JSON.parse(saved!).motion.officers as Array<{id:string;x:number;y:number}>;
  });
  expect(reloaded.map(u=>({id:u.id,x:u.x,y:u.y})))
    .toEqual(team.map(u=>({id:u.id,x:u.x,y:u.y})));

  // Opting out does not commit experimental routes into the original journal.
  await page.locator('.ground-squad-instructions summary').tap();
  await page.getByTestId('ground-realtime-toggle').tap();
  await expect(venn).toHaveAttribute('data-walk-facing','neutral');
  await expect(venn).toHaveAttribute('data-world-x','4.000');
  expect(await page.evaluate(()=>localStorage.getItem(
    'shadowops.star-adventures.ground-realtime.v1'))).toBeNull();
  await tapCell(page,3,5);
  await expect(venn).toHaveAttribute('data-world-x','4.000',
    {timeout:1500});
  // In classic mode a floor tap deselects (by design). Select a real officer
  // again before using the *explicit* Mover action. The beta alone bypasses
  // this extra tap; never mistake an empty selection for a movement bug.
  await expect(page.getByTestId('ground-selection-status'))
    .toContainText('Ningún oficial seleccionado');
  await page.getByTestId('ground-select-venn').tap();
  await expect(page.getByTestId('ground-select-venn')).toHaveAttribute('aria-pressed','true');
  await move.tap();
  await expect(move).toHaveAttribute('aria-pressed','true');
  await tapCell(page,3,5);
  await expect(venn).toHaveAttribute('data-grid-x','3');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}

test('desktop mouse beta remains deliberate: left-click selects, right-click orders',async({page})=>{
 test.setTimeout(70000);
 await page.setViewportSize({width:1280,height:850});
 await land(page);
 await page.locator('.ground-squad-instructions summary').click();
 await page.getByTestId('ground-realtime-toggle').click();
 const venn=page.getByTestId('ground-unit-venn');
 await page.getByTestId('ground-squad-board').locator('[data-cell-id="3,5"]').click();
 await expect(venn).toHaveAttribute('data-world-x','4.000');
 await page.getByTestId('ground-select-venn').click();
 await page.getByTestId('ground-squad-board').locator('[data-cell-id="3,5"]')
  .click({button:'right'});
 await expect(venn).toHaveAttribute('data-grid-x','3',{timeout:10000});
 await expect(venn).toHaveAttribute('data-walk-phase','idle',{timeout:10000});
 // Returning to the vacated original tile must face the other way.
 await page.getByTestId('ground-squad-board').locator('[data-cell-id="4,5"]')
  .click({button:'right'});
 await expect(venn).toHaveAttribute('data-walk-facing','right');
 await expect(venn).toHaveAttribute('data-walk-phase','idle',{timeout:10000});
 await expect(venn).toHaveAttribute('data-grid-x','4');
 await expect(venn).toHaveAttribute('data-walk-facing','right');
 await expect(page.getByTestId('ground-officer-sprite-venn')).not.toHaveAttribute('transform','scale(-1 1)');
});


test('realtime pose handoff keeps one decoded layer opaque and respects reduced motion',async({page})=>{
 test.setTimeout(70000);
 await page.setViewportSize({width:390,height:850});
 // Deterministic decodable stand-ins exercise layer lifecycle independently
 // of CDN availability; the other journeys still capture actual artwork.
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLytAAAAABJRU5ErkJggg==','base64');
 await page.route(/\/star-adventures\/tactical\/officer-(?:(?:female|male)-walk-v1|mvs(?:-male)?-v1)-[^/]+\.webp$/,route=>
  route.fulfill({status:200,contentType:'image/png',
    headers:{'access-control-allow-origin':'*'},body:png}));
 await page.emulateMedia({reducedMotion:'no-preference'});
 await land(page);
 await page.locator('.ground-squad-instructions summary').tap();
 await page.getByTestId('ground-realtime-toggle').tap();
 const actor=page.getByTestId('ground-unit-venn');
 const idle=page.getByTestId('ground-officer-sprite-venn');
 const walk=page.getByTestId('ground-officer-walk-venn');
 await expect(idle).toHaveAttribute('data-asset-state','loaded');
 await expect(actor).toHaveAttribute('data-walk-atlas-ready','true');
 await expect(idle).toHaveCSS('opacity','1');
 await expect(walk).toHaveCSS('opacity','0');
 await expect(walk).toHaveCSS('visibility','hidden');
 await expect(walk).toHaveCSS('transition-duration','0.12s, 0s');
 // Collect both layers in the same browser frame, before issuing the order.
 // Sequential locator polling can miss the short steady walking phase on CI.
 type BlendProbe={moving:boolean;arrived:boolean;settledWalk:boolean;minCoverage:number;samples:number;done:boolean};
 const arm=async()=>actor.evaluate(element=>{
  const record={moving:false,arrived:false,settledWalk:false,minCoverage:1,samples:0,done:false};
  (window as typeof window & {__poseBlend?:typeof record}).__poseBlend=record;
  const until=performance.now()+10000;
  const sample=()=>{
   const moving=element.getAttribute('data-walk-phase')==='moving';
   if(moving)record.moving=true;
   if(record.moving&&!moving)record.arrived=true;
   const idle=element.querySelector('[data-testid="ground-officer-sprite-venn"]');
   const walk=element.querySelector('[data-testid="ground-officer-walk-venn"]');
   if(idle&&walk){
    const idleStyle=getComputedStyle(idle),walkStyle=getComputedStyle(walk);
    const a=idleStyle.visibility==='hidden'?0:Number(idleStyle.opacity);
    const b=walkStyle.visibility==='hidden'?0:Number(walkStyle.opacity);
    record.minCoverage=Math.min(record.minCoverage,Math.max(a,b));
    if(moving&&a<=.01&&b>=.99)record.settledWalk=true;
    record.samples++;
    if(record.arrived&&a>=.99&&b<=.01&&walkStyle.visibility==='hidden')record.done=true;
   }else{
    record.minCoverage=0;
   }
   if(!record.done&&performance.now()<until)requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
 });
 const assertHandoff=async(x:number,y:number)=>{
  await arm();
  await tapCell(page,x,y);
  await expect.poll(async()=>page.evaluate(()=>
   (window as typeof window & {__poseBlend?:BlendProbe}).__poseBlend?.done??false
  ),{timeout:12000}).toBe(true);
  const record=await page.evaluate(()=>
   (window as typeof window & {__poseBlend?:BlendProbe}).__poseBlend);
  expect(record?.moving).toBe(true);
  expect(record?.arrived).toBe(true);
  expect(record?.settledWalk).toBe(true);
  expect(record?.samples).toBeGreaterThan(2);
  expect(record?.minCoverage).toBeGreaterThanOrEqual(.95);
  await expect(actor).toHaveAttribute('data-walk-phase','idle');
  await expect(idle).toHaveCSS('opacity','1');
  await expect(walk).toHaveCSS('opacity','0');
  await expect(walk).toHaveCSS('visibility','hidden');
 };
 await assertHandoff(3,5);
 await page.emulateMedia({reducedMotion:'reduce'});
 // The global accessibility stylesheet uses .01ms !important instead
 // of literal zero. Verify effective duration AND delay, not serialization.
 expect(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
 for(const layer of [idle,walk]){
  const timing=await layer.evaluate(element=>{
   const style=getComputedStyle(element);
   const milliseconds=(value:string)=>value.split(',').map(part=>{
    const token=part.trim();
    return Number.parseFloat(token)*(token.endsWith('ms')?1:1000);
   });
   return [...milliseconds(style.transitionDuration),...milliseconds(style.transitionDelay)];
  });
  expect(timing.every(ms=>Number.isFinite(ms)&&Math.abs(ms)<=.011)).toBe(true);
 }
 await assertHandoff(4,5);
});
