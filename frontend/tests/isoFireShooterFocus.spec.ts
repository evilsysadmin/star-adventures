import { test, expect, type Page } from '@playwright/test';
import { createIsoCamera } from '../src/tacticalIsoCamera';
import { createIsoDetailCamera } from '../src/tacticalIsoFocus';
import { projectCell } from '../src/tacticalGrid';

async function openLab(page: Page, width: number) {
  await page.setViewportSize({width,height:850});
  await page.goto('/');
  await page.getByTestId('tactical-view-iso').click();
  await expect(page.getByTestId('iso-render-canvas')).toBeVisible();
  await expect(page.getByTestId('iso-atlas-status')).toContainText('Atlas R2 reales: 4/4',{timeout:20_000});
}
async function pick(page: Page, id: string, focus?: {id:string;zoom:number}) {
  const canvas=page.getByTestId('iso-render-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box=(await canvas.boundingBox())!;
  const [col,row]=id.split(':').map(Number);
  const camera=focus ? (()=>{
    const [fc,fr]=focus.id.split(':').map(Number);
    return createIsoDetailCamera(box.width/box.height,{col:fc,row:fr},focus.zoom);
  })() : createIsoCamera(box.width/box.height);
  const p=projectCell({id,col,row},camera,
    {left:box.x,top:box.y,width:box.width,height:box.height});
  expect(p.x).toBeGreaterThan(box.x+1);
  expect(p.x).toBeLessThan(box.x+box.width-1);
  expect(p.y).toBeGreaterThan(box.y+1);
  expect(p.y).toBeLessThan(box.y+box.height-1);
  await page.mouse.click(p.x,p.y);
  await expect(page.getByTestId('iso-selected')).toContainText(id);
}

for(const [width,who,target,shooter] of [
  [390,'science','6:2','1:1'],
  [1280,'security','6:5','2:5'],
] as const) {
  test(`frame 4 focuses on the actual ${who} sprite, not target, at ${width}px`,async ({page})=>{
    test.setTimeout(75_000);
    await openLab(page,width);
    if(who==='security')await page.getByTestId('iso-unit-security').click();
    await pick(page,target);
    await page.getByTestId('iso-focus-toggle').click();
    await expect(page.getByTestId('iso-camera-mode')).toContainText(`centro en ${target}`);
    await page.getByTestId('iso-review-toggle').click();
    await page.getByTestId('iso-fire').click();
    const canvas=page.getByTestId('iso-render-canvas');
    await expect(canvas).toHaveAttribute('data-fire-mode','manual',{timeout:12_000});
    await expect(page.getByTestId('iso-camera-mode')).toContainText(`Detalle del disparo · oficial en ${shooter} · blanco ${target}`);
    for(let i=1;i<=3;i++){
      await page.getByTestId('iso-fire-next').click();
      await expect(canvas).toHaveAttribute('data-fire-frame',String(i));
    }
    await canvas.screenshot({path:`test-results/iso-shooter-focused-real-frame4-${who}-${width}.png`});
    await page.screenshot({path:`test-results/iso-shooter-focus-ui-${who}-${width}.png`,fullPage:true});
    await expect(page.getByTestId('iso-selected')).toContainText(target);
    // The live camera is now centered on the shooter and uses 2x optics;
    // verify real clicks still resolve against the same 8x8 picking plane.
    const nearby=who==='science'?'2:1':'3:5';
    await pick(page,nearby,{id:shooter,zoom:2});
    await page.getByTestId('iso-accessible-grid').locator('summary').click();
    await page.getByRole('button',{name:`Casilla ${target}`}).click();
    await expect(page.getByTestId('iso-camera-mode')).toContainText(`blanco ${target}`);
    for(let i=4;i<=5;i++){
      await page.getByTestId('iso-fire-next').click();
      await expect(canvas).toHaveAttribute('data-fire-frame',String(i));
    }
    await page.getByTestId('iso-fire-next').click();
    await expect(page.getByTestId('iso-fire-report')).toContainText('Ensayo visual completado');
    await expect(page.getByTestId('iso-camera-mode')).toContainText(`Detalle ampliado · centro en ${target}`);
    await expect(page.getByTestId('iso-review-toggle')).toBeEnabled();
    await page.getByTestId('iso-focus-toggle').click();
    await expect(page.getByTestId('iso-camera-mode')).toContainText('Tablero completo');
    await pick(page,'0:0');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}

test('normal 9fps fire keeps detail camera on the target; no forced zoom',async ({page})=>{
  await openLab(page,390);
  await pick(page,'6:2');
  await page.getByTestId('iso-focus-toggle').click();
  await expect(page.getByTestId('iso-camera-mode')).toContainText('centro en 6:2');
  await page.getByTestId('iso-fire').click();
  await expect(page.getByTestId('iso-fire-report')).toContainText('Ensayo visual completado',{timeout:12_000});
  await expect(page.getByTestId('iso-camera-mode')).toContainText('centro en 6:2');
  await expect(page.getByTestId('iso-camera-mode')).not.toContainText('Detalle del disparo');
});

test('touch review focus persists after viewport resize, never changes logical target',async ({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:850},isMobile:true,hasTouch:true});
 const page=await context.newPage();
 try{
   await openLab(page,390);
   await page.getByTestId('iso-accessible-grid').locator('summary').click();
   await page.getByRole('button',{name:'Casilla 6:2'}).click();
   await page.getByTestId('iso-focus-toggle').tap();
   await page.getByTestId('iso-review-toggle').tap();
   await page.getByTestId('iso-fire').tap();
   await expect(page.getByTestId('iso-camera-mode')).toContainText('oficial en 1:1',{timeout:12_000});
   await page.setViewportSize({width:430,height:900});
   const canvas=page.getByTestId('iso-render-canvas');
   await canvas.scrollIntoViewIfNeeded();
   // Re-measure rectangle after scrolling to avoid stale page offsets.
   const updated=(await canvas.boundingBox())!;
   const q=projectCell({id:'2:1',col:2,row:1},
     createIsoDetailCamera(updated.width/updated.height,{col:1,row:1},2),
     {left:updated.x,top:updated.y,width:updated.width,height:updated.height});
   await page.touchscreen.tap(q.x,q.y);
   await expect(page.getByTestId('iso-selected')).toContainText('2:1');
   await page.getByRole('button',{name:'Casilla 6:2'}).click();
   await expect(page.getByTestId('iso-camera-mode')).toContainText('blanco 6:2');
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 } finally { await context.close(); }
});
