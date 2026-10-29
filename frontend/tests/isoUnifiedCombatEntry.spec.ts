import {test,expect} from '@playwright/test';

// Players should face one tactical game, never four equally prominent
// implementations. Earlier simulator state remains accessible, not deleted.
for(const width of [390,1280]){
 test(`single tactical game, optional QA variants at ${width}px`,async({page})=>{
  test.setTimeout(70000);
  await page.setViewportSize({width,height:850});
  await page.goto('/');
  await page.getByTestId('tactical-view-missions').click();
  // The single entry offers real shooting before any extra Play click.
  await expect(page.getByTestId('scenario-fire')).toBeVisible();
  await expect(page.getByTestId('scenario-fire-order')).toBeVisible();
  await expect(page.getByTestId('scenario-fire-order')).toBeDisabled();
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

for(const width of [390,1280]){
test(`shoot action from the single tactical entry damages and restores a real target at ${width}px`,async({page})=>{
 test.setTimeout(90_000);
 await page.setViewportSize({width,height:850});
 await page.goto('/');
 await page.getByTestId('tactical-view-missions').click();
 await expect(page.getByTestId('scenario-primary-mode')).toContainText('Combate táctico');
 await expect(page.getByTestId('scenario-play-combat')).toContainText('combate activo');
 const fire=page.getByTestId('scenario-fire-order');
 await expect(fire).toBeVisible();
 await expect(fire).toBeDisabled();
 await page.getByTestId('scenario-accessible-grid').locator('summary').click();
 await page.getByTestId('scenario-unit-security').click();
 await page.getByTestId('scenario-hostile-aegis').click();
 await expect(fire).toBeDisabled(); // Terrain blocks this initial line of sight.
 for(const cell of ['3:7','5:6']){
  await page.getByRole('button',{name:'Casilla '+cell,exact:true}).click();
  await page.getByTestId('scenario-move').click();
 }
 await page.getByTestId('scenario-hostile-aegis').click();
 await expect(fire).toBeEnabled();
 await expect(page.getByTestId('scenario-hostile-aegis')).toContainText('PV 2/2');
 await fire.click();
 await expect(page.getByTestId('scenario-hostile-aegis')).toContainText('PV 1/2');
 await expect(page.getByTestId('scenario-ap')).toContainText('0 / 3');
 await fire.scrollIntoViewIfNeeded();
 await page.screenshot({path:`test-results/unified-combat-fire-${width}.png`,fullPage:false});
 await page.reload();
 await page.getByTestId('tactical-view-missions').click();
 await expect(page.getByTestId('scenario-primary-mode')).toContainText('Combate táctico');
 await expect(page.getByTestId('scenario-hostile-aegis')).toContainText('PV 1/2');
 await expect(page.getByTestId('scenario-unit-security')).toContainText('5:6');
 await expect(page.getByTestId('scenario-ap')).toContainText('0 / 3');
 // Revealing the board must not restart the restored firefight or refill AP.
 await page.getByTestId('scenario-play-combat').click();
 await expect(page.getByTestId('scenario-hostile-aegis')).toContainText('PV 1/2');
 await expect(page.getByTestId('scenario-ap')).toContainText('0 / 3');
 await expect(fire).toBeDisabled();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
}
