import {expect,test,type Page} from '@playwright/test';
import {freshCaptainStorageState} from './fixtures/browserStartProfiles';

test.use({storageState:freshCaptainStorageState(),hasTouch:true});

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
  // Adding a sixth action must not push any control behind the crew rail.
  const dock=page.locator('.ground-squad-toolbar');
  const rail=page.getByTestId('ground-crew-rail');
  await expect.poll(async()=>{
    const a=await dock.boundingBox(),b=await rail.boundingBox();
    return !!a&&!!b&&a.y>=b.y+b.height-1;
  }).toBe(true);
  await expect.poll(async()=>dock.locator('button').evaluateAll(buttons=>
    buttons.every(button=>button.getBoundingClientRect().height>=44))).toBe(true);
  await page.getByTestId('ground-select-all').tap();
  // Sample the visible label envelopes against all other officer bodies
  // throughout the real formation order. No fixed screenshot timing.
  await board.evaluate(svg=>{
   const result={samples:0,hidden:0,overlaps:0,done:false};
   (window as typeof window & {__plateProbe?:typeof result}).__plateProbe=result;
   let movingSeen=false;
   const until=performance.now()+25000;
   const sample=()=>{
    const units=Array.from(svg.querySelectorAll<SVGGElement>('[data-officer-id][data-proj-x]'));
    const moving=units.some(u=>u.getAttribute('data-walk-phase')==='moving');
    if(moving)movingSeen=true;
    const boxes=units.map(u=>{
     const id=u.getAttribute('data-officer-id');
     const x=Number(u.getAttribute('data-proj-x')),y=Number(u.getAttribute('data-proj-y'));
     const label=u.querySelector<SVGGElement>('[data-testid="ground-officer-nameplate-'+id+'"]')!;
     const art=u.querySelector('[data-testid="ground-officer-sprite-'+id+'"]');
     const hasArt=art?.getAttribute('data-asset-state')==='loaded'||
      (u.getAttribute('data-walk-phase')==='moving'&&u.getAttribute('data-walk-atlas-ready')==='true');
     const box=label.getBBox();
     const dy=label.transform.baseVal.getItem(0).matrix.f;
     return {id,visible:getComputedStyle(label).visibility!=='hidden',
      label:{l:x+box.x,r:x+box.x+box.width,t:y+dy+box.y,b:y+dy+box.y+box.height},
      body:{l:x-21,r:x+21,t:y+(hasArt?-53:-30),b:y+8}};
    });
    const intersects=(a:{l:number;r:number;t:number;b:number},b:{l:number;r:number;t:number;b:number})=>
     a.l<b.r&&a.r>b.l&&a.t<b.b&&a.b>b.t;
    if(moving||movingSeen){
     result.samples++;
     for(const a of boxes){
      if(!a.visible){result.hidden++;continue;}
      if(boxes.some(b=>b.id!==a.id&&(intersects(a.label,b.body)||
       (b.visible&&intersects(a.label,b.label)))))result.overlaps++;
     }
    }
    if(movingSeen&&!moving){result.done=true;return;}
    if(performance.now()<until)requestAnimationFrame(sample);
   };
   requestAnimationFrame(sample);
  });
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
  await expect.poll(async()=>page.evaluate(()=>
   (window as typeof window & {__plateProbe?:{done:boolean}}).__plateProbe?.done??false
  )).toBe(true);
  const plateProbe=await page.evaluate(()=>(window as typeof window & {
   __plateProbe?:{samples:number;hidden:number;overlaps:number}
  }).__plateProbe);
  expect(plateProbe?.samples).toBeGreaterThan(0);
  expect(plateProbe?.overlaps).toBe(0);
  const team=await page.evaluate(()=>{
   const saved=localStorage.getItem('shadowops.star-adventures.ground-realtime.v1');
   return JSON.parse(saved!).motion.officers as Array<{id:string;x:number;y:number}>;
  });
  expect(new Set(team.map(u=>u.x.toFixed(3)+','+u.y.toFixed(3))).size).toBe(3);
  await expect(page.getByTestId('ground-move-status')).toContainText('ha llegado a 2.0:5.0');
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


for(const width of [390,430]){
 test('touch queue: arm once, append return, reload and stop '+width,async({page})=>{
  test.setTimeout(100_000);
  await page.setViewportSize({width,height:850});
  await land(page);
  const help=page.locator('.ground-squad-instructions summary');
  const queue=page.getByTestId('ground-queue-next');
  const move=page.getByTestId('ground-move-mode');
  await help.tap();
  await page.getByTestId('ground-realtime-toggle').tap();
  await page.getByTestId('ground-camera-toggle').tap();
  await page.getByTestId('ground-map-sector').selectOption('all');
  await tapCell(page,9,4);
  await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-walk-phase','moving');
  await help.tap();
  await queue.tap();
  await expect(move).toHaveAttribute('aria-pressed','true');
  await expect(page.getByTestId('ground-move-status')).toContainText('Añadir destino');
  await page.screenshot({path:'test-results/k47-touch-queue-armed-'+width+'.png'});
  await tapCell(page,4,5);
  await expect(move).toHaveAttribute('aria-pressed','false');
  const route=()=>page.evaluate(()=>{
   const raw=localStorage.getItem('shadowops.star-adventures.ground-realtime.v1');
   return JSON.parse(raw!).motion.officers.find((o:{id:string})=>o.id==='venn').route as Array<{x:number;y:number}>;
  });
  const queued=await route();
  expect(queued.at(-1)).toEqual({x:4,y:5});
  expect(queued).toContainEqual({x:9,y:4});
  await page.screenshot({path:'test-results/k47-touch-queue-accepted-'+width+'.png'});
  await page.reload();
  await expect(page.getByTestId('ground-realtime-toggle')).toHaveAttribute('aria-pressed','true');
  expect((await route()).at(-1)).toEqual({x:4,y:5});
  await expect(move).toHaveAttribute('aria-pressed','false');
  await page.getByTestId('ground-stop-officer').tap();
  expect(await route()).toEqual([]);
 });
}


