import { expect, test } from '@playwright/test';

async function clickGround(page: import('@playwright/test').Page, x: number, y: number) {
  const board = page.getByTestId('ground-squad-board');
  const position = await board.evaluate((element, cell) => {
    const svg = element as SVGSVGElement;
    const point = svg.createSVGPoint();
    point.x = 440 + (cell.x - cell.y) * 40;
    point.y = 52 + (cell.x + cell.y) * 20;
    const matrix = svg.getScreenCTM();
    if (!matrix) throw new Error('No map projection');
    const pixel = point.matrixTransform(matrix);
    const rect = svg.getBoundingClientRect();
    return { x: pixel.x - rect.left, y: pixel.y - rect.top };
  }, {x,y});
  await board.click({position,button:'right'});
}

for (const width of [390, 1280]) {
  test('individual officer orders survive F5 and never move teammates at '+width+'px', async ({page}) => {
    test.setTimeout(85_000);
    await page.setViewportSize({width,height:850});
    await page.goto('/');
    await page.getByTestId('explore-right').click();
    await page.getByTestId('explore-forward').click();
    await page.getByTestId('explore-right').click();
    await page.getByTestId('explore-use').click();
    await page.getByTestId('transport-confirm').click();
    await expect(page.getByTestId('explore-area')).toContainText('Superficie');
    await expect(page.getByTestId('ground-squad-board')).toBeVisible();
    const venn=page.getByTestId('ground-unit-venn');
    const dorn=page.getByTestId('ground-unit-dorn');
    const mira=page.getByTestId('ground-unit-mira');
    await expect(venn).toHaveAttribute('data-grid-x','4');
    await expect(venn).toHaveAttribute('data-grid-y','5');
    await expect(dorn).toHaveAttribute('data-grid-y','4');
    await expect(mira).toHaveAttribute('data-grid-x','5');

    // Nara moves west one cell, while Kael and Isa remain in their own cells.
    await clickGround(page,3,5);
    await expect(venn).toHaveAttribute('data-grid-x','3');
    await expect(venn).toHaveAttribute('data-heading','W');
    await expect(dorn).toHaveAttribute('data-grid-x','4');
    await expect(dorn).toHaveAttribute('data-grid-y','4');
    await expect(mira).toHaveAttribute('data-grid-x','5');
    await expect(page.getByTestId('explore-heading')).toContainText('4:5');
    // Impossible terrain rejects the whole formation, with no partial moves.
    await page.getByTestId('ground-select-all').click();
    await clickGround(page,6,4); // station: impassable
    await expect(page.getByTestId('ground-move-status')).toContainText('bloqueada');
    await expect(venn).toHaveAttribute('data-grid-x','3');
    await page.reload();
    await expect(page.getByTestId('ground-squad-board')).toBeVisible();
    await expect(venn).toHaveAttribute('data-grid-x','3');
    await expect(dorn).toHaveAttribute('data-grid-x','4');

    // Move a DIFFERENT officer, proving the clicked roster is real.
    await page.getByTestId('ground-select-dorn').click();
    await clickGround(page,3,4);
    await expect(dorn).toHaveAttribute('data-grid-x','3');
    await expect(dorn).toHaveAttribute('data-grid-y','4');
    await expect(venn).toHaveAttribute('data-grid-x','3');
    await expect(mira).toHaveAttribute('data-grid-x','5');
    // Follow-camera geometry continues to animate after the grid coordinate
    // changes. A projected pointer order during that transition may land on
    // the next tile: wait for the actual completed walk before probing the
    // occupied cell, never add arbitrary timeouts or skip collision checks.
    await expect(dorn).toHaveAttribute('data-walk-phase','idle',{timeout:30000});
    await clickGround(page,3,5);
    await expect(page.getByTestId('ground-move-status')).toContainText('ocupada');
    await expect(dorn).toHaveAttribute('data-grid-y','4');

    // Turning the legacy camera is harmless: it must not erase the independent
    // movements or fabricate mission interactions.
    await page.getByTestId('ground-squad-toggle').click();
    await page.getByTestId('explore-left').click();
    await page.getByTestId('ground-squad-toggle').click();
    await expect(venn).toHaveAttribute('data-grid-x','3');
    await expect(dorn).toHaveAttribute('data-grid-x','3');
    await page.reload();
    await expect(page.getByTestId('ground-squad-board')).toBeVisible();
    await expect(dorn).toHaveAttribute('data-grid-y','4');
    await expect(venn).toHaveAttribute('data-grid-x','3');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByTestId('ground-squad-board').screenshot({path:'test-results/ground-individual-'+width+'.png'});

    // Corrupted sidecar resets safely without touching spatial.v1.
    await page.evaluate(() => localStorage.setItem('shadowops.star-adventures.ground-squad.v1','{broken'));
    await page.reload();
    await expect(page.getByTestId('ground-squad-board')).toBeVisible();
    await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-x','4');
    await expect(page.getByTestId('explore-heading')).toContainText('4:5');
  });
}
