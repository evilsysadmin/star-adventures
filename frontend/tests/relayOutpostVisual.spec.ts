import { test, expect } from '@playwright/test';
import { createIsoCamera } from '../src/tacticalIsoCamera';
import { projectCell } from '../src/tacticalGrid';

for(const width of [390,1280]){
 test(`relay outpost scenery remains selectable and traversable at ${width}px`,async({page})=>{
  test.setTimeout(70_000);
  await page.setViewportSize({width,height:850});
  await page.goto('/');
  await page.getByTestId('tactical-view-missions').click();
  const canvas=page.getByTestId('scenario-render-canvas');
  await expect(canvas).toBeVisible();
  // Desktop gives the tactical battlefield room to breathe. Mobile retains
  // its compact near-square canvas, so controls do not disappear below a giant viewport.
  const viewportHeight = (await canvas.boundingBox())!.height;
  if(width===1280)expect(viewportHeight).toBeGreaterThanOrEqual(720);
  else expect(viewportHeight).toBeLessThanOrEqual(400);
  await canvas.screenshot({path:`test-results/relay-outpost-full-${width}.png`});
  await canvas.scrollIntoViewIfNeeded();
  const box=(await canvas.boundingBox())!;
  for(const id of ['2:3','2:1']){
   const [col,row]=id.split(':').map(Number);
   const point=projectCell({id,col,row},createIsoCamera(box.width/box.height,10),
    {left:box.x,top:box.y,width:box.width,height:box.height},10);
   await page.mouse.click(point.x,point.y);
   await expect(page.getByTestId('scenario-selected')).toHaveText(id);
   await expect(page.getByTestId('scenario-move'))[id==='2:3'?'toBeDisabled':'toBeEnabled']();
  }
  await page.getByTestId('scenario-move').click();
  await expect(page.getByTestId('scenario-unit-science')).toContainText('2:1');
  await expect(canvas).toHaveAttribute('data-squad-moving','0',{timeout:7000});
  await canvas.screenshot({path:`test-results/relay-outpost-after-move-${width}.png`});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}
