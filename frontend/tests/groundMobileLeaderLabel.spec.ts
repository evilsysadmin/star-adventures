import {expect,test} from '@playwright/test';

test.use({storageState:{cookies:[],origins:[]}});

for(const width of [360,390,430,1280]){
  test('only the current selection leader has an in-world label on phones '+width,async({page})=>{
    test.setTimeout(90_000);
    await page.setViewportSize({width,height:850});
    await page.goto('/');
    await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:25_000});
    await page.getByTestId('captain-transport').click({timeout:25_000});
    await page.getByTestId('transport-confirm').click();
    const board=page.getByTestId('ground-squad-board');
    const name=(id:string)=>page.getByTestId('ground-unit-'+id).locator('.ground-unit-name');
    const unit=(id:string)=>page.getByTestId('ground-unit-'+id);
    await expect(board).toBeVisible();
    for(const id of ['venn','dorn','mira']){
      await expect(name(id)).toHaveCount(1);
      await expect(page.getByTestId('ground-select-'+id)).toBeVisible();
    }
    await expect(unit('venn')).toHaveClass(/is-selection-leader/);
    const shouldHide=width<=520;
    await expect(name('venn')).toHaveCSS('visibility','visible');
    for(const id of ['dorn','mira']){
      await expect(name(id)).toHaveCSS('visibility',shouldHide?'hidden':'visible');
    }
    await page.screenshot({path:'test-results/away-selection-label-initial-'+width+'.png'});

    // Change actual player selection through the real mobile/desktop rail.
    await page.getByTestId('ground-select-dorn').click();
    await expect(unit('dorn')).toHaveClass(/is-selection-leader/);
    await expect(unit('dorn')).toHaveClass(/is-selected/);
    await expect(name('dorn')).toHaveCSS('visibility','visible');
    await expect(name('venn')).toHaveCSS('visibility',shouldHide?'hidden':'visible');

    // Group orders preserve all the selected officers, but just one label
    // remains when phone space is tight. Their IDs and SVG hit targets stay.
    await page.getByTestId('ground-selection-additive').click();
    await page.getByTestId('ground-select-mira').click();
    await expect(unit('dorn')).toHaveClass(/is-selection-leader/);
    await expect(unit('mira')).toHaveClass(/is-selected/);
    await expect(name('mira')).toHaveCSS('visibility',shouldHide?'hidden':'visible');
    await expect(page.getByTestId('ground-selection-status')).toContainText('2 de 3');
    await page.screenshot({path:'test-results/away-selection-label-group-'+width+'.png'});

    await page.getByTestId('ground-selection-additive').click();
    await page.getByTestId('ground-select-venn').click();
    await board.locator('[data-cell-id="2,4"]').click({button:'right'});
    await expect(unit('venn')).toHaveAttribute('data-grid-x','2');
    await expect(unit('venn')).toHaveAttribute('data-grid-y','4');
    await page.reload();
    await expect(board).toBeVisible();
    await expect(unit('venn')).toHaveAttribute('data-grid-x','2');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
      .toBe(true);
  });
}
