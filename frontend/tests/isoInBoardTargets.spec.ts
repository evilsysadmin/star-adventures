import { test, expect } from '@playwright/test';

for (const width of [360, 390, 1280]) {
 test(`live hostile target buttons stay inside the tactical board and fire only on command at ${width}px`, async ({page}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({width,height:850});
  await page.goto('/');
  await page.getByTestId('tactical-view-missions').click();
  await page.getByTestId('scenario-play-combat').click();
  const shell=page.getByTestId('scenario-keyboard');
  const canvas=page.getByTestId('scenario-render-canvas');
  const targets=page.getByTestId('scenario-hostile-status');
  const aegis=page.getByTestId('scenario-hostile-aegis');
  const veil=page.getByTestId('scenario-hostile-veil');
  await expect(targets).toBeVisible();
  await expect(shell.locator('[data-testid="scenario-hostile-status"]')).toHaveCount(1);
  await expect(page.locator('.scenario-cell-bar [data-testid="scenario-hostile-status"]')).toHaveCount(0);
  for (const contact of [aegis,veil]) {
   const chip=await contact.boundingBox(),board=await shell.boundingBox();
   expect(chip).not.toBeNull();expect(board).not.toBeNull();
   expect(chip!.height).toBeGreaterThanOrEqual(44);
   expect(chip!.x).toBeGreaterThanOrEqual(board!.x-1);
   expect(chip!.x+chip!.width).toBeLessThanOrEqual(board!.x+board!.width+1);
   expect(chip!.y).toBeGreaterThanOrEqual(board!.y-1);
   expect(chip!.y+chip!.height).toBeLessThan(board!.y+board!.height/3);
  }
  await page.getByTestId('scenario-unit-security').click();
  const ap=await page.getByTestId('scenario-ap').innerText();
  await aegis.click();
  await expect(aegis).toHaveAttribute('aria-pressed','true');
  await expect(canvas).toHaveAttribute('data-aim-state','terrain-blocked');
  await expect(page.getByTestId('scenario-fire')).toBeDisabled();
  await expect(page.getByTestId('scenario-ap')).toHaveText(ap);
  await expect(canvas).not.toHaveAttribute('data-shot-sequence',/./);
  await shell.screenshot({path:`test-results/board-targets-blocked-${width}.png`});
  const grid=page.getByTestId('scenario-accessible-grid');
  await grid.locator('summary').click();
  for (const cell of ['3:7','5:6']) {
   await page.getByRole('button',{name:'Casilla '+cell,exact:true}).click();
   await page.getByTestId('scenario-move').click();
  }
  await expect(canvas).toHaveAttribute('data-squad-moving','0',{timeout:10000});
  await aegis.click();
  await expect(canvas).toHaveAttribute('data-aim-state','ready');
  await expect(page.getByTestId('scenario-fire')).toBeEnabled();
  await expect(aegis).toContainText('PV 2/2');
  await shell.screenshot({path:`test-results/board-targets-ready-${width}.png`});
  await page.getByTestId('scenario-fire').click();
  await expect(aegis).toContainText('PV 1/2');
  await expect(canvas).toHaveAttribute('data-shot-sequence','1');
  await expect(canvas).toHaveAttribute('data-shot-phase','impact',{timeout:1500});
  await shell.screenshot({path:`test-results/board-targets-impact-${width}.png`});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}
