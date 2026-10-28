import { test, expect } from '@playwright/test';

for(const width of [390,1280]){
 test(`training walking sprites reflect route direction at ${width}px`,async({page})=>{
  test.setTimeout(65000);
  await page.setViewportSize({width,height:850});
  await page.goto('/');
  await page.getByTestId('tactical-view-iso').click();
  const canvas=page.getByTestId('iso-render-canvas');
  await expect(canvas).toBeVisible();
  await expect(page.getByTestId('iso-atlas-status')).toContainText('Atlas R2 reales: 4/4',{timeout:20000});
  await page.getByTestId('iso-accessible-grid').locator('summary').click();
  await page.getByRole('button',{name:'Casilla 2:1'}).click();
  await page.getByTestId('iso-move').click();
  await expect(canvas).toHaveAttribute('data-sprite-facing-science','right');
  await expect(canvas).toHaveAttribute('data-officer-sprite-uv-x',String(1/3));
  await expect(page.getByTestId('iso-motion-status')).toContainText('Recorrido completado',{timeout:8000});
  await page.getByRole('button',{name:'Casilla 1:1'}).click();
  await page.getByTestId('iso-move').click();
  await expect(canvas).toHaveAttribute('data-sprite-facing-science','left');
  await expect(canvas).toHaveAttribute('data-officer-sprite-uv-x',String(-1/3));
  await expect(page.getByTestId('iso-motion-status')).toContainText('Recorrido completado',{timeout:8000});
  await canvas.screenshot({path:`test-results/training-officer-faces-left-${width}.png`});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}

test('enemy patrol reverses the mirrored walk UV on real route corners',async({page})=>{
 await page.setViewportSize({width:390,height:850});
 await page.goto('/');
 await page.getByTestId('tactical-view-iso').click();
 const canvas=page.getByTestId('iso-render-canvas');
 await expect(page.getByTestId('iso-atlas-status')).toContainText('Atlas R2 reales: 4/4',{timeout:20000});
 await page.getByTestId('iso-patrol').click();
 await expect(canvas).toHaveAttribute('data-sprite-facing-aegis','right',{timeout:4000});
 await expect(canvas).toHaveAttribute('data-sprite-facing-aegis','left',{timeout:4000});
 await canvas.screenshot({path:'test-results/training-hostile-faces-left-390.png'});
});
