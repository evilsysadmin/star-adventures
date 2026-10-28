import { test, expect } from '@playwright/test';

// This is a visual-only training shot: no invented hit/damage or new rules.
// Turn a character left first, then shoot at the right-hand actual target.
// The WebGL atlas must use the target bearing rather than last walking bearing.
for(const width of [390,1280]){
 test(`training shooter turns from leftward walk toward actual target at ${width}px`,async({page})=>{
  test.setTimeout(80000);
  await page.setViewportSize({width,height:850});
  await page.goto('/');
  await page.getByTestId('tactical-view-iso').click();
  const canvas=page.getByTestId('iso-render-canvas');
  await expect(canvas).toBeVisible();
  await expect(page.getByTestId('iso-atlas-status')).toContainText('Atlas R2 reales: 4/4',{timeout:20000});
  await page.getByTestId('iso-accessible-grid').locator('summary').click();
  await page.getByRole('button',{name:'Casilla 0:1'}).click();
  await expect(page.getByTestId('iso-move')).toBeEnabled();
  await page.getByTestId('iso-move').click();
  await expect(canvas).toHaveAttribute('data-sprite-facing-science','left');
  await expect(page.getByTestId('iso-motion-status')).toContainText('Recorrido completado',{timeout:9000});
  await page.getByRole('button',{name:'Casilla 6:2'}).click();
  await expect(page.getByTestId('iso-fire')).toBeEnabled();
  await page.getByTestId('iso-review-toggle').click();
  await page.getByTestId('iso-fire').click();
  await expect(canvas).toHaveAttribute('data-fire-mode','manual',{timeout:20000});
  await expect(canvas).toHaveAttribute('data-sprite-facing-science','right');
  await expect(canvas).toHaveAttribute('data-fire-unit','science');
  await expect(canvas).toHaveAttribute('data-fire-target','6:2');
  await expect(canvas).toHaveAttribute('data-fire-sprite-uv-x',String(1/3));
  await canvas.screenshot({path:`test-results/training-shooter-faces-target-${width}.png`});
  await page.getByTestId('iso-fire-next').click();
  await expect(canvas).toHaveAttribute('data-fire-frame','1');
  await expect(canvas).toHaveAttribute('data-fire-sprite-uv-x',String(1/3));
  for(let frame=2;frame<6;frame++){
   await page.getByTestId('iso-fire-next').click();
   await expect(canvas).toHaveAttribute('data-fire-frame',String(frame));
  }
  await page.getByTestId('iso-fire-next').click();
  await expect(page.getByTestId('iso-fire-report')).toContainText('Ensayo visual completado');
  await expect(page.getByTestId('iso-unit-science')).toContainText('0:1');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}
