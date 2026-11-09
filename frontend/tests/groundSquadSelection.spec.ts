
import { expect, test } from '@playwright/test';

for (const width of [390, 1280]) {
  test('surface squad can be selected on the real map at ' + width + 'px without moving', async ({ page }) => {
    test.setTimeout(70_000);
    await page.setViewportSize({ width, height: 850 });
    await page.goto('/');
    await page.getByTestId('explore-right').click();
    await page.getByTestId('explore-forward').click();
    await page.getByTestId('explore-right').click();
    await page.getByTestId('explore-use').click();
    await page.getByTestId('transport-confirm').click();
    await expect(page.getByTestId('explore-area')).toContainText('Superficie planetaria');
    const originalHeading = await page.getByTestId('explore-heading').textContent();

    await expect(page.getByTestId('ground-squad-board')).toBeVisible();
    await expect(page.getByTestId('ground-squad-board')).toBeVisible();
    if (width <= 520) {
      // The suite's saved browser fixture uses the classic/journal layout,
      // whose 300-unit camera is intentionally independent from the immersive
      // fullscreen stage. Test the actual follow/full-map interaction here;
      // the immersive camera dimensions have their own browser gate.
      const board = page.getByTestId('ground-squad-board');
      await expect(board).not.toHaveAttribute('viewBox', '-72 0 1280 640');
      await page.getByTestId('ground-camera-toggle').click();
      await expect(board).toHaveAttribute('viewBox', '-72 0 1280 640');
      await page.getByTestId('ground-camera-toggle').click();
      await expect(board).not.toHaveAttribute('viewBox', '-72 0 1280 640');
    }
    await expect(page.getByTestId('ground-unit-venn')).toBeVisible();
    await expect(page.getByTestId('ground-unit-dorn')).toBeVisible();
    await expect(page.getByTestId('ground-unit-mira')).toBeVisible();

    await page.getByTestId('ground-unit-dorn').click();
    await expect(page.getByTestId('ground-select-dorn')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('ground-select-venn')).toHaveAttribute('aria-pressed', 'false');
    await page.getByTestId('ground-unit-mira').click({ modifiers: ['Shift'] });
    await expect(page.getByTestId('ground-selection-status')).toContainText('2 de 3');
    await page.getByTestId('ground-unit-dorn').click({ modifiers: ['Shift'] });
    await expect(page.getByTestId('ground-selection-status')).toContainText('1 de 3');

    // Empty ground clears selection, then a real pointer marquee selects
    // all centers (including at narrow viewport / non-1 screen scale).
    await page.getByTestId('ground-squad-board').click({ position: { x: 10, y: 10 } });
    await expect(page.getByTestId('ground-selection-status')).toContainText('Ningún');
    const points = await page.getByTestId('ground-squad-board').evaluate(root => {
      const svg = root as SVGSVGElement;
      const matrix = svg.getScreenCTM()!;
      return [...svg.querySelectorAll('[data-officer-id]')].map(unit => {
        const p = svg.createSVGPoint();
        p.x = Number(unit.getAttribute('data-proj-x'));
        p.y = Number(unit.getAttribute('data-proj-y'));
        const screen = p.matrixTransform(matrix);
        return { x: screen.x, y: screen.y };
      });
    });
    const lowX = Math.min(...points.map(p => p.x)) - 15, highX = Math.max(...points.map(p => p.x)) + 15;
    const lowY = Math.min(...points.map(p => p.y)) - 15, highY = Math.max(...points.map(p => p.y)) + 15;
    await page.mouse.move(lowX, lowY);
    await page.mouse.down();
    await page.mouse.move(highX, highY, { steps: 8 });
    await page.mouse.up();
    await expect(page.getByTestId('ground-selection-status')).toContainText('Todo el equipo');

    // Returning to the starting point after dragging must never become a click.
    const unit = points[0];
    await page.keyboard.down('Shift');
    await page.mouse.move(unit.x, unit.y);
    await page.mouse.down();
    await page.mouse.move(unit.x + 40, unit.y + 40, { steps: 4 });
    await page.mouse.move(unit.x, unit.y, { steps: 4 });
    await page.mouse.up();
    await page.keyboard.up('Shift');
    await expect(page.getByTestId('ground-selection-status')).toContainText('Todo el equipo');

    // Accessible button alternatives also work. No selection operation
    // generates a mission order or changes the authoritative spatial pose.
    await page.getByTestId('ground-select-venn').click();
    await expect(page.getByTestId('ground-select-venn')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('ground-select-all').click();
    await expect(page.getByTestId('ground-selection-status')).toContainText('Todo el equipo');
    await page.getByTestId('ground-squad-board').screenshot({
      path: 'test-results/ground-squad-select-' + width + '.png',
    });
    await page.getByTestId('ground-squad-toggle').click();
    await expect(page.getByTestId('explore-heading')).toHaveText(originalHeading ?? '');
    await expect(page.getByTestId('explore-forward')).toBeVisible();
    await page.getByTestId('explore-forward').click();
    await expect(page.getByTestId('explore-heading')).toContainText('4:4');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
