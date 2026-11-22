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
