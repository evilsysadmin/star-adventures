import { expect, test } from '@playwright/test';

// Exercise pointer projection at the actual cell center, even when officer
// artwork covers the ground polygon. The SVG's own event delegation must
// resolve the underlying canonical cell.
async function boardCellClick(page: import('@playwright/test').Page, x: number, y: number, button: 'left' | 'right' = 'left') {
  const board = page.getByTestId('ground-squad-board');
  const position = await board.evaluate((element, cell) => {
    const svg = element as SVGSVGElement;
    const point = svg.createSVGPoint();
    point.x = 440 + (cell.x - cell.y) * 40;
    point.y = 52 + (cell.x + cell.y) * 20;
    const matrix = svg.getScreenCTM();
    if (!matrix) throw new Error('No board projection');
    const projected = point.matrixTransform(matrix);
    const rect = svg.getBoundingClientRect();
    return { x: projected.x - rect.left, y: projected.y - rect.top };
  }, {x, y});
  await board.click({position, button});
}

for (const width of [390, 1280]) {
  test('isometric whole-squad marching respects the canonical ground map at ' + width + 'px', async ({ page }) => {
    test.setTimeout(70_000);
    await page.setViewportSize({width,height:850});
    await page.goto('/');
    await page.getByTestId('explore-right').click();
    await page.getByTestId('explore-forward').click();
    await page.getByTestId('explore-right').click();
    await page.getByTestId('explore-use').click();
    await page.getByTestId('transport-confirm').click();
    await expect(page.getByTestId('explore-area')).toContainText('Superficie planetaria');
    await expect(page.getByTestId('explore-heading')).toContainText('4:5');
    await expect(page.getByTestId('ground-squad-board')).toBeVisible();

    // Individual moves use the real officer footprint. Kael already occupies
    // 4:4, so Nara cannot enter it; selection never teleports or stacks units.
    await boardCellClick(page,4,4,'right');
    await expect(page.getByTestId('ground-move-status')).toContainText('ocupada');
    await expect(page.getByTestId('explore-heading')).toContainText('4:5');

    await page.getByTestId('ground-select-all').click();
    await boardCellClick(page,3,2,'right');
    await expect(page.getByTestId('ground-move-status')).toContainText('bloqueada');
    await expect(page.getByTestId('explore-heading')).toContainText('4:5');

    await boardCellClick(page,4,4,'right');
    await expect(page.getByTestId('explore-heading')).toContainText('4:4');
    await expect(page.getByTestId('ground-move-status')).toContainText('4:4');
    await page.getByTestId('ground-squad-board').screenshot({path:'test-results/ground-squad-moved-'+width+'.png'});

    // Real spatial save still owns the canonical pose after refresh.
    await page.reload();
    await expect(page.getByTestId('explore-heading')).toContainText('4:4');
    await expect(page.getByTestId('ground-squad-board')).toBeVisible();
    await page.getByTestId('ground-select-all').click();

    // Touch/keyboard alternative requires no right-click.
    await page.getByTestId('ground-move-mode').click();
    await boardCellClick(page,4,5);
    await expect(page.getByTestId('explore-heading')).toContainText('4:5');

    await page.getByTestId('ground-move-mode').click();
    await page.getByTestId('ground-squad-board').focus();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('explore-heading')).toContainText('4:4');

    await page.getByTestId('ground-squad-toggle').click();
    await expect(page.getByTestId('explore-forward')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
