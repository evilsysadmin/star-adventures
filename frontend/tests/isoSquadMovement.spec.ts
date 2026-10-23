import { test, expect, type Page } from '@playwright/test';
import { projectCell } from '../src/tacticalGrid';
import { createIsoCamera } from '../src/tacticalIsoCamera';

async function prepare(page: Page) {
  await page.goto('/');
  await page.getByTestId('tactical-view-iso').click();
  const canvas = page.getByTestId('iso-render-canvas');
  await expect(canvas).toBeVisible();
  return canvas;
}
async function selectOnBoard(page: Page, id: string) {
  const canvas = page.getByTestId('iso-render-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  const [col,row] = id.split(':').map(Number);
  const point = projectCell({col,row,id},createIsoCamera(box.width / box.height),
    {left:box.x,top:box.y,width:box.width,height:box.height});
  await page.mouse.click(point.x,point.y);
  await expect(page.getByTestId('iso-selected')).toContainText(id);
}

for (const width of [390,1280]) {
  test(`officer moves through real traversable cells, cannot cross cover or squad; screenshot at ${width}px`,async ({page})=>{
    test.setTimeout(70_000);
    await page.setViewportSize({width,height:850});
    await prepare(page);
    await expect(page.getByTestId('iso-unit-science')).toContainText('1:1');
    await selectOnBoard(page,'4:1');
    await expect(page.getByTestId('iso-route')).toContainText('Ruta: 3 pasos');
    await expect(page.getByTestId('iso-move')).toBeEnabled();
    await page.getByTestId('iso-move').click();
    await expect(page.getByTestId('iso-motion-status')).toContainText('Recorrido completado',{timeout:10_000});
    await expect(page.getByTestId('iso-unit-science')).toContainText('4:1');
    await page.getByTestId('iso-unit-security').click();
    await selectOnBoard(page,'4:1');
    // A real squad tap now selects the occupied officer, even after it moved.
    await expect(page.getByTestId('iso-unit-science')).toHaveAttribute('aria-pressed','true');
    await expect(page.getByTestId('iso-move')).toBeDisabled();
    await page.getByTestId('iso-unit-security').click();
    await selectOnBoard(page,'3:3');
    await expect(page.getByTestId('iso-route')).toContainText('No hay ruta');
    await expect(page.getByTestId('iso-move')).toBeDisabled();
    await selectOnBoard(page,'6:2');
    await expect(page.getByTestId('iso-move')).toBeDisabled();
    await selectOnBoard(page,'3:5');
    await expect(page.getByTestId('iso-route')).toContainText('Ruta: 1 pasos');
    await page.getByTestId('iso-move').click();
    await expect(page.getByTestId('iso-unit-security')).toContainText('3:5',{timeout:6_000});
    await expect(page.getByTestId('iso-atlas-status')).toContainText('Atlas R2 reales: 2/2',{timeout:20_000});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`test-results/iso-walking-${width}.png`,fullPage:true});
  });
}

test('alternative keyboard/HTML grid drives the same movement path and switching resets the visual POC',async ({page})=>{
  await page.setViewportSize({width:390,height:850});
  await prepare(page);
  await page.getByTestId('iso-keyboard').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('iso-selected')).toContainText('1:0');
  await page.getByTestId('iso-accessible-grid').locator('summary').click();
  await page.getByRole('button',{name:'Casilla 2:1'}).click();
  await expect(page.getByTestId('iso-route')).toContainText('Ruta: 1 pasos');
  await page.getByTestId('iso-move').click();
  await expect(page.getByTestId('iso-unit-science')).toContainText('2:1',{timeout:6_000});
  await page.getByTestId('tactical-view-current').click();
  await expect(page.getByTestId('tactical-selected')).toBeVisible();
  await page.getByTestId('tactical-view-iso').click();
  await expect(page.getByTestId('iso-unit-science')).toContainText('1:1');
  await expect(page.getByTestId('iso-selected')).toContainText('0:0');
});

test('prefers-reduced-motion moves directly but keeps unit and tile truth aligned',async ({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.setViewportSize({width:390,height:850});
  await prepare(page);
  await selectOnBoard(page,'2:1');
  await page.getByTestId('iso-move').click();
  await expect(page.getByTestId('iso-unit-science')).toContainText('2:1');
  await expect(page.getByTestId('iso-motion-status')).toContainText('Recorrido completado');
  await expect(page.getByTestId('iso-move')).toBeDisabled();
  await selectOnBoard(page,'3:1');
  await expect(page.getByTestId('iso-move')).toBeEnabled();
});
