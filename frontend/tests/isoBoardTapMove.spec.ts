import { test, expect, type Page } from '@playwright/test';
import { projectCell } from '../src/tacticalGrid';
import { createIsoCamera } from '../src/tacticalIsoCamera';

// Use the real projected canvas cell, not the accessible grid or a mocked
// reducer command. This checks the mouse/touch-sized playfield interaction.
async function pick(page: Page, id: string) {
 const canvas = page.getByTestId('scenario-render-canvas');
 await canvas.scrollIntoViewIfNeeded();
 const box = (await canvas.boundingBox())!;
 const [col,row] = id.split(':').map(Number);
 const point = projectCell({id,col,row},createIsoCamera(box.width/box.height,10,3.18),
  {left:box.x,top:box.y,width:box.width,height:box.height},10);
 await page.mouse.click(point.x,point.y);
 await expect(page.getByTestId('scenario-selected')).toHaveText(id);
}

for (const width of [390,1280]) {
 test(`first board tap previews route, second moves, blocked/third taps never spend AP at ${width}px`,async({page})=>{
  test.setTimeout(70_000);
  await page.setViewportSize({width,height:850});
  await page.goto('/');
  await page.getByTestId('tactical-view-missions').click();
  const canvas = page.getByTestId('scenario-render-canvas');
  await expect(canvas).toBeVisible();
  await expect(page.getByTestId('scenario-ap')).toContainText('3 / 3');

  // An occupied cover tile can be selected for information, never moved onto.
  await pick(page,'2:3');
  await pick(page,'2:3');
  await expect(page.getByTestId('scenario-move')).toBeDisabled();
  await expect(page.getByTestId('scenario-ap')).toContainText('3 / 3');
  await expect(page.getByTestId('scenario-unit-science')).toContainText('1:1');

  await pick(page,'2:1');
  await expect(page.getByTestId('scenario-route')).toContainText('Ruta: 1 casillas');
  await expect(page.getByTestId('scenario-ap')).toContainText('3 / 3');
  await canvas.screenshot({path:`test-results/board-tap-move-preview-${width}.png`});
  await pick(page,'2:1');
  await expect(page.getByTestId('scenario-unit-science')).toContainText('2:1');
  await expect(page.getByTestId('scenario-ap')).toContainText('2 / 3');
  await expect(canvas).toHaveAttribute('data-squad-moving','0',{timeout:5000});
  await canvas.screenshot({path:`test-results/board-tap-move-arrived-${width}.png`});

  // Third tap at the new occupied location cannot repeat the move.
  await pick(page,'2:1');
  await expect(page.getByTestId('scenario-ap')).toContainText('2 / 3');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}

test('double-tap move also uses real combat replay rules without firing',async({page})=>{
 await page.setViewportSize({width:390,height:850});
 await page.goto('/');
 await page.getByTestId('tactical-view-missions').click();
 await page.getByTestId('scenario-play-combat').click();
 const canvas = page.getByTestId('scenario-render-canvas');
 await expect(page.getByTestId('scenario-fire-guide')).toContainText('casilla libre');
 await pick(page,'2:1');
 await expect(page.getByTestId('scenario-ap')).toContainText('3 / 3');
 await pick(page,'2:1');
 await expect(page.getByTestId('scenario-unit-science')).toContainText('2:1');
 await expect(page.getByTestId('scenario-ap')).toContainText('2 / 3');
 await expect(canvas).not.toHaveAttribute('data-shot-sequence',/./);
 await canvas.screenshot({path:'test-results/board-tap-move-combat-390.png'});
});

test('real touch: first tap aims at destination, second moves without scrolling to orders',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:850},isMobile:true,hasTouch:true});
 const page=await context.newPage();
 try{
  await page.goto('/');
  await page.getByTestId('tactical-view-missions').tap();
  const canvas=page.getByTestId('scenario-render-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box=(await canvas.boundingBox())!;
  const point=projectCell({id:'2:1',col:2,row:1},
   createIsoCamera(box.width/box.height,10,3.18),
   {left:box.x,top:box.y,width:box.width,height:box.height},10);
  await page.touchscreen.tap(point.x,point.y);
  await expect(page.getByTestId('scenario-selected')).toHaveText('2:1');
  await expect(page.getByTestId('scenario-ap')).toContainText('3 / 3');
  await page.touchscreen.tap(point.x,point.y);
  await expect(page.getByTestId('scenario-unit-science')).toContainText('2:1');
  await expect(page.getByTestId('scenario-ap')).toContainText('2 / 3');
  await expect(canvas).toHaveAttribute('data-squad-moving','0',{timeout:5000});
  await canvas.screenshot({path:'test-results/board-touch-move-390.png'});
 } finally{await context.close();}
});


for (const width of [390,1280]) {
 test(`crew can be selected beside the tactical board before movement at ${width}px`, async ({page}) => {
  await page.setViewportSize({width,height:850});
  await page.goto('/');
  await page.getByTestId('tactical-view-missions').click();
  const crew=page.getByTestId('scenario-unit-security');
  const canvas=page.getByTestId('scenario-render-canvas');
  await crew.click();
  await expect(crew).toHaveAttribute('aria-pressed','true');
  const location=(await crew.locator('small').first().textContent())?.trim();
  expect(location).toBeTruthy();
  await expect(page.getByTestId('scenario-selected')).toHaveText(location!);
  const layout=await page.evaluate(()=>{
   const roster=document.querySelector('.scenario-roster')?.getBoundingClientRect();
   const board=document.querySelector('.scenario-board-shell')?.getBoundingClientRect();
   return {rosterBottom:roster?.bottom??Infinity,boardTop:board?.top??-Infinity};
  });
  expect(layout.rosterBottom).toBeLessThanOrEqual(layout.boardTop+1);
  await page.getByTestId('scenario-unit-science').click();
  await pick(page,'2:1');
  await pick(page,'2:1');
  await expect(page.getByTestId('scenario-unit-science')).toContainText('2:1');
  await expect(page.getByTestId('scenario-ap')).toContainText('2 / 3');
  await expect(canvas).toHaveAttribute('data-squad-moving','0',{timeout:5000});
  await page.screenshot({path:`test-results/crew-before-board-${width}.png`,fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}
