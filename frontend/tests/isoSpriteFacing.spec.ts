import {test,expect} from '@playwright/test';
for(const width of [390,1280]){
 test(`in-battle walking sprite changes visible atlas handedness at ${width}px`,async({page})=>{
  test.setTimeout(65000);
  await page.setViewportSize({width,height:850});
  await page.goto('/');
  await page.getByTestId('tactical-view-missions').click();
  const canvas=page.getByTestId('scenario-render-canvas');
  await expect(canvas).toBeVisible();
  await page.getByTestId('scenario-accessible-grid').locator('summary').click();
  await page.getByRole('button',{name:'Casilla 2:1'}).click();
  await page.getByTestId('scenario-move').click();
  await expect(canvas).toHaveAttribute('data-sprite-facing-science','right');
  await expect(canvas).toHaveAttribute('data-squad-sprite-uv-x',String(1/3));
  await expect(canvas).toHaveAttribute('data-squad-moving','0',{timeout:15000});
  await page.getByRole('button',{name:'Casilla 1:1'}).click();
  await page.getByTestId('scenario-move').click();
  await expect(canvas).toHaveAttribute('data-sprite-facing-science','left');
  await expect(canvas).toHaveAttribute('data-squad-sprite-uv-x',String(-1/3));
  await canvas.screenshot({path:`test-results/sprite-faces-left-${width}.png`});
  await expect(canvas).toHaveAttribute('data-squad-moving','0',{timeout:15000});
 });
}
