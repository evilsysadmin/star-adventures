import {expect,test,type Page} from '@playwright/test';

test.use({storageState:{cookies:[],origins:[]}});

async function land(page:Page){
  await page.goto('/');
  await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:25000});
  await page.getByTestId('captain-transport').click();
  await page.getByTestId('transport-confirm').click();
  const board=page.getByTestId('ground-squad-board');
  await expect(board).toBeVisible();
  await expect(board.locator('[data-cell-id]')).toHaveCount(216);
  return board;
}

async function move(page:Page,cell:string){
  const board=page.getByTestId('ground-squad-board');
  const [tx,ty]=cell.split(',').map(Number);
  const venn=page.getByTestId('ground-unit-venn');
  if(tx>=7){
    const x=Number(await venn.getAttribute('data-grid-x'));
    const y=Number(await venn.getAttribute('data-grid-y'));
    await page.getByTestId('ground-move-mode').click();
    await board.focus();
    for(let p=x;p<tx;p++)await page.keyboard.press('ArrowRight');
    for(let p=x;p>tx;p--)await page.keyboard.press('ArrowLeft');
    for(let p=y;p<ty;p++)await page.keyboard.press('ArrowDown');
    for(let p=y;p>ty;p--)await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
  }else{
    await board.locator('[data-cell-id="'+cell+'"]').click({button:'right'});
  }
  await expect(venn).toHaveAttribute('data-grid-x',String(tx),{timeout:35000});
  await expect(venn).toHaveAttribute('data-grid-y',String(ty),{timeout:35000});
  await expect(venn).toHaveAttribute('data-walk-phase','idle',{timeout:30000});
}

const oldCameraStyle=`
@media(min-width:1100px) and (min-height:700px) {
  .game-shell[data-interface=game][data-location=surface] .firstperson-is-squad
  .ground-squad-viewbar{padding:5px 7px!important;gap:9px!important}
  .game-shell[data-interface=game][data-location=surface] .firstperson-is-squad
  .ground-squad-viewbar>span{
    position:static!important;width:auto!important;height:auto!important;
    margin:0!important;clip-path:none!important;overflow:visible!important;
    white-space:nowrap!important;
  }
}`;

function overlap(a:{x:number;y:number;width:number;height:number},
                 b:{x:number;y:number;width:number;height:number}){
 return a.x<b.x+b.width&&b.x<a.x+a.width&&
        a.y<b.y+b.height&&b.y<a.y+a.height;
}

test('desktop follow retains ARCHIVO plaque below real toolbar without moving its station',async({page})=>{
 test.setTimeout(105000);
 await page.setViewportSize({width:1280,height:850});
 const board=await land(page);
 // Real click-to-walk into the route where the old plaque crossed the
 // camera/bridge top controls. No fabricated fog reveal or altered camera.
 await move(page,'5,6');
 const objective=page.getByTestId('ground-waypoint-label-sensor-vault');
 const station=page.getByTestId('ground-landmark-sensor-vault');
 await expect(station).toBeVisible();
 const label=await objective.boundingBox();
 const toolbar=await page.locator('.game-toolbar').boundingBox();
 const controls=await page.locator('.firstperson-top button').all();
 expect(label).not.toBeNull();
 expect(toolbar).not.toBeNull();
 // Capture the actual scene BEFORE strict overlap assertions, so any
 // failure preserves the offending plaque and control positions.
 await page.screenshot({path:'test-results/k47-archive-map-switch-safe-follow-1280.png'});
 const shift=Number(await objective.getAttribute('data-ribbon-y-shift'));
 expect(shift).toBeGreaterThan(0);
 expect(label!.y).toBeGreaterThan(toolbar!.y+toolbar!.height+8);
 // The .firstperson-top layout box can span noninteractive empty space.
 // Validate actual on-screen buttons, not its rectangular flex footprint.
 for(const control of controls){
  const rect=await control.boundingBox();
  if(rect)expect(overlap(label!,rect),
    'archive plaque overlaps '+(await control.textContent())+
    ': '+JSON.stringify({label,rect})).toBe(false);
 }
 await expect(page.getByTestId('ground-waypoint-leader-sensor-vault')).toHaveCount(1);
 await expect(board.locator('[data-cell-id]')).toHaveCount(216);
 // Examining the actual whole map is not a HUD pin: every landmark returns
 // to its original world-positioned plaque, without vertical offset.
 await page.getByTestId('ground-camera-toggle').click();
 await expect(objective).toHaveAttribute('data-ribbon-y-shift','0.00');
 await expect(objective).toHaveAttribute('transform','translate(54 -38) scale(.78)');
 await page.reload();
 await expect(board.locator('[data-cell-id]')).toHaveCount(216);
 await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-x','5');
 await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-y','6');
});

