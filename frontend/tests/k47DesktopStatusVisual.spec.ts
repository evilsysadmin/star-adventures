import {expect,test,type Page} from '@playwright/test';

test.use({storageState:{cookies:[],origins:[]}});

async function land(page:Page){
 await page.goto('/');
 await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:25000});
 await page.getByTestId('captain-transport').click();
 await page.getByTestId('transport-confirm').click();
 const board=page.getByTestId('ground-squad-board');
 await expect(board).toBeVisible();
 return board;
}

for(const {width,height} of [{width:1280,height:850},{width:1757,height:800}]){
 test('K-47 desktop status stays compact without occluding playable scene '+width,
 async({page})=>{
  test.setTimeout(140000);
  await page.setViewportSize({width,height});
  const board=await land(page);
  const status=page.locator('.firstperson-is-squad .ground-squad-event-strip');
  const toolbar=page.locator('.firstperson-is-squad .ground-squad-toolbar');
  const mission=page.getByTestId('mission-transmission');
  const leader=page.getByTestId('ground-unit-venn');
  const before=await page.evaluate(()=>{
   const rect=(selector:string)=>
     document.querySelector(selector)!.getBoundingClientRect();
   const full=rect('.ground-squad-event-strip');
   const actions=rect('.ground-squad-toolbar');
   const mission=rect('[data-testid="mission-transmission"]');
   const actor=rect('[data-testid="ground-unit-venn"]');
   const hit=(a:DOMRect,b:DOMRect)=>a.left<b.right&&a.right>b.left
     &&a.top<b.bottom&&a.bottom>b.top;
   const selection=document.querySelector('[data-testid="ground-selection-status"]')!;
   const notice=document.querySelector('[data-testid="ground-current-notice"]')!;
   return {x:full.x,y:full.y,width:full.width,height:full.height,
     toolbarRight:actions.right,missionBottom:mission.bottom,
     hitActor:hit(full,actor),noOverflow:document.documentElement.scrollWidth<=innerWidth,
     selectionText:selection.textContent?.trim()||'',
     noticeText:notice.textContent?.trim()||'',
     noticeHeight:notice.getBoundingClientRect().height,
     fullStyle:getComputedStyle(document.querySelector('.ground-squad-event-strip')!).display};
  });
  expect(before.fullStyle).toBe('grid');
  expect(before.width).toBeLessThanOrEqual(555);
  expect(before.width).toBeGreaterThanOrEqual(400);
  expect(before.height).toBeLessThanOrEqual(90);
  expect(before.height).toBeGreaterThanOrEqual(58);
  expect(before.x).toBeGreaterThan(before.toolbarRight+10);
  expect(before.y).toBeGreaterThan(before.missionBottom+8);
  expect(before.hitActor).toBe(false);
  expect(before.noOverflow).toBe(true);
  expect(before.selectionText.length).toBeGreaterThan(4);
  expect(before.noticeText.length).toBeGreaterThan(5);
  expect(before.noticeHeight).toBeGreaterThan(10);
  await expect(status).toBeVisible();
  await expect(toolbar).toBeVisible();
  await expect(mission).toBeVisible();
  await expect(page.getByTestId('ground-select-all')).toBeInViewport();
  await expect(page.getByTestId('ground-move-mode')).toBeInViewport();
  await expect(board.locator('polygon[data-cell-id]')).toHaveCount(216);
  await board.locator('[data-cell-id="5,6"]').click({button:'right'});
  await expect(leader).toHaveAttribute('data-grid-x','5',{timeout:30000});
  await expect(leader).toHaveAttribute('data-grid-y','6');
  await expect(leader).toHaveAttribute('data-walk-phase','idle',{timeout:30000});
  const compact=await status.boundingBox();
  expect(compact!.height).toBeLessThanOrEqual(90);
  expect(compact!.width).toBeLessThanOrEqual(555);
  await page.screenshot({path:'test-results/k47-desktop-compact-command-'+width+'.png'});
  await page.reload();
  await expect(leader).toHaveAttribute('data-grid-y','6');
  await expect(page.getByTestId('ground-selection-status')).toBeVisible();
 });
}

test('K-47 mobile command hit targets reach 44px without HUD overlap',async({page})=>{
 test.setTimeout(100000);
 await page.setViewportSize({width:390,height:850});
 const board=await land(page);
 await expect(page.getByTestId('ground-current-notice')).toBeVisible();
 await expect(page.getByTestId('ground-selection-status')).toBeVisible();
 const status=page.locator('.firstperson-is-squad .ground-squad-event-strip');
 const r=await status.boundingBox();
 expect(r).not.toBeNull();
 expect(r!.width).toBeGreaterThan(350);
 expect(r!.height).toBeLessThanOrEqual(45);
 for(const id of ['ground-select-all','ground-selection-additive','ground-move-mode']){
  const button=page.getByTestId(id);
  await expect(button).toBeVisible();
  const hit=await button.boundingBox();
  expect(hit?.height??0).toBeGreaterThanOrEqual(44);
 }
 await expect(board.locator('polygon[data-cell-id]')).toHaveCount(216);
 await board.locator('[data-cell-id="5,6"]').click({button:'right'});
 await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-y','6',{timeout:30000});
 await page.screenshot({path:'test-results/k47-mobile-touch44-command-390.png'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
