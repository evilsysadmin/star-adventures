import { expect, test } from '@playwright/test';

// Exercise the player's bridge, independently of opted-in diagnostic scenes.
test.use({ storageState: { cookies: [], origins: [] } });

for (const width of [360, 390, 430, 1280]) {
  test(`navigable bridge renders, opens its real helm and survives F5 at ${width}px`, async ({ page }) => {
    test.setTimeout(70_000);
    await page.setViewportSize({ width, height: 850 });
    await page.goto('/');
    await expect(page.getByTestId('mission-phase')).toHaveText('TRANSMISIÓN ENTRANTE');
    const canvas = page.getByTestId('bridge-interior');
    await expect(canvas).toHaveAttribute('data-bridge-rendered', 'true');
    await expect(canvas).toHaveAttribute('data-bridge-art-loaded', 'true');
    await expect(canvas).toHaveAttribute('data-bridge-pose', '3:5:N');
    const before = await canvas.screenshot({ path: `test-results/bridge-interior-spawn-${width}.png` });
    await page.getByTestId('explore-forward').click();
    await expect(canvas).toHaveAttribute('data-bridge-pose', '3:4:N');
    const after = await canvas.screenshot({ path: `test-results/bridge-interior-walk-${width}.png` });
    expect(after.equals(before)).toBe(false);
    // Geometry must not supply a remote interaction or new collision rules.
    await page.getByTestId('explore-forward').click();
    await expect(page.getByTestId('explore-heading')).toContainText('3:3');
    await expect(page.getByTestId('explore-target')).toContainText('Consola de navegación');
    await page.getByTestId('explore-use').click();
    await expect(page.getByTestId('console-locked')).toContainText('Esta estación');
    await page.getByTestId('explore-forward').click();
    await expect(page.getByTestId('explore-feedback')).toContainText('Paso bloqueado');
    await expect(canvas).toHaveAttribute('data-bridge-pose', '3:3:N');
    await page.reload();
    await expect(canvas).toHaveAttribute('data-bridge-pose', '3:3:N');
    await expect(page.getByTestId('explore-heading')).toContainText('3:3');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/bridge-interior-page-${width}.png`, fullPage: true });
  });
}

test('WebGL denial leaves a usable first-person bridge and real transporter', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null;
      return original.apply(this, [type, ...args] as Parameters<typeof original>);
    } as typeof original;
  });
  await page.goto('/');
  await expect(page.getByTestId('bridge-interior')).toHaveCount(0);
  await expect(page.locator('.firstperson-canvas')).toBeVisible();
  for (const action of ['right', 'forward', 'right', 'use']) await page.getByTestId(`explore-${action}`).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByTestId('transport-confirm').click();
  await expect(page.getByTestId('explore-area')).toContainText('Superficie');
});

test('a lost WebGL context falls back without resetting the captain position', async ({ page }) => {
  await page.goto('/');
  const canvas = page.getByTestId('bridge-interior');
  await expect(canvas).toHaveAttribute('data-bridge-rendered', 'true');
  await page.getByTestId('explore-left').click();
  await page.getByTestId('explore-forward').click();
  await expect(canvas).toHaveAttribute('data-bridge-pose', '2:5:W');
  await canvas.evaluate(element => {
    const gl = (element as HTMLCanvasElement).getContext('webgl2');
    if (!gl) throw new Error('Missing live WebGL context');
    gl.getExtension('WEBGL_lose_context')!.loseContext();
  });
  await expect(canvas).toHaveCount(0);
  await expect(page.getByTestId('explore-heading')).toContainText('2:5');
  await page.getByTestId('explore-forward').click();
  await expect(page.getByTestId('explore-heading')).toContainText('1:5');
});
