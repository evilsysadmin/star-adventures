import {test,expect} from '@playwright/test';

test.use({storageState:{cookies:[],origins:[]}});
for(const width of [390,1280]){
  test('published K-47 requests only discovered art and never removes SVG after CDN failure '+width,async({page})=>{
    test.setTimeout(100_000);
    await page.setViewportSize({width,height:850});
    const external:string[]=[];
    await page.route('**/environment/*.glb',route=>{
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
    await expect(three).toHaveAttribute('data-published-art-slots','3');
    await expect(three).toHaveAttribute('data-authored-art-ready','');
    await expect(three).toHaveAttribute('data-renderer-state','ready',{timeout:20_000});
    // The south frontage is explored on landing, so it may request immediately.
    // West/east must still remain fog-gated and never fetch here.
    expect(external.every(url=>url.includes('/south-industrial-shell-'))).toBe(true);
    await expect(board.locator('[data-cell-id]')).toHaveCount(216);
    const southernWall=board.getByTestId('ground-architecture-wall-3,7');
    if(await southernWall.count())await expect(southernWall).not.toHaveCSS('opacity','0');
    await board.locator('[data-cell-id="5,4"]').click({button:'right'});
    await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-x','5');
    await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-walk-phase','idle',{timeout:25_000});
    await page.reload();
    await expect(three).toHaveAttribute('data-published-art-slots','3');
    await expect(three).toHaveAttribute('data-authored-art-ready','');
    await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-x','5');
    // Moving can legitimately reveal the west/east frontage. After F5 those
    // discovered footprints may fetch; forbid non-canonical URLs, not progress.
    const allowed=new Set([
      'https://pub-0e83bbe83562412182441ed82173d704.r2.dev/environment/south-industrial-shell-903b06139f9f3881.glb',
      'https://pub-0e83bbe83562412182441ed82173d704.r2.dev/environment/west-archive-shell-6620dd38f67fc22a.glb',
      'https://pub-0e83bbe83562412182441ed82173d704.r2.dev/environment/east-utilities-shell-14f64c52b6e92574.glb',
    ]);
    expect(external.every(url=>allowed.has(url))).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}
