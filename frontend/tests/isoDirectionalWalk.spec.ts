import {test,expect} from '@playwright/test';
for(const width of [390,1280]){
 test(`four walking directions follow real tactical movement at ${width}px`,async({page})=>{
  test.setTimeout(95000);
  await page.setViewportSize({width,height:850});
  await page.goto('/');
  await page.getByTestId('tactical-view-missions').click();
  await page.getByTestId('scenario-play-combat').click();
  const canvas=page.getByTestId('scenario-render-canvas');
  await expect(canvas).toBeVisible();
  await page.getByTestId('scenario-accessible-grid').locator('summary').click();
  for(const [index,cell,direction] of [
   [0,'2:1','east'],[1,'2:2','south'],[2,'1:2','west'],[3,'1:1','north']
  ] as const){
   if(index===3)await page.getByTestId('scenario-end-turn').click();
   await page.getByRole('button',{name:'Casilla '+cell,exact:true}).click();
   await expect(page.getByTestId('scenario-move')).toBeEnabled();
   await page.getByTestId('scenario-move').click();
   await expect(canvas).toHaveAttribute('data-sprite-direction-science',direction);
   await expect(canvas).toHaveAttribute('data-squad-moving','0',{timeout:15000});
   await expect(page.getByTestId('scenario-unit-science')).toContainText(cell);
  }
  // R2 has no 4-view file yet; keep existing V1 until new art is uploaded.
  await expect(canvas).toHaveAttribute('data-squad-walk-atlas','legacy');
  await canvas.screenshot({path:`test-results/four-view-fallback-${width}.png`});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}
