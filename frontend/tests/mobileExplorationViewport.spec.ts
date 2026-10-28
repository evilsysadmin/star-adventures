import { expect, test } from '@playwright/test';

// The real 960x480 first-person renderer must gain physical presence on
// phones without stretching objects, clipping controls or breaking transport.
for (const width of [360, 390, 430, 1280]) {
  test(`first-person bridge and surface remain legible at ${width}px`, async ({ page }) => {
    test.setTimeout(70_000);
    await page.setViewportSize({ width, height: 850 });
    await page.goto('/');
    await expect(page.getByTestId('explore-area')).toContainText('Puente de mando');

    const canvas = page.locator('.firstperson-canvas');
    const hud = page.locator('.firstperson-hud');
    const geometry = async () => {
      const box = await canvas.boundingBox();
      const hudBox = await hud.boundingBox();
      const css = await canvas.evaluate(element => {
        const style = getComputedStyle(element);
        const source = element as HTMLCanvasElement;
        return { objectFit: style.objectFit, sourceWidth: source.width, sourceHeight: source.height };
      });
      if (!box || !hudBox) throw new Error('Exploration scene is not visible');
      return { box, hudBox, css };
    };

    const bridge = await geometry();
    expect(bridge.css.sourceWidth).toBe(960);
    expect(bridge.css.sourceHeight).toBe(480);
    if (width <= 600) {
      expect(bridge.css.objectFit).toBe('cover');
      expect(bridge.box.height).toBeGreaterThanOrEqual(250);
      expect(bridge.box.height / bridge.box.width).toBeGreaterThan(0.65);
      // Accessible HTML readouts cover the now-cropped canvas corner text.
      expect(bridge.hudBox.y).toBeLessThan(bridge.box.y + bridge.box.height);
    } else {
      expect(bridge.box.height / bridge.box.width).toBeCloseTo(0.5, 1);
      expect(bridge.hudBox.y).toBeGreaterThanOrEqual(bridge.box.y + bridge.box.height - 1);
    }
    await canvas.screenshot({ path: `test-results/mobile-explore-bridge-${width}.png` });

    // Travel through the real bridge transporter; no fake scene swap.
    await page.getByTestId('explore-right').click();
    await page.getByTestId('explore-forward').click();
    await page.getByTestId('explore-right').click();
    await page.getByTestId('explore-use').click();
    await page.getByTestId('transport-confirm').click();
    await expect(page.getByTestId('explore-area')).toContainText('Superficie planetaria');
    const surface = await geometry();
    expect(surface.box.height).toBeCloseTo(bridge.box.height, 0);
    await canvas.screenshot({ path: `test-results/mobile-explore-surface-${width}.png` });
    await expect(page.getByTestId('explore-forward')).toBeVisible();
    await expect(page.getByTestId('explore-use')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 390 || width === 1280) {
      await page.screenshot({ path: `test-results/mobile-explore-page-${width}.png`, fullPage: true });
    }
  });
}
