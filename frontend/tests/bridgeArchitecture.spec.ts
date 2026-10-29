import { expect, test } from '@playwright/test';

// The optional walking layout retains physical station authorization.
// The default seated bridge is exercised in gameShell.spec.ts.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('shadowops.star-adventures.presentation.v1',
    JSON.stringify({version:1,layout:'journal',hints:true,muted:false,volume:.6})));
});

for (const width of [360, 390, 430, 1280]) {
  test(`navigable bridge renders, opens its real helm and survives F5 at ${width}px`, async ({ page }) => {
    test.setTimeout(70_000);
    await page.setViewportSize({ width, height: 850 });
    await page.goto('/');
    await expect(page.getByTestId('mission-phase')).toHaveText('TRANSMISIÓN ENTRANTE');
    const canvas = page.getByTestId('bridge-interior');
    await expect(canvas).toHaveAttribute('data-bridge-rendered', 'true', { timeout: 20_000 });
    await expect(canvas).toHaveAttribute('data-bridge-art-loaded', 'true');
    await expect(canvas).toHaveAttribute('data-bridge-pose', '3:5:N');
    const viewport = await canvas.evaluate(element => {
      const canvas = element as HTMLCanvasElement;
      const bounds = canvas.getBoundingClientRect();
      return { backing: canvas.width / canvas.height, visible: bounds.width / bounds.height,
        pixels: canvas.width * canvas.height };
    });
    expect(Math.abs(viewport.backing - viewport.visible)).toBeLessThan(.01);
    expect(viewport.pixels).toBeLessThanOrEqual(1280 * 720);
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
    await expect(canvas).toHaveAttribute('data-bridge-rendered', 'true', { timeout: 20_000 });
    await expect(canvas).toHaveAttribute('data-bridge-pose', '3:3:N');
    await expect(page.getByTestId('explore-heading')).toContainText('3:3');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/bridge-interior-page-${width}.png`, fullPage: true });
  });
}

test('bridge reprojects after rotation and resize while preserving the real station and position', async ({ page }) => {
  test.setTimeout(70_000);
  await page.setViewportSize({ width: 1280, height: 850 });
  await page.goto('/');
  const canvas = page.getByTestId('bridge-interior');
  await expect(canvas).toHaveAttribute('data-bridge-rendered', 'true', { timeout: 20_000 });
  await expect(canvas).toHaveAttribute('data-bridge-art-loaded', 'true');
  for (const action of ['left', 'forward', 'right', 'forward', 'forward', 'left'])
    await page.getByTestId(`explore-${action}`).click();
  await expect(canvas).toHaveAttribute('data-bridge-pose', '2:3:W');
  await expect(page.getByTestId('explore-target')).toContainText('Estación científica');
  await page.getByTestId('explore-use').click();
  await expect(page.getByTestId('explore-feedback')).toContainText('Estación científica: consola seleccionada');
  for (const size of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1280, height: 850 }]) {
    await page.setViewportSize(size);
    await expect.poll(async () => canvas.evaluate(element => {
      const canvas = element as HTMLCanvasElement, bounds = canvas.getBoundingClientRect();
      return Math.abs(canvas.width / canvas.height - bounds.width / bounds.height);
    })).toBeLessThan(.01);
    await expect(canvas).toHaveAttribute('data-bridge-pose', '2:3:W');
    await expect(page.getByTestId('explore-target')).toContainText('Estación científica');
    expect(await canvas.evaluate(element => (element as HTMLCanvasElement).width * (element as HTMLCanvasElement).height)).toBeLessThanOrEqual(1280 * 720);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await canvas.screenshot({ path: `test-results/bridge-science-${size.width}.png` });
  }
});

test('WebGL denial leaves a usable first-person bridge and real transporter', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null;
      return original.apply(this, [type, ...args] as Parameters<typeof original>);
    } as typeof original;
  });
  await page.goto('/');
  // Wait for actual fallback mount, not an initially empty React root.
  await expect(page.getByTestId('compatible-firstperson-canvas')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('bridge-interior')).toHaveCount(0);
  for (const action of ['right', 'forward', 'right', 'use']) await page.getByTestId(`explore-${action}`).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByTestId('transport-confirm').click();
  await expect(page.getByTestId('explore-area')).toContainText('Superficie');
  expect(errors).toEqual([]);
});

test('a lost WebGL context falls back without resetting the captain position', async ({ page }) => {
  await page.goto('/');
  const canvas = page.getByTestId('bridge-interior');
  await expect(canvas).toHaveAttribute('data-bridge-rendered', 'true', { timeout: 20_000 });
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
