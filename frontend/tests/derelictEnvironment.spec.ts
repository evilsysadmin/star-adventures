import { test, expect } from '@playwright/test';
import { createIsoCamera } from '../src/tacticalIsoCamera';
import { projectCell } from '../src/tacticalGrid';

// P0 scene QA: the larger 12x12 derelict must remain a real navigable map,
// not a decorative diorama with incorrect hit targets or invented cover.
for (const width of [390, 1280]) {
 test(`derelict facility is readable, selectable and traversable at ${width}px`, async ({page}) => {
  test.setTimeout(70_000);
  await page.setViewportSize({width,height:850});
  await page.goto('/');
  await page.getByTestId('tactical-view-missions').click();
  await page.getByTestId('scenario-tab-derelict').click();
  await expect(page.getByTestId('scenario-name')).toHaveText('Instalación abandonada');
  const canvas=page.getByTestId('scenario-render-canvas');
  await expect(canvas).toBeVisible();
  await canvas.screenshot({path:`test-results/derelict-facility-${width}.png`});
  await canvas.scrollIntoViewIfNeeded();
  const bounds=(await canvas.boundingBox())!;
  const camera=createIsoCamera(bounds.width/bounds.height,12,3.18);
  for(const [id,canMove] of [['5:3',false],['3:3',false],['1:2',true]] as const){
   const [col,row]=id.split(':').map(Number);
   const point=projectCell({id,col,row},camera,
    {left:bounds.x,top:bounds.y,width:bounds.width,height:bounds.height},12);
   await page.mouse.click(point.x,point.y);
   await expect(page.getByTestId('scenario-selected')).toHaveText(id);
   if(canMove)await expect(page.getByTestId('scenario-move')).toBeEnabled();
   else await expect(page.getByTestId('scenario-move')).toBeDisabled();
  }
  await page.getByTestId('scenario-move').click();
  await expect(page.getByTestId('scenario-unit-science')).toContainText('1:2');
  await expect(canvas).toHaveAttribute('data-squad-moving','0',{timeout:7000});
  await canvas.screenshot({path:`test-results/derelict-facility-after-move-${width}.png`});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}
