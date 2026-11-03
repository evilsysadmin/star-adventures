import { test, expect } from '@playwright/test';
import { createIsoCamera } from '../src/tacticalIsoCamera';
import { projectCell } from '../src/tacticalGrid';

for (const width of [390, 1280]) {
 test(`planetary outpost remains selectable and playable at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 850 });
  await page.goto('/');
  await page.getByTestId('tactical-view-missions').click();
  await expect(page.getByTestId('scenario-name')).toHaveText('Puesto de frontera');
  await expect(page.getByTestId('scenario-tab-relay')).toHaveCount(0);
  await expect(page.getByTestId('scenario-tab-derelict')).toHaveCount(0);
  await expect(page.getByTestId('scenario-tab-evacuation')).toHaveCount(0);
  const canvas = page.getByTestId('scenario-render-canvas');
  await expect(canvas).toHaveAttribute('data-tactical-ready', 'true');
  await canvas.scrollIntoViewIfNeeded();
  const bounds = (await canvas.boundingBox())!;
  const camera = createIsoCamera(bounds.width / bounds.height, 12, 3.18);
  for (const [id, walkable] of [['5:3', false], ['2:3', false], ['1:2', true]] as const) {
   const [col, row] = id.split(':').map(Number);
   const point = projectCell({ id, col, row }, camera,
    { left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height }, 12);
   await page.mouse.click(point.x, point.y);
   await expect(page.getByTestId('scenario-selected')).toHaveText(id);
   if (walkable) await expect(page.getByTestId('scenario-move')).toBeEnabled();
   else await expect(page.getByTestId('scenario-move')).toBeDisabled();
  }
  await page.getByTestId('scenario-move').click();
  await expect(page.getByTestId('scenario-unit-science')).toContainText('1:2');
  await expect(canvas).toHaveAttribute('data-squad-moving', '0', { timeout: 7000 });
  await canvas.screenshot({ path: `test-results/frontier-outpost-${width}.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.reload();
  await page.getByTestId('tactical-view-missions').click();
  await expect(page.getByTestId('scenario-name')).toHaveText('Puesto de frontera');
  await expect(page.getByTestId('scenario-unit-science')).toContainText('1:2');
 });
}
