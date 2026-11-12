import { test, expect } from '@playwright/test';
import { createIsoCamera } from '../src/tacticalIsoCamera';
import { projectCell } from '../src/tacticalGrid';

for (const width of [390,1280]) {
 test(`real officer move shows persistent westward facing without changing tile picking at ${width}px`, async ({page}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({width,height:850});
  await page.goto('/');
  await page.getByTestId('tactical-view-missions').click();
  const canvas=page.getByTestId('scenario-render-canvas');
  await expect(canvas).toBeVisible();
  await expect(canvas).not.toHaveAttribute('data-facing-science',/./);
  await page.getByTestId('scenario-accessible-grid').locator('summary').click();
  await page.getByRole('button',{name:'Casilla 0:1',exact:true}).click();
  await expect(page.getByTestId('scenario-move')).toBeEnabled();
  await page.getByTestId('scenario-move').click();
  await expect(canvas).toHaveAttribute('data-facing-science',String(-Math.PI/2));
  await expect(canvas).toHaveAttribute('data-squad-moving','0',{timeout:5000});
  await expect(page.getByTestId('scenario-unit-science')).toContainText('0:1');
  await canvas.screenshot({path:`test-results/scenario-real-facing-west-${width}.png`});
  // The new world-space facing cue is never a raycast target.
  await canvas.scrollIntoViewIfNeeded();
  const box=(await canvas.boundingBox())!;
  const p=projectCell({id:'0:2',col:0,row:2},createIsoCamera(box.width/box.height,12,3.18),
    {left:box.x,top:box.y,width:box.width,height:box.height},12);
  await page.mouse.click(p.x,p.y);
  await expect(page.getByTestId('scenario-selected')).toHaveText('0:2');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}

test('reduced motion still indicates the true facing after an instantaneous move',async ({page}) => {
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.setViewportSize({width:390,height:850});
 await page.goto('/');
 await page.getByTestId('tactical-view-missions').click();
 const canvas=page.getByTestId('scenario-render-canvas');
 await page.getByTestId('scenario-accessible-grid').locator('summary').click();
 await page.getByRole('button',{name:'Casilla 0:1',exact:true}).click();
 await page.getByTestId('scenario-move').click();
 await expect(canvas).toHaveAttribute('data-facing-science',String(-Math.PI/2));
 await expect(page.getByTestId('scenario-unit-science')).toContainText('0:1');
});
