import { test, expect, type Page } from '@playwright/test';

type Projected = { clientX: number; clientY: number; ndcX: number; ndcY: number };
declare global {
  interface Window {
    __shadowopsTacticalProbe?: {
      projectCell(col: number, row: number): Projected;
      getSelected(): { id: string; blocked: boolean } | null;
    };
  }
}

async function ready(page: Page) {
  await page.goto('/?tactical=probe');
  await expect(page.getByTestId('tactical-canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => !!window.__shadowopsTacticalProbe)).toBe(true);
  await expect(page.getByTestId('camera-error')).toHaveCount(0);
}
async function sample(page: Page, col: number, row: number): Promise<Projected> {
  return page.evaluate(([c, r]) => {
    if (!window.__shadowopsTacticalProbe) throw new Error('Three.js probe not mounted');
    return window.__shadowopsTacticalProbe.projectCell(c, r);
  }, [col, row]);
}

for (const width of [360, 390, 430, 1280]) {
  test(`Three.js raycaster selects 64/64 centers at ${width}px`, async ({ page }) => {
    test.setTimeout(100_000);
    await page.setViewportSize({ width, height: 850 });
    await ready(page);
    // The component lives inside a centered page; the canvas is NOT viewport-aligned.
    const rect = await page.getByTestId('tactical-canvas').boundingBox();
    expect(rect).not.toBeNull();
    expect(rect!.x).toBeGreaterThan(0);
    let matches = 0;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const point = await sample(page, col, row);
        expect(Math.abs(point.ndcX)).toBeLessThan(.99);
        expect(Math.abs(point.ndcY)).toBeLessThan(.99);
        expect(point.clientX).toBeGreaterThan(rect!.x);
        expect(point.clientX).toBeLessThan(rect!.x + rect!.width);
        expect(point.clientY).toBeGreaterThan(rect!.y);
        expect(point.clientY).toBeLessThan(rect!.y + rect!.height);
        await page.mouse.click(point.clientX, point.clientY);
        await expect(page.getByTestId('tactical-selected')).toHaveText(`${col}:${row}`);
        matches++;
      }
    }
    expect(matches).toBe(64);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({ path: `test-results/tactical-probe-${width}.png`, fullPage: true });
  });
}

test('resize, scroll and canvas offset do not change logical ID under the pointer', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 850 });
  await ready(page);
  await page.evaluate(() => window.scrollTo(0, 90));
  const a = await sample(page, 7, 0);
  await page.mouse.click(a.clientX, a.clientY);
  await expect(page.getByTestId('tactical-selected')).toHaveText('7:0');
  await page.setViewportSize({ width: 430, height: 850 });
  await expect.poll(async () => {
    const b = await sample(page, 7, 0);
    return Math.abs(b.ndcX) < 1 && Math.abs(b.ndcY) < 1;
  }).toBe(true);
  const b = await sample(page, 0, 7);
  await page.mouse.click(b.clientX, b.clientY);
  await expect(page.getByTestId('tactical-selected')).toHaveText('0:7');
  await page.getByRole('link', { name: 'Regresar a la misión' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('floating art never steals the tile ID, blocked cell can be inspected but marked blocked', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 850 });
  await ready(page);
  // Cells beneath three floating cylinders and the blocked obstacle are still pickable.
  for (const [col, row] of [[1,1], [2,5], [5,3], [4,3]]) {
    const point = await sample(page, col, row);
    await page.mouse.click(point.clientX, point.clientY);
    await expect(page.getByTestId('tactical-selected')).toHaveText(`${col}:${row}`);
    if (col === 4 && row === 3) await expect(page.getByTestId('tactical-status')).toContainText('bloqueado');
  }
});

test('drag and click outside canvas do not trigger unwanted tactical selection', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 850 });
  await ready(page);
  const start = await sample(page, 1, 1);
  const finish = await sample(page, 5, 4);
  await page.mouse.move(start.clientX, start.clientY);
  await page.mouse.down();
  await page.mouse.move(finish.clientX, finish.clientY, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByTestId('tactical-selected')).toHaveText('ninguna');
  await page.getByRole('heading', { name: 'Prueba de cámara táctica' }).click();
  await expect(page.getByTestId('tactical-selected')).toHaveText('ninguna');
});

test('DPR 2 touch/pointer picking and accessible keyboard-grid equivalent', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 850 }, deviceScaleFactor: 2,
    hasTouch: true, isMobile: true,
  });
  const page = await context.newPage();
  try {
    await ready(page);
    for (const [col,row] of [[0,0],[7,7],[4,3],[2,5]]) {
      const point = await sample(page,col,row);
      await page.touchscreen.tap(point.clientX,point.clientY);
      await expect(page.getByTestId('tactical-selected')).toHaveText(`${col}:${row}`);
    }
    await page.getByText('Seleccionar casillas con teclado').click();
    const button = page.getByTestId('tactical-key-3:6');
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('tactical-selected')).toHaveText('3:6');
    await expect(button).toHaveAttribute('aria-pressed','true');
    await page.screenshot({ path:'test-results/tactical-probe-dpr2-390.png',fullPage:true });
  } finally { await context.close(); }
});
