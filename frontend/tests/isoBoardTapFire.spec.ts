import { test, expect, type Page } from '@playwright/test';
import { projectCell } from '../src/tacticalGrid';
import { createIsoCamera } from '../src/tacticalIsoCamera';

async function tapBoardCell(page: Page, cell: string) {
 const canvas = page.getByTestId('scenario-render-canvas');
 await canvas.scrollIntoViewIfNeeded();
 const box = await canvas.boundingBox();
 expect(box).not.toBeNull();
 const [col,row] = cell.split(':').map(Number);
 const point = projectCell({id:cell,col,row},createIsoCamera(box!.width/box!.height,10),
  {left:box!.x,top:box!.y,width:box!.width,height:box!.height},10);
 await page.mouse.click(point.x,point.y);
 await expect(page.getByTestId('scenario-selected')).toHaveText(cell);
}

for(const width of [390,1280]){
 test(`a second real board tap fires one accepted shot at ${width}px, while first tap and contact chip only aim`,async({page})=>{
  test.setTimeout(90_000);
  await page.setViewportSize({width,height:850});
  await page.goto('/');
  await page.getByTestId('tactical-view-missions').click();
  await page.getByTestId('scenario-play-combat').click();
  await expect(page.getByTestId('scenario-fire-guide')).toContainText('Tócalo otra vez');
  const grid = page.getByTestId('scenario-accessible-grid');
  await grid.locator('summary').click();
  await page.getByTestId('scenario-unit-security').click();
  for(const cell of ['3:7','5:6']){
   await page.getByRole('button',{name:'Casilla '+cell,exact:true}).click();
   await expect(page.getByTestId('scenario-move')).toBeEnabled();
   await page.getByTestId('scenario-move').click();
  }
  await expect(page.getByTestId('scenario-unit-security')).toContainText('5:6');
  const canvas=page.getByTestId('scenario-render-canvas');
  await expect(canvas).toHaveAttribute('data-fire-atlases-ready','3',{timeout:25_000});
  // Selecting the enemy must never consume an order or fire a projectile.
  await tapBoardCell(page,'6:6');
  await expect(page.getByTestId('scenario-hostile-aegis')).toHaveAttribute('aria-pressed','true');
  await expect(page.getByTestId('scenario-hostile-aegis')).toContainText('PV 2/2');
  await expect(page.getByTestId('scenario-fire')).toBeEnabled();
  await expect(canvas).not.toHaveAttribute('data-shot-sequence',/./);
  await page.getByTestId('scenario-hostile-aegis').click();
  await expect(page.getByTestId('scenario-hostile-aegis')).toContainText('PV 2/2');
  await expect(canvas).not.toHaveAttribute('data-shot-sequence',/./);
  await canvas.screenshot({path:`test-results/board-tap-aim-${width}.png`});

  // A second tap on that selected enemy is the same real reducer-backed shot
  // as the visible Disparar button; no speculative damage or synthetic event.
  await tapBoardCell(page,'6:6');
  await expect(page.getByTestId('scenario-hostile-aegis')).toContainText('PV 1/2');
  await expect(canvas).toHaveAttribute('data-shot-sequence','1');
  await expect(canvas).toHaveAttribute('data-shot-from','5:6');
  await expect(canvas).toHaveAttribute('data-shot-to','6:6');
  await expect(page.getByTestId('scenario-ap')).toContainText('0 / 3');
  await page.screenshot({path:`test-results/board-tap-shot-${width}.png`,fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}
