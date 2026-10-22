import { test, expect, type Page } from '@playwright/test';
import { cells, projectCell, type Cell } from '../src/tacticalGrid';
import { createIsoCamera } from '../src/tacticalIsoCamera';

async function openIso(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('tactical-selected')).toBeVisible();
  await page.getByTestId('tactical-view-iso').click();
  await expect(page.getByTestId('iso-lab')).toBeVisible();
  const canvas = page.getByTestId('iso-render-canvas');
  await expect(canvas).toBeVisible();
  return canvas;
}

for (const width of [360, 390, 430, 1280]) {
  test(`real isometric pointer raycast matches 64/64 tiles at ${width}px; capture screenshot`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width, height: 850 });
    const canvas = await openIso(page);
    await canvas.scrollIntoViewIfNeeded();
    const rect = await canvas.boundingBox();
    expect(rect).not.toBeNull();
    const bounds = rect!;
    const camera = createIsoCamera(bounds.width / bounds.height);
    for (const cell of cells()) {
      const projected = projectCell(cell, camera, bounds);
      await page.mouse.click(projected.x, projected.y);
      await expect(page.getByTestId('iso-selected')).toContainText(cell.id);
    }
    await expect(page.getByTestId('iso-atlas-status')).toContainText('Atlas R2 reales:', { timeout: 20_000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/iso-tactical-${width}.png`, fullPage: true });
  });
}

test('keyboard grid, drag rejection, accessibility and switching back preserve canonical baseline', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 850 });
  const canvas = await openIso(page);
  await page.getByTestId('iso-keyboard').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('iso-selected')).toContainText('1:0');
  await page.keyboard.press('ArrowDown');
  await expect(page.getByTestId('iso-selected')).toContainText('1:1');
  await page.getByTestId('iso-accessible-grid').locator('summary').click();
  await page.getByRole('button', { name: 'Casilla 6:2' }).click();
  await expect(page.getByTestId('iso-selected')).toContainText('6:2');
  await canvas.scrollIntoViewIfNeeded();
  const rect = (await canvas.boundingBox())!;
  const camera = createIsoCamera(rect.width / rect.height);
  const origin = projectCell({ col:1,row:2,id:'1:2' }, camera, rect);
  const to = projectCell({ col:4,row:6,id:'4:6' }, camera, rect);
  await page.mouse.move(origin.x, origin.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByTestId('iso-selected')).toContainText('6:2');
  await page.getByTestId('iso-motion').click();
  await expect(page.getByTestId('iso-motion')).toContainText('Reproducir caminata');
  await page.getByTestId('tactical-view-current').click();
  await expect(page.getByTestId('iso-lab')).toHaveCount(0);
  await expect(page.getByTestId('tactical-selected')).toBeVisible();
  await page.getByTestId('tactical-view-iso').click();
  await expect(page.getByTestId('iso-selected')).toContainText('0:0');
});

test('real touch selection works at 390px without relying on sprite hitbox', async ({ browser }) => {
  const context = await browser.newContext({ viewport:{width:390,height:850},hasTouch:true,isMobile:true });
  const page = await context.newPage();
  try {
    const canvas = await openIso(page);
    await canvas.scrollIntoViewIfNeeded();
    const rect = (await canvas.boundingBox())!;
    const camera = createIsoCamera(rect.width / rect.height);
    for (const cell of [{col:0,row:0,id:'0:0'},{col:1,row:1,id:'1:1'}, {col:6,row:5,id:'6:5'}, {col:7,row:7,id:'7:7'}] as Cell[]) {
      const point = projectCell(cell,camera,rect);
      await page.touchscreen.tap(point.x,point.y);
      await expect(page.getByTestId('iso-selected')).toContainText(cell.id);
    }
  } finally {
    await context.close();
  }
});
