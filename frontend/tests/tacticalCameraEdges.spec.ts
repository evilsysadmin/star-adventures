import { test, expect } from '@playwright/test';

declare global {
  interface Window {
    __shadowopsTacticalProbe?: {
      projectCell(col: number, row: number): { clientX: number; clientY: number };
    };
  }
}

test('near-edge raycast selection stays inside the intended tile on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 850 });
  await page.goto('/?tactical=probe');
  await expect(page.getByTestId('tactical-canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => !!window.__shadowopsTacticalProbe)).toBe(true);

  // Orthographic projection is affine: 48% of the way to a neighbor is still
  // inside the original tile, close to the shared edge (never exactly on it).
  for (const [col, row, nextCol, nextRow] of [
    [0, 0, 1, 0], [7, 7, 6, 7], [3, 3, 4, 3], [4, 3, 4, 4],
  ]) {
    const target = await page.evaluate(([c, r, nc, nr]) => {
      const probe = window.__shadowopsTacticalProbe!;
      const from = probe.projectCell(c, r);
      const toward = probe.projectCell(nc, nr);
      return {
        x: from.clientX + (toward.clientX - from.clientX) * 0.48,
        y: from.clientY + (toward.clientY - from.clientY) * 0.48,
      };
    }, [col, row, nextCol, nextRow]);
    await page.mouse.click(target.x, target.y);
    await expect(page.getByTestId('tactical-selected')).toHaveText(`${col}:${row}`);
  }
});
