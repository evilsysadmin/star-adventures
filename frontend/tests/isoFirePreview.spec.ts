import { test, expect, type Page } from '@playwright/test';
import { createIsoCamera } from '../src/tacticalIsoCamera';
import { projectCell } from '../src/tacticalGrid';

async function choose(page:Page,id:string) {
  const canvas=page.getByTestId('iso-render-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const b=(await canvas.boundingBox())!;
  const [col,row]=id.split(':').map(Number);
  const p=projectCell({id,col,row},createIsoCamera(b.width/b.height),
    {left:b.x,top:b.y,width:b.width,height:b.height});
  await page.mouse.click(p.x,p.y);
  await expect(page.getByTestId('iso-selected')).toContainText(id);
}
async function openLab(page:Page,width=390){
  await page.setViewportSize({width,height:850});
  await page.goto('/');
  await page.getByTestId('tactical-view-iso').click();
  await expect(page.getByTestId('iso-render-canvas')).toBeVisible();
  await expect(page.getByTestId('iso-atlas-status')).toContainText('Atlas R2 reales: 4/4',{timeout:20_000});
}
test('only clear sightlines play the verified female R2 cycle once, leaving no fake damage',async({page})=>{
  test.setTimeout(75_000);
  await openLab(page);
  await expect(page.getByTestId('iso-fire')).toBeDisabled();
  await choose(page,'6:5');
  await expect(page.getByTestId('iso-aim-status')).toContainText('Tiro bloqueado por cobertura');
  await expect(page.getByTestId('iso-fire')).toBeDisabled();
  await choose(page,'6:2');
  await expect(page.getByTestId('iso-fire')).toBeEnabled();
  const observed=page.waitForResponse(r=>r.url().includes('officer-female-fire-v1-')
    &&r.request().resourceType()==='image',{timeout:25_000});
  await page.getByTestId('iso-fire').click();
  const response=await observed;
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']?.split(';')[0].trim()).toBe('image/webp');
  await expect(page.getByTestId('iso-fire-report')).toContainText('Ensayo visual completado',{timeout:12_000});
  await expect(page.getByTestId('iso-fire-report')).toContainText('Sin impactos, daños ni consumo de munición');
  await expect(page.getByTestId('iso-fire')).toBeEnabled();
  await expect(page.getByTestId('iso-unit-science')).toContainText('1:1');
  await page.screenshot({path:'test-results/iso-female-fire-390.png',fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('a second gender uses its own authentic fire atlas and returns to rest at desktop width',async({page})=>{
 test.setTimeout(75_000);
 await openLab(page,1280);
 await page.getByTestId('iso-unit-security').click();
 await choose(page,'6:5');
 await expect(page.getByTestId('iso-aim-status')).toContainText('línea despejada');
 const observed=page.waitForResponse(r=>r.url().includes('officer-male-fire-v1-')
   &&r.request().resourceType()==='image',{timeout:25_000});
 await page.getByTestId('iso-fire').click();
 expect((await observed).status()).toBe(200);
 await expect(page.getByTestId('iso-fire-report')).toContainText('Ensayo visual completado',{timeout:12_000});
 await expect(page.getByTestId('iso-unit-security')).toContainText('2:5');
 await expect(page.getByTestId('iso-fire')).toBeEnabled();
 await page.screenshot({path:'test-results/iso-male-fire-1280.png',fullPage:true});
});

test('R2 failure cannot award a simulated shot, even with a valid target',async({page})=>{
 test.setTimeout(75_000);
 await page.route('**/star-adventures/tactical/*-fire-v1-*.webp',route=>route.fulfill({
   status:503,headers:{'Content-Type':'text/plain','Access-Control-Allow-Origin':'*'},body:'simulated atlas outage'
 }));
 await openLab(page);
 await choose(page,'6:2');
 await page.getByTestId('iso-fire').click();
 await expect(page.getByTestId('iso-fire-report')).toContainText('No se pudo cargar',{timeout:12_000});
 await expect(page.getByTestId('iso-fire-report')).toContainText('no se ha simulado ningún tiro');
 await expect(page.getByTestId('iso-fire')).toBeEnabled();
});

test('reduced-motion mode can complete a legal fire preview without looping frames',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await openLab(page);
 await choose(page,'6:2');
 await page.getByTestId('iso-fire').click();
 await expect(page.getByTestId('iso-fire-report')).toContainText('Ensayo visual completado',{timeout:12_000});
 await expect(page.getByTestId('iso-unit-science')).toContainText('1:1');
 await page.getByTestId('tactical-view-current').click();
 await expect(page.getByTestId('tactical-selected')).toBeVisible();
});
