import { expect, test } from '@playwright/test';

// Inspect the actual Canvas2D viewport, not a mock SVG or a synthetic fixture.
// The panels belong to the navigable bridge cells and must remain readable
// when the captain moves. The surface renderer is deliberately unchanged.
for (const width of [390, 1280]) {
  test(`bridge architecture stays visible and responds to walking at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 850 : 820 });
    await page.goto('/');
    // A first-time player starts in the real rescue mission, not the lab.
    await page.evaluate(() => localStorage.removeItem('shadowops.star-adventures.tactical-view.v1'));
    await page.reload();
    await expect(page.getByTestId('mission-phase')).toHaveText('TRANSMISIÓN ENTRANTE');
    const canvas = page.locator('.firstperson-canvas');
    await expect(canvas).toBeVisible();
    const palette = await canvas.evaluate(element => {
      const ctx = (element as HTMLCanvasElement).getContext('2d');
      if (!ctx) return { colors: 0, brass: 0 };
      const pixels = ctx.getImageData(0, 0, 960, 480).data;
      const colors = new Set<string>();
      let brass = 0;
      for (let y = 72; y < 428; y += 4) {
        for (let x = 96; x < 864; x += 4) {
          const index = (y * 960 + x) * 4;
          const r = pixels[index], g = pixels[index + 1], b = pixels[index + 2];
          colors.add(`${r >> 4}:${g >> 4}:${b >> 4}`);
          if (r > 100 && r > g + 10 && g > b + 10) brass++;
        }
      }
      return { colors: colors.size, brass };
    });
    expect(palette.colors).toBeGreaterThan(30);
    expect(palette.brass).toBeGreaterThan(5);
    const before = await canvas.screenshot({ path: `test-results/bridge-architecture-spawn-${width}.png` });
    await page.getByTestId('explore-forward').click();
    await expect(page.getByTestId('explore-heading')).toContainText('3:4');
    const after = await canvas.screenshot({ path: `test-results/bridge-architecture-near-helm-${width}.png` });
    expect(after.equals(before)).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/bridge-architecture-page-${width}.png`, fullPage: true });
  });
}