// Resume a valid sidecar with two active exterior routes. Repeated adjacent
// waypoints deliberately keep both prefixes active despite slow CI renderers;
// the real mission planner/restore, browser input and movement are exercised.
for(const width of [390,1280]){
 test('queued formation input preserves two active routes and third officer '+width,async({page})=>{
  test.setTimeout(120_000);
  await page.setViewportSize({width,height:850});
  await land(page);
  const help=page.locator('.ground-squad-instructions summary');
  await help.click();
  await page.getByTestId('ground-realtime-toggle').click();
  const fixture=await page.evaluate(()=>{
   const key='shadowops.star-adventures.ground-realtime.v1';
   const raw=JSON.parse(localStorage.getItem(key)!);
   raw.motion.officers=raw.motion.officers.map((o:{id:string})=>{
    if(o.id==='mira')return {id:o.id,x:13,y:8,route:[]};
    const y=o.id==='venn'?3:6;
    return {id:o.id,x:13,y,route:Array.from({length:79},(_,i)=>({x:i%2===0?14:13,y}))};
   });
   const cells=new Set<string>(raw.explored);
   for(let x=13;x<=16;x++)for(let y=3;y<=8;y++)cells.add(x+','+y);
   raw.explored=[...cells].sort();
   return {key,raw};
  });
  // Install the exact valid sidecar before the app's restore effect runs;
  // otherwise an in-flight React save can race the fixture write on reload.
  await page.addInitScript(({key,raw})=>localStorage.setItem(key,JSON.stringify(raw)),fixture);
  await page.reload();
  await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-walk-phase','moving');
  await expect(page.getByTestId('ground-unit-dorn')).toHaveAttribute('data-walk-phase','moving');
  await expect(page.getByTestId('ground-unit-mira')).toHaveAttribute('data-world-x','13.000');
  const camera=page.getByTestId('ground-camera-toggle');
  if(await camera.getAttribute('aria-pressed')==='true')await camera.click();
  if(width===390)await page.getByTestId('ground-map-sector').selectOption('all');
  await page.getByTestId('ground-selection-additive').click();
  await page.getByTestId('ground-select-dorn').click();
  await expect(page.getByTestId('ground-select-venn')).toHaveAttribute('aria-pressed','true');
  await expect(page.getByTestId('ground-select-dorn')).toHaveAttribute('aria-pressed','true');
  await expect(page.getByTestId('ground-select-mira')).toHaveAttribute('aria-pressed','false');
  if(width===390){
   await help.tap();
   const queue=page.getByTestId('ground-queue-next');
   await expect(queue).toHaveText('Añadir destino a la formación');
   await queue.tap();
   await expect(page.getByTestId('ground-current-notice')).toContainText('las rutas de la formación');
   await tapCell(page,16,3);
  }else{
   const position=await cellScreen(page,16,3);
   await page.getByTestId('ground-squad-board').click({position,button:'right',modifiers:['Shift']});
  }
  const motion=()=>page.evaluate(()=>{
   const raw=localStorage.getItem('shadowops.star-adventures.ground-realtime.v1');
   return JSON.parse(raw!).motion.officers as Array<{id:string;x:number;y:number;route:Array<{x:number;y:number}>}>;
  });
  const queued=await motion(),venn=queued.find(o=>o.id==='venn')!,dorn=queued.find(o=>o.id==='dorn')!;
  expect(venn.route.at(-1)).toEqual({x:16,y:3});
  expect(venn.route.length).toBeGreaterThan(3);
  expect(venn.route).toContainEqual({x:14,y:3});
  expect(dorn.route).toContainEqual({x:14,y:6});
  expect(dorn.route.at(-1)).not.toEqual(venn.route.at(-1));
  expect(queued.find(o=>o.id==='mira')).toEqual({id:'mira',x:13,y:8,route:[]});
  await expect(page.getByTestId('ground-move-mode')).toHaveAttribute('aria-pressed','false');
  await page.screenshot({path:'test-results/k47-formation-queue-'+width+'.png'});
  await page.getByTestId('ground-stop-officer').click();
  expect((await motion()).every(o=>o.route.length===0)).toBe(true);
 });
}
