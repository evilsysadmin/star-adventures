import { test, expect, type Page } from '@playwright/test';
import { projectCell } from '../src/tacticalGrid';
import { createIsoCamera } from '../src/tacticalIsoCamera';

async function selectCell(page: Page, id: string) {
  const canvas=page.getByTestId('iso-render-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box=(await canvas.boundingBox())!;
  const [col,row]=id.split(':').map(Number);
  const p=projectCell({col,row,id},createIsoCamera(box.width/box.height),
    {left:box.x,top:box.y,width:box.width,height:box.height});
  await page.mouse.click(p.x,p.y);
  await expect(page.getByTestId('iso-selected')).toContainText(id);
}

for(const width of [390,1280]){
  test(`only traversing officer animates during actual route at ${width}px`,async ({page})=>{
    test.setTimeout(70_000);
    await page.setViewportSize({width,height:850});
    await page.goto('/');
    await page.getByTestId('tactical-view-iso').click();
    const canvas=page.getByTestId('iso-render-canvas');
    await expect(canvas).toBeVisible();
    await expect(page.getByTestId('iso-atlas-status')).toContainText('Atlas R2 reales: 2/2',{timeout:20000});
    for (const id of ['science','security','medic'])
      await expect(page.getByTestId(`iso-unit-${id}`)).toHaveAttribute('data-clip','idle');
    await selectCell(page,'7:7');
    await expect(page.getByTestId('iso-route')).toContainText('Ruta:');
    await page.getByTestId('iso-move').click();
    await expect(page.getByTestId('iso-unit-science')).toHaveAttribute('data-clip','walk');
    for (const id of ['security','medic'])
      await expect(page.getByTestId(`iso-unit-${id}`)).toHaveAttribute('data-clip','idle');
    await canvas.screenshot({path:`test-results/iso-one-officer-walking-${width}.png`});
    await expect(page.getByTestId('iso-motion-status')).toContainText('Recorrido completado',{timeout:15000});
    await expect(page.getByTestId('iso-unit-science')).toHaveAttribute('data-clip','idle');
    await expect(page.getByTestId('iso-unit-science')).toContainText('7:7');
    await page.screenshot({path:`test-results/iso-idle-squad-${width}.png`,fullPage:true});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}

test('pause pins moving officer to first atlas frame while preserving physical move',async ({page})=>{
  await page.setViewportSize({width:390,height:850});
  await page.goto('/');
  await page.getByTestId('tactical-view-iso').click();
  await page.getByTestId('iso-motion').click();
  await expect(page.getByTestId('iso-motion')).toContainText('Reproducir caminata');
  await selectCell(page,'4:1');
  await page.getByTestId('iso-move').click();
  await expect(page.getByTestId('iso-unit-science')).toHaveAttribute('data-clip','walk');
  await expect(page.getByTestId('iso-unit-security')).toHaveAttribute('data-clip','idle');
  await expect(page.getByTestId('iso-motion-status')).toContainText('Recorrido completado',{timeout:10000});
  await expect(page.getByTestId('iso-unit-science')).toHaveAttribute('data-clip','idle');
  await page.getByTestId('tactical-view-current').click();
  await page.getByTestId('tactical-view-iso').click();
  await expect(page.getByTestId('iso-unit-science')).toHaveAttribute('data-clip','idle');
  await expect(page.getByTestId('iso-unit-science')).toContainText('1:1');
});
