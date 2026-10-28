import {test,expect} from '@playwright/test';

// Players should face one tactical game, never four equally prominent
// implementations. Earlier simulator state remains accessible, not deleted.
for(const width of [390,1280]){
 test(`single tactical game, optional QA variants at ${width}px`,async({page})=>{
  test.setTimeout(70000);
  await page.setViewportSize({width,height:850});
  await page.goto('/');
  await page.getByTestId('tactical-view-missions').click();
  await expect(page.getByTestId('scenario-play-combat')).toBeVisible();
  const advanced=page.getByTestId('scenario-mode-advanced');
  await expect(advanced).not.toHaveAttribute('open',/./);
  await expect(page.getByTestId('scenario-replay-toggle')).not.toBeVisible();
  await page.getByTestId('scenario-play-combat').click();
  await expect(page.getByTestId('scenario-primary-mode')).toContainText('Combate táctico');
  await expect(page.getByTestId('scenario-hostile-aegis')).toContainText('PV 2/2');
  await expect(advanced).not.toHaveAttribute('open',/./);
  await expect(page.getByTestId('scenario-hostile-toggle')).not.toBeVisible();
  const grid=page.getByTestId('scenario-accessible-grid');
  await grid.locator('summary').click();
  await page.getByRole('button',{name:'Casilla 2:1'}).click();
  await page.getByTestId('scenario-move').click();
  await expect(page.getByTestId('scenario-unit-science')).toContainText('2:1');
  await advanced.locator('summary').click();
  await page.getByTestId('scenario-training-toggle').click();
  await expect(page.getByTestId('scenario-primary-mode')).toContainText('pruebas');
  await page.getByTestId('scenario-replay-toggle').click();
  await expect(page.getByTestId('scenario-unit-science')).toContainText('2:1');
  await advanced.locator('summary').click();
  await expect(page.getByTestId('scenario-combat-toggle')).not.toBeVisible();
  await page.screenshot({path:`test-results/unified-tactical-game-${width}.png`,fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}
