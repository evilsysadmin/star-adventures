import { test, expect, type Page } from '@playwright/test';
import { createIsoCamera } from '../src/tacticalIsoCamera';
import { projectCell } from '../src/tacticalGrid';

async function choose(page: Page,id:string) {
  const canvas=page.getByTestId('iso-render-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box=(await canvas.boundingBox())!;
  const [col,row]=id.split(':').map(Number);
  const p=projectCell({col,row,id},createIsoCamera(box.width/box.height),
    {left:box.x,top:box.y,width:box.width,height:box.height});
  await page.mouse.click(p.x,p.y);
  await expect(page.getByTestId('iso-selected')).toContainText(id);
}
async function start(page:Page,width:number) {
  await page.setViewportSize({width,height:850});
  await page.goto('/');
  await page.getByTestId('tactical-view-iso').click();
  await expect(page.getByTestId('iso-render-canvas')).toBeVisible();
  await expect(page.getByTestId('iso-atlas-status')).toContainText('Atlas R2 reales: 2/2',{timeout:20000});
}

for(const width of [390,1280]){
  test(`aiming preview honors real authored clear and blocked rays at ${width}px`,async ({page})=>{
    await start(page,width);
    await expect(page.getByTestId('iso-aim-status')).toContainText('Selecciona uno de los dos blancos');
    await choose(page,'6:2');
    await expect(page.getByTestId('iso-aim-status')).toContainText('línea despejada');
    await expect(page.getByTestId('iso-aim-status')).toContainText('Disparo aún no disponible');
    await page.getByTestId('iso-render-canvas').screenshot({path:`test-results/iso-aim-clear-${width}.png`});
    await choose(page,'6:5');
    await expect(page.getByTestId('iso-aim-status')).toContainText('Tiro bloqueado por cobertura en 3:3');
    await expect(page.getByTestId('iso-move')).toBeDisabled();
    await page.screenshot({path:`test-results/iso-aim-blocked-${width}.png`,fullPage:true});
    await page.getByTestId('iso-unit-security').click();
    await expect(page.getByTestId('iso-aim-status')).toContainText('línea despejada');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}

test('the aim line follows squad moves and refuses a ray through another officer',async ({page})=>{
  await start(page,390);
  await page.getByTestId('iso-unit-security').click();
  await choose(page,'6:5');
  await expect(page.getByTestId('iso-aim-status')).toContainText('línea despejada');
  await page.getByTestId('iso-unit-medic').click();
  await choose(page,'4:5');
  await expect(page.getByTestId('iso-move')).toBeEnabled();
  await page.getByTestId('iso-move').click();
  await expect(page.getByTestId('iso-unit-medic')).toContainText('4:5',{timeout:10000});
  await page.getByTestId('iso-unit-security').click();
  await choose(page,'6:5');
  await expect(page.getByTestId('iso-aim-status')).toContainText('compañero en 4:5');
  await page.screenshot({path:'test-results/iso-aim-ally-390.png',fullPage:true});
  await page.getByTestId('tactical-view-current').click();
  await expect(page.getByTestId('tactical-selected')).toBeVisible();
});
