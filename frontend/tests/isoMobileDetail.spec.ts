import { test, expect, type Page } from '@playwright/test';
import { createIsoCamera } from '../src/tacticalIsoCamera';
import { createIsoDetailCamera } from '../src/tacticalIsoFocus';
import { projectCell } from '../src/tacticalGrid';

async function openLab(page: Page, width: number) {
  await page.setViewportSize({width,height:850});
  await page.goto('/');
  await page.getByTestId('tactical-view-iso').click();
  await expect(page.getByTestId('iso-render-canvas')).toBeVisible();
  await expect(page.getByTestId('iso-camera-mode')).toContainText('Tablero completo');
}
async function selectFromCamera(page:Page,id:string,detail:boolean,focusId:string){
  const canvas=page.getByTestId('iso-render-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box=(await canvas.boundingBox())!;
  const [col,row]=id.split(':').map(Number);
  const [fc,fr]=focusId.split(':').map(Number);
  const camera=detail ? createIsoDetailCamera(box.width/box.height,{col:fc,row:fr}) :
    createIsoCamera(box.width/box.height);
  const p=projectCell({col,row,id},camera,
    {left:box.x,top:box.y,width:box.width,height:box.height});
  expect(p.x).toBeGreaterThan(box.x+1);
  expect(p.x).toBeLessThan(box.x+box.width-1);
  expect(p.y).toBeGreaterThan(box.y+1);
  expect(p.y).toBeLessThan(box.y+box.height-1);
  await page.mouse.click(p.x,p.y);
  await expect(page.getByTestId('iso-selected')).toContainText(id);
}

for(const width of [360,390,430]){
 test(`mobile detail is optical, recenters real selectable tiles, restores 64-cell overview at ${width}px`,async({page})=>{
   await openLab(page,width);
   await selectFromCamera(page,'3:3',false,'0:0');
   await page.getByTestId('iso-focus-toggle').click();
   await expect(page.getByTestId('iso-camera-mode')).toContainText('Detalle ampliado · centro en 3:3');
   const canvas=page.getByTestId('iso-render-canvas');
   const box=(await canvas.boundingBox())!;
   expect(box.height).toBeGreaterThan(385);
   await selectFromCamera(page,'4:3',true,'3:3');
   await expect(page.getByTestId('iso-focus-cell')).toHaveText('4:3');
   await page.getByTestId('iso-step-down').click();
   await expect(page.getByTestId('iso-camera-mode')).toContainText('centro en 4:4');
   await selectFromCamera(page,'4:5',true,'4:4');
   await page.getByTestId('iso-step-left').click();
   await expect(page.getByTestId('iso-focus-cell')).toHaveText('3:5');
   await page.screenshot({path:`test-results/iso-mobile-detail-${width}.png`,fullPage:true});
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   await page.getByTestId('iso-focus-toggle').click();
   await expect(page.getByTestId('iso-camera-mode')).toContainText('Tablero completo');
   await expect(page.getByTestId('iso-touch-stepper')).toHaveCount(0);
   // Full-board picking must remain valid after the lens has been opened/closed.
   for(const id of ['0:0','7:7','6:2','3:3','0:7','7:0']){
     await selectFromCamera(page,id,false,'0:0');
   }
 });
}

test('detail focus survives real viewport resize and accessible grid jump to a distant tile',async({page})=>{
 await openLab(page,390);
 await page.getByTestId('iso-focus-toggle').click();
 await page.getByTestId('iso-accessible-grid').locator('summary').click();
 await page.getByRole('button',{name:'Casilla 7:7'}).click();
 await expect(page.getByTestId('iso-camera-mode')).toContainText('centro en 7:7');
 await selectFromCamera(page,'6:7',true,'7:7');
 await page.setViewportSize({width:430,height:900});
 await expect(page.getByTestId('iso-camera-mode')).toContainText('centro en 6:7');
 await selectFromCamera(page,'6:6',true,'6:7');
 await expect(page.getByTestId('iso-selected')).toContainText('6:6');
 await page.getByTestId('tactical-view-current').click();
 await expect(page.getByTestId('tactical-selected')).toBeVisible();
 await page.getByTestId('tactical-view-iso').click();
 await expect(page.getByTestId('iso-camera-mode')).toContainText('Tablero completo');
});

test('touch detail navigation and canvas picking use actual pointer rectangle',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:850},isMobile:true,hasTouch:true});
 const page=await context.newPage();
 try{
  await openLab(page,390);
  await page.getByTestId('iso-focus-toggle').tap();
  await page.getByTestId('iso-step-right').tap();
  await page.getByTestId('iso-step-down').tap();
  await expect(page.getByTestId('iso-camera-mode')).toContainText('centro en 1:1');
  const canvas=page.getByTestId('iso-render-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box=(await canvas.boundingBox())!;
  const p=projectCell({id:'2:1',col:2,row:1},
    createIsoDetailCamera(box.width/box.height,{col:1,row:1}),
    {left:box.x,top:box.y,width:box.width,height:box.height});
  await page.touchscreen.tap(p.x,p.y);
  await expect(page.getByTestId('iso-selected')).toContainText('2:1');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 } finally{await context.close();}
});
