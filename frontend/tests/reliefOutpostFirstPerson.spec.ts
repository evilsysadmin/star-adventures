import { expect, test } from '@playwright/test';

// The first-person surface must feel like a place, not a flat teal test room.
// Reach it through the real transporter; capture the actual Canvas2D pixels
// at both sizes and verify walking changes the rendered scene.
for (const width of [390, 1280]) {
  test(`relief outpost has grounded scenery and real navigable landmarks at ${width}px`, async ({ page }) => {
    test.setTimeout(70_000);
    await page.setViewportSize({ width, height: 850 });
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('shadowops.star-adventures.tactical-view.v1'));
    await page.reload();
    await expect(page.getByTestId('explore-area')).toContainText('Puente de mando');

    // Physical bridge route to transporter (3:5 N -> 4:5 E -> 4:5 S).
    await page.getByTestId('explore-right').click();
    await page.getByTestId('explore-forward').click();
    await page.getByTestId('explore-right').click();
    await page.getByTestId('explore-use').click();
    await page.getByTestId('transport-confirm').click();
    await expect(page.getByTestId('explore-area')).toContainText('Superficie planetaria');
    await expect(page.getByTestId('mission-phase')).toHaveText('MISIÓN EN SUPERFICIE');

    const canvas = page.locator('.firstperson-canvas');
    await expect(canvas).toBeVisible();
    const palette = await canvas.evaluate(element => {
      const context = (element as HTMLCanvasElement).getContext('2d');
      if (!context) return { colors: 0, warm: 0 };
      const pixels = context.getImageData(0, 0, 960, 480).data;
      const colors = new Set<string>();
      let warm = 0;
      for (let y = 75; y < 430; y += 4) {
        for (let x = 80; x < 880; x += 4) {
          const i = (y * 960 + x) * 4;
          const [r, g, b] = [pixels[i], pixels[i + 1], pixels[i + 2]];
          colors.add(`${r >> 4}:${g >> 4}:${b >> 4}`);
          if (r > 75 && r > g + 7 && g > b + 5) warm++;
        }
      }
      return { colors: colors.size, warm };
    });
    expect(palette.colors).toBeGreaterThan(35);
    expect(palette.warm).toBeGreaterThan(15);

    // An outdoor view must expose a real rocky horizon, not full-height
    // room walls. Its silhouette is anchored to heading, not the screen.
    const readSkyline = () => canvas.evaluate(element => {
      const context = (element as HTMLCanvasElement).getContext('2d')!;
      const pixels = context.getImageData(0, 110, 960, 130).data;
      const moonPixel = [...context.getImageData(480, 100, 1, 1).data].slice(0, 3);
      let ridgePixels = 0;
      const silhouette: number[] = [];
      for (let x = 12; x < 948; x += 12) {
        let first = -1;
        for (let y = 0; y < 130; y++) {
          const i = (y * 960 + x) * 4;
          const distant = pixels[i] === 83 && pixels[i + 1] === 101 && pixels[i + 2] === 116;
          const nearby = pixels[i] === 89 && pixels[i + 1] === 98 && pixels[i + 2] === 94;
          if (distant || nearby) {
            ridgePixels++;
            if (first === -1) first = y;
          }
        }
        silhouette.push(first);
      }
      return { ridgePixels, silhouette, moonPixel };
    });
    const northSky = await readSkyline();
    expect(northSky.ridgePixels).toBeGreaterThan(40);
    expect(northSky.moonPixel[0]).toBeGreaterThan(170);
    const spawn = await canvas.screenshot({ path: `test-results/relief-outpost-spawn-${width}.png` });
    await page.getByTestId('explore-right').click();
    const eastSky = await readSkyline();
    expect(eastSky.ridgePixels).toBeGreaterThan(40);
    expect(eastSky.moonPixel[0]).toBeLessThan(150);
    expect(eastSky.silhouette).not.toEqual(northSky.silhouette);
    await canvas.screenshot({ path: `test-results/relief-outpost-east-sky-${width}.png` });
    await page.getByTestId('explore-left').click();
    expect(await readSkyline()).toEqual(northSky);
    await page.getByTestId('explore-forward').click();
    await expect(page.getByTestId('explore-heading')).toContainText('4:4');
    const approach = await canvas.screenshot({ path: `test-results/relief-outpost-approach-${width}.png` });
    expect(approach.equals(spawn)).toBe(false);
    await page.getByTestId('explore-right').click();
    await page.getByTestId('explore-forward').click();
    await expect(page.getByTestId('explore-target')).toContainText('Puesto de socorro');
    await canvas.screenshot({ path: `test-results/relief-outpost-medical-${width}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/relief-outpost-page-${width}.png`, fullPage: true });
  });
}
