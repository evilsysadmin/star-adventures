import { test, expect } from '@playwright/test';

for(const width of [390,1280]){
 test('playable combat explains real aim blockers and a clear shot at '+width+'px',async({page})=>{
  test.setTimeout(90_000);
  await page.setViewportSize({width,height:850});
  await page.goto('/');
  await page.getByTestId('tactical-view-missions').click();
  await page.getByTestId('scenario-play-combat').click();
  await page.getByTestId('scenario-hostile-veil').click();
  await expect(page.getByTestId('scenario-fire-guide')).toContainText('Fuera de alcance');
  await expect(page.getByTestId('scenario-fire')).toBeDisabled();
  await page.getByTestId('scenario-unit-security').click();
  await page.getByTestId('scenario-hostile-aegis').click();
  await expect(page.getByTestId('scenario-fire-guide')).toContainText('Línea bloqueada por cobertura o muro');
  await expect(page.getByTestId('scenario-fire')).toHaveText('TIRO BLOQUEADO');
  await page.screenshot({path:'test-results/combat-v4-aim-blocked-'+width+'.png',fullPage:true});
  await page.getByTestId('scenario-accessible-grid').locator('summary').click();
  for(const cell of ['3:7','5:6']){
   await page.getByRole('button',{name:'Casilla '+cell,exact:true}).click();
   await expect(page.getByTestId('scenario-move')).toBeEnabled();
   await page.getByTestId('scenario-move').click();
  }
  await page.getByTestId('scenario-hostile-aegis').click();
  await expect(page.getByTestId('scenario-fire-guide')).toContainText('Objetivo a tiro · línea despejada');
  await expect(page.getByTestId('scenario-fire')).toBeEnabled();
  await page.screenshot({path:'test-results/combat-v4-aim-ready-'+width+'.png',fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}