test('actual 1280px K-47 archive plaque is not covered by compact map switch',async({page})=>{
 test.setTimeout(230000);
 await page.setViewportSize({width:1280,height:850});
 const board=await land(page);
 const bar=page.locator('.firstperson-is-squad .ground-squad-viewbar');
 const archived=page.getByTestId('ground-waypoint-label-sensor-vault');
 const oldRects: Array<{buttonBox:{x:number;y:number;width:number;height:number};
   labelBox:{x:number;y:number;width:number;height:number}}>=[];
 // The real exploration route from the full-sector art acceptance, without
 // fabricated fog reveals, teleports or changes to canonical picking.
 for(const dest of ['1,4','5,6','7,3','7,2','7,1','7,3']){
  await move(page,dest);
  if(await archived.isVisible()){
    const labelBox=await archived.boundingBox();
    const barBox=await bar.boundingBox();
    if(labelBox&&barBox)oldRects.push({buttonBox:barBox,labelBox});
  }
 }
 expect(oldRects.length).toBeGreaterThan(0);
 const current=await bar.boundingBox();
 expect(current).not.toBeNull();
 expect(current!.width).toBeLessThanOrEqual(165);
 await expect(bar).toContainText('VISTA PLANETARIA');
 const old=await page.addStyleTag({content:oldCameraStyle});
 const legacy=await bar.boundingBox();
 expect(legacy).not.toBeNull();
 expect(legacy!.width).toBeGreaterThan(current!.width+100);
 await board.screenshot({path:'test-results/k47-archive-map-switch-before-1280.png'});
 await old.evaluate(node=>node.remove());
 await expect.poll(async()=> (await bar.boundingBox())?.width ?? 999).toBeLessThanOrEqual(165);
 const now=await bar.boundingBox();
 const label=await archived.boundingBox();
 if(label&&now && label.x>=0&&label.x+label.width<=1280 &&
    label.y>=65&&label.y+label.height<=850){
   expect(overlap(now,label)).toBe(false);
 }
 await board.screenshot({path:'test-results/k47-archive-map-switch-after-1280.png'});
 await expect(page.getByTestId('ground-camera-toggle')).toHaveAttribute('aria-pressed','true');
 await page.getByTestId('ground-camera-toggle').click();
 await expect(page.getByTestId('ground-camera-toggle')).toHaveAttribute('aria-pressed','false');
 await page.getByTestId('ground-camera-toggle').click();
 await expect(page.getByTestId('ground-camera-toggle')).toHaveAttribute('aria-pressed','true');
 await page.reload();
 await expect(page.getByTestId('ground-squad-board').locator('[data-cell-id]')).toHaveCount(216);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('desktop 1757px map toggle remains readable and unobtrusive',async({page})=>{
 test.setTimeout(100000);
 await page.setViewportSize({width:1757,height:800});
 const board=await land(page);
 const bar=page.locator('.firstperson-is-squad .ground-squad-viewbar');
 const b=await bar.boundingBox();
 expect(b!.width).toBeLessThanOrEqual(165);
 await expect(page.getByTestId('ground-camera-toggle')).toBeVisible();
 await page.screenshot({path:'test-results/k47-archive-map-switch-1757.png'});
 await expect(board.locator('[data-cell-id]')).toHaveCount(216);
});

test('mobile 390px retains original touch camera and map-sector picker',async({page})=>{
 test.setTimeout(90000);
 await page.setViewportSize({width:390,height:850});
 const board=await land(page);
 const camera=page.getByTestId('ground-camera-toggle');
 await expect(camera).toBeInViewport();
 await camera.click();
 const sector=page.getByTestId('ground-map-sector');
 await expect(sector).toBeVisible();
 await sector.selectOption('west');
 await expect(sector).toHaveValue('west');
 await page.screenshot({path:'test-results/k47-archive-map-switch-mobile-390.png'});
 await expect(board.locator('[data-cell-id]')).toHaveCount(216);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
