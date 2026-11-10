import {test,expect} from '@playwright/test';

test.use({storageState:{cookies:[],origins:[]}});
for(const width of [390,1280]){
  test('unpublished K-47 authored models never fetch and never remove playable SVG '+width,async({page})=>{
    test.setTimeout(100_000);
    await page.setViewportSize({width,height:850});
    const external:string[]=[];
    await page.route('**/star-adventures/environment/*.glb',route=>{
      external.push(route.request().url());
      return route.abort();
    });
    await page.goto('/');
    await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:25_000});
    await page.getByTestId('captain-transport').click();
    await page.getByTestId('transport-confirm').click();
    const board=page.getByTestId('ground-squad-board');
    await expect(board).toBeVisible();
    const three=page.getByTestId('ground-landing-court-3d');
    await expect(three).toHaveAttribute('data-authored-art-slots','3');
    await expect(three).toHaveAttribute('data-published-art-slots','0');
    await expect(three).toHaveAttribute('data-authored-art-state','unpublished');
    await expect(three).toHaveAttribute('data-authored-art-ready','');
    await expect(three).toHaveAttribute('data-renderer-state','ready',{timeout:20_000});
    expect(external).toEqual([]);
    await expect(board.locator('[data-cell-id]')).toHaveCount(216);
    const southernWall=board.getByTestId('ground-architecture-wall-3,7');
    if(await southernWall.count())await expect(southernWall).not.toHaveCSS('opacity','0');
    await board.locator('[data-cell-id="5,4"]').click({button:'right'});
    await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-x','5');
    await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-walk-phase','idle',{timeout:25_000});
    await page.reload();
    await expect(three).toHaveAttribute('data-authored-art-state','unpublished');
    await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-x','5');
    expect(external).toEqual([]);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}
