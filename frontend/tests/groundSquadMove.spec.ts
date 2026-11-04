import { expect, test } from '@playwright/test';

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
    await page.getByTestId('ground-squad-toggle').click();

    // The canonical campaign has one squad position, so there can be no
    // fabricated individual move before a dedicated per-officer save contract.
    await page.locator('[data-cell-id="4,4"]').click({button:'right'});
    await expect(page.getByTestId('ground-move-status')).toContainText('Selecciona todo');
    await expect(page.getByTestId('explore-heading')).toContainText('4:5');

    await page.getByTestId('ground-select-all').click();
    await page.locator('[data-cell-id="3,2"]').click({button:'right'});
    await expect(page.getByTestId('ground-move-status')).toContainText('bloqueada');
    await expect(page.getByTestId('explore-heading')).toContainText('4:5');

    await page.locator('[data-cell-id="4,4"]').click({button:'right'});
    await expect(page.getByTestId('explore-heading')).toContainText('4:4');
    await expect(page.getByTestId('ground-move-status')).toContainText('4:4');
    await page.getByTestId('ground-squad-board').screenshot({path:'test-results/ground-squad-moved-'+width+'.png'});

    // Real spatial save still owns the canonical pose after refresh.
    await page.reload();
    await expect(page.getByTestId('explore-heading')).toContainText('4:4');
    await page.getByTestId('ground-squad-toggle').click();
    await page.getByTestId('ground-select-all').click();

    // Touch/keyboard alternative requires no right-click.
    await page.getByTestId('ground-move-mode').click();
    await page.locator('[data-cell-id="4,5"]').click();
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
