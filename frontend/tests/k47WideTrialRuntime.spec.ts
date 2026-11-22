import {expect,test,type Page} from '@playwright/test';

test.use({storageState:{cookies:[],origins:[]}});

async function land(page:Page){
 await page.goto('/');
 await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:25000});
 await page.getByTestId('captain-transport').click();
 await page.getByTestId('transport-confirm').click();
 await expect(page.getByTestId('ground-squad-board')).toBeVisible();
}

async function actualPosition(page:Page){
 const officer=page.getByTestId('wide-officer-venn');
 return {
  x:Number(await officer.getAttribute('data-world-x')),
  y:Number(await officer.getAttribute('data-world-y')),
 };
}

for(const width of [390,1280]){
 test('K-47 640-cell playable trial: real move, discovery, F5 and classic exit '+width,
 async({page})=>{
  test.setTimeout(210000);
  page.setDefaultTimeout(16000);
  await page.setViewportSize({width,height:850});
  await land(page);
  const oldSidecar=await page.evaluate(()=>
   localStorage.getItem('shadowops.star-adventures.ground-realtime.v1'));
  await page.locator('.ground-squad-instructions summary').click();
  await expect(page.getByTestId('wide-trial-enter')).toBeVisible();
  await page.getByTestId('wide-trial-enter').click();
  await expect(page.getByTestId('wide-trial')).toBeVisible();
  await expect(page.locator('.mission-transmission')).toBeHidden();
  const layout=await page.evaluate(()=>{
    const box=(selector:string)=>document.querySelector(selector)!.getBoundingClientRect();
    const overlaps=(a:DOMRect,b:DOMRect)=>
      a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
    const mission=box('.mission-transmission'),header=box('[data-testid="wide-viewbar"]'),
      exit=box('[data-testid="wide-trial-exit"]');
    const controls=box('.wide-trial-controls');
    return {headerOverMission:overlaps(header,mission),
      exitOverMission:overlaps(exit,mission),
      controlsOverMission:overlaps(controls,mission),
      headerUnderGlobal:header.top<box('.game-toolbar').bottom,
      board:box('[data-testid="wide-squad-board"]'),
      viewport:{width:innerWidth,height:innerHeight}};
  });
  expect(layout.headerOverMission).toBe(false);
  expect(layout.exitOverMission).toBe(false);
  expect(layout.controlsOverMission).toBe(false);
  expect(layout.headerUnderGlobal).toBe(false);
  expect(layout.board.width).toBeGreaterThanOrEqual(width-2);
  expect(layout.board.height).toBeGreaterThan(width===390?650:770);
  await expect(page.getByTestId('wide-squad-board').locator('[data-wide-cell]')).toHaveCount(640);
  await expect(page.getByTestId('wide-squad-board').locator('[data-wide-obstacle="true"]'))
   .toHaveCount(228); // 223 actual walls + 5 unchanged stations
  await expect(page.locator('[data-wide-fog-cell="26,4"]'))
   .toHaveAttribute('data-fog-state','unknown');
  await expect(page.getByTestId('wide-sector-select')).toHaveValue('follow');
  await page.getByTestId('wide-sector-select').selectOption('industrial');
  await expect(page.getByTestId('wide-map-caption')).toContainText('CINTURÓN INDUSTRIAL');
  const before=await actualPosition(page);
  await page.getByTestId('wide-squad-board').locator('[data-wide-cell="11,5"]')
   .click({button:'right'});
  await expect(page.getByTestId('wide-move-status'))
   .toContainText('Oficial avanzando hacia 11:5');
  await expect(page.getByTestId('wide-officer-venn')).toHaveAttribute('data-move-phase','moving');
  await expect(page.getByTestId('wide-sector-select')).toHaveValue('follow');
  await expect(page.locator('[data-wide-fog-cell="26,4"]'))
   .toHaveAttribute('data-fog-state','unknown');

  await expect.poll(async()=>{
   const p=await actualPosition(page);
   return Math.hypot(p.x-before.x,p.y-before.y);
  },{timeout:8000}).toBeGreaterThan(.15);
  const mid=await actualPosition(page);
  expect(Math.hypot(mid.x-11,mid.y-5)).toBeGreaterThan(.5);
  const save=await page.evaluate(()=>localStorage.getItem(
   'shadowops.star-adventures.k47-wide-trial.motion.v1'));
  expect(save).toContain('k47-outer-array');
  expect(JSON.parse(save!).topology).toMatch(/^[0-9a-f]{8}$/);
  expect(await page.evaluate(()=>
   localStorage.getItem('shadowops.star-adventures.ground-realtime.v1')))
   .toBe(oldSidecar);
  await page.screenshot({path:'test-results/k47-wide-real-moving-'+width+'.png'});

  await page.reload();
  await expect(page.getByTestId('wide-trial')).toBeVisible();
  await expect(page.getByTestId('wide-squad-board').locator('[data-wide-cell]'))
   .toHaveCount(640);
  const after=await actualPosition(page);
  expect(Math.hypot(after.x-mid.x,after.y-mid.y)).toBeLessThan(.85);
  await expect(page.getByTestId('wide-officer-venn'))
   .toHaveAttribute('data-move-phase','idle',{timeout:19000});
  const arrived=await actualPosition(page);
  expect(arrived.x).toBeCloseTo(11,1);
  expect(arrived.y).toBeCloseTo(5,1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByTestId('wide-select-all').click();
  await expect(page.getByTestId('wide-select-all')).toHaveAttribute('aria-pressed','true');
  // Unlike the original 18x12 portrait cap, the new 32x20 campaign has a
  // wider group-framing allowance: real officer bodies AND nameplates must
  // remain inside the camera after a long solo excursion.
  const framing=await page.getByTestId('wide-squad-board').evaluate(node=>{
   const board=node.getBoundingClientRect();
   return ['venn','dorn','mira'].map(id=>{
    const r=node.querySelector('[data-testid="wide-officer-'+id+'"]')!
      .getBoundingClientRect();
    return {id,inside:r.left>=board.left-6&&r.right<=board.right+6&&
      r.top>=board.top-6&&r.bottom<=board.bottom+6};
   });
  });
  for(const person of framing)expect(person.inside,person.id+' fully framed').toBe(true);
  await expect(page.getByTestId('wide-move-status')).not.toContainText('continúa');
  await page.screenshot({path:'test-results/k47-wide-real-arrived-'+width+'.png'});

  // Keyboard parity on the exact SAME 640-cell map: focus restores the real
  // physical leader position, arrows show a visual cursor, Enter uses BFS.
  await page.getByTestId('wide-select-venn').click();
  const keyboardBoard=page.getByTestId('wide-squad-board');
  await keyboardBoard.focus();
  await keyboardBoard.press('ArrowLeft');
  await expect(page.getByTestId('wide-keyboard-destination')).toBeVisible();
  await keyboardBoard.press('Enter');
  await expect(page.getByTestId('wide-move-status')).toContainText('10:5');
  await expect.poll(async()=>{
   const pos=await actualPosition(page);
   return Math.hypot(pos.x-10,pos.y-5);
  },{timeout:6500}).toBeLessThan(.15);

  // Sector inspector can view a remote (not-yet-explored) place but fog must
  // still hide terrain. It must never manufacture mission events or pickups.
  await page.getByTestId('wide-sector-select').selectOption('remote-lab');
  await expect(page.getByTestId('wide-map-caption')).toContainText('LABORATORIO REMOTO');
  await expect(page.locator('[data-wide-fog-cell="27,13"]'))
   .toHaveAttribute('data-fog-state','unknown');
  await page.screenshot({path:'test-results/k47-wide-real-lab-fog-'+width+'.png'});

  await page.getByTestId('wide-trial-exit').click();
  await expect(page.getByTestId('ground-squad-board')).toBeVisible();
  await expect(page.locator('.mission-transmission')).toBeVisible();
  await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-world-x','4.000');
  expect(await page.evaluate(()=>localStorage.getItem(
   'shadowops.star-adventures.ground-realtime.v1'))).toBe(oldSidecar);
  expect(await page.evaluate(()=>localStorage.getItem(
   'shadowops.star-adventures.k47-wide-trial.active.v1'))).toBeNull();
  await page.reload();
  await expect(page.getByTestId('ground-squad-board')).toBeVisible();
  await expect(page.getByTestId('wide-trial')).toHaveCount(0);
 });
}


test('opening 640-cell trial freezes any ongoing old K-47 real-time route until return',async({page})=>{
 test.setTimeout(110000);
 page.setDefaultTimeout(15000);
 await page.setViewportSize({width:390,height:850});
 await land(page);
 await page.locator('.ground-squad-instructions summary').click();
 await page.getByTestId('ground-realtime-toggle').click();
 await expect(page.getByTestId('ground-realtime-toggle')).toHaveAttribute('aria-pressed','true');
 await page.getByTestId('ground-camera-toggle').click();
 await page.getByTestId('ground-map-sector').selectOption('all');
 await page.getByTestId('ground-squad-board').locator('[data-cell-id="9,4"]')
   .click({button:'right'});
 await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-walk-phase','moving');
 await page.locator('.ground-squad-instructions summary').click();
 await page.getByTestId('wide-trial-enter').click();
 await expect(page.getByTestId('wide-trial')).toBeVisible();
 const sidecar=await page.evaluate(()=>
   localStorage.getItem('shadowops.star-adventures.ground-realtime.v1'));
 expect(sidecar).toBeTruthy();
 const saved=JSON.parse(sidecar!);
 const moving=saved.motion.officers.find((o:{id:string})=>o.id==='venn');
 expect(moving.route.length).toBeGreaterThan(0);
 // Wait longer than the old 240ms checkpoint cadence. No background
 // simulation is allowed to mutate or silently advance the classic mission.
 await page.waitForTimeout(1000);
 expect(await page.evaluate(()=>
   localStorage.getItem('shadowops.star-adventures.ground-realtime.v1'))).toBe(sidecar);
 await page.getByTestId('wide-trial-exit').click();
 await expect(page.getByTestId('ground-squad-board')).toBeVisible();
 await expect(page.getByTestId('ground-realtime-toggle')).toHaveAttribute('aria-pressed','true');
 await expect.poll(async()=>{
   const raw=await page.evaluate(()=>localStorage.getItem(
     'shadowops.star-adventures.ground-realtime.v1'));
   if(!raw)return 0;
   const o=JSON.parse(raw).motion.officers.find((x:{id:string})=>x.id==='venn');
   return Math.hypot(o.x-moving.x,o.y-moving.y);
 },{timeout:7000}).toBeGreaterThan(.2);
});


for(const width of [390,1280]){
 test('K-47 true biomes: real walk from landing through ridge to freight, art never leaks fog '+width,
 async({page})=>{
  test.setTimeout(210000);
  page.setDefaultTimeout(20000);
  await page.setViewportSize({width,height:850});
  await land(page);
  await page.locator('.ground-squad-instructions summary').click();
  await page.getByTestId('wide-trial-enter').click();
  await expect(page.getByTestId('wide-trial')).toBeVisible();

  // The scene contains exactly the real polygons; all visual prefabs are
  // pointer-events none, physically authored and revealed only by LOS travel.
  const board=page.getByTestId('wide-squad-board');
  await expect(board.locator('[data-wide-cell]')).toHaveCount(640);
  await expect(board.locator('[data-wide-obstacle="true"]')).toHaveCount(228);
  await expect(page.getByTestId('wide-terrain-art')).toBeVisible();
  await expect(board.locator('[data-wide-terrain="24,5"]')).toHaveCount(0);
  await expect(board.locator('[data-wide-fog-cell="24,5"]'))
    .toHaveAttribute('data-fog-state','unknown');
  await expect(board.locator('[data-wide-terrain="18,15"]')).toHaveCount(0);

  await page.getByTestId('wide-sector-select').selectOption('north-ridge');
  await expect(page.getByTestId('wide-map-caption')).toContainText('CORDILLERA');
  await expect(board.locator('[data-wide-cell="23,5"]')).toHaveAttribute('data-wide-obstacle','false');
  await board.locator('[data-wide-cell="23,5"]').click({button:'right'});
  await expect(page.getByTestId('wide-officer-venn')).toHaveAttribute('data-move-phase','moving');
  await expect(page.getByTestId('wide-officer-venn')).toHaveAttribute('data-move-phase','idle',
    {timeout:32000});
  const ridge=await actualPosition(page);
  expect(ridge.x).toBeCloseTo(23,1);
  expect(ridge.y).toBeCloseTo(5,1);
  await expect(board.locator('[data-wide-terrain="24,5"]')).toHaveCount(1);
  await expect(board.locator('[data-wide-terrain="24,5"]'))
    .toHaveAttribute('data-wide-art-family','ridge-shale');
  await expect(board.locator('[data-wide-wall-style="rock"]').first()).toBeVisible();
  await expect(board.locator('[data-wide-fog-cell="27,13"]'))
    .toHaveAttribute('data-fog-state','unknown');
  // Walk up to the REAL blocked y=3 ridge: the four opaque cells must
  // become a single continuous rock silhouette only after physical LOS.
  // Pick a neighboring clear ground center, not the pixel rectangle
  // belonging to Venn's tall standing character at 23,5.
  await board.locator('[data-wide-cell="21,4"]').click({button:'right'});
  await expect(page.getByTestId('wide-officer-venn')).toHaveAttribute('data-move-phase','idle',
    {timeout:10000});
  await expect(board.locator('[data-wide-structure="rock-20-3-x"]'))
    .toHaveAttribute('data-wide-structure-cells','20,3;21,3;22,3;23,3');
  await expect(board.locator('[data-wide-wall="21,3"]')).toHaveCount(0,
    {timeout:5000});
  await expect(board.locator('[data-wide-fog-cell="27,13"]'))
    .toHaveAttribute('data-fog-state','unknown');
  await page.screenshot({path:'test-results/k47-wide-authored-ridge-'+width+'.png'});

  await page.getByTestId('wide-sector-select').selectOption('south-yard');
  await expect(page.getByTestId('wide-map-caption')).toContainText('PATIOS DE CARGA');
  await expect(board.locator('[data-wide-cell="18,15"]')).toHaveAttribute('data-wide-obstacle','false');
  await board.locator('[data-wide-cell="18,15"]').click({button:'right'});
  await expect(page.getByTestId('wide-officer-venn')).toHaveAttribute('data-move-phase','moving');
  await expect(page.getByTestId('wide-officer-venn')).toHaveAttribute('data-move-phase','idle',
    {timeout:40000});
  const yard=await actualPosition(page);
  expect(yard.x).toBeCloseTo(18,1);
  expect(yard.y).toBeCloseTo(15,1);
  await expect(board.locator('[data-wide-terrain="18,15"]'))
    .toHaveAttribute('data-wide-art-family','freight-concrete');
  await expect(board.locator('[data-wide-wall-style="freight"]').first()).toBeVisible();
  await expect(board.locator('[data-wide-fog-cell="27,13"]'))
    .toHaveAttribute('data-fog-state','unknown',
      'Only actual exploration, never cosmetic sector selection, reveals the remote lab');
  await board.locator('[data-wide-cell="13,12"]').click({button:'right'});
  await expect(page.getByTestId('wide-officer-venn')).toHaveAttribute('data-move-phase','idle',
    {timeout:24000});
  await expect(board.locator('[data-wide-structure="freight-11-14-x"]'))
    .toHaveAttribute('data-wide-structure-cells','11,14;12,14;13,14;14,14;15,14');
  await expect(board.locator('[data-wide-wall="13,14"]')).toHaveCount(0);
  await expect(board.locator('[data-wide-fog-cell="27,13"]'))
    .toHaveAttribute('data-fog-state','unknown');
  await page.screenshot({path:'test-results/k47-wide-authored-freight-'+width+'.png'});

  // Lab facades are BOTH real 4-cell blocked runs. The old distant
  // reconnaissance must not leak their art, only physical arrival reveals it.
  await expect(board.locator('[data-wide-structure-cells*="25,12;25,13"]')).toHaveCount(0);
  await page.getByTestId('wide-sector-select').selectOption('remote-lab');
  await board.locator('[data-wide-cell="27,13"]').click({button:'right'});
  await expect(page.getByTestId('wide-officer-venn')).toHaveAttribute('data-move-phase','idle',
    {timeout:36000});
  const lab=await actualPosition(page);
  expect(lab.x).toBeCloseTo(27,1);
  expect(lab.y).toBeCloseTo(13,1);
  // The approach can discover the northern y=10 corner first, so require
  // the physical 11..14 segment, without assuming when the corner is revealed.
  await expect(board.locator('[data-wide-structure-cells*="25,11;25,12;25,13;25,14"]'))
    .toHaveCount(1);
  await expect(board.locator('[data-wide-structure-cells*="29,11;29,12;29,13;29,14"]'))
    .toHaveCount(1);
  await page.screenshot({path:'test-results/k47-wide-authored-lab-'+width+'.png'});

  // Same rendered board still picks the canonical cell and never changes old saves.
  await page.getByTestId('wide-trial-exit').click();
  await expect(page.getByTestId('ground-squad-board')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}
