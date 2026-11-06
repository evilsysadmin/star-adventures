import {expect, test} from '@playwright/test';

test.use({storageState:{cookies:[],origins:[]}});

for(const width of [360,390,430,1280]){
  test('away-team officers paint back-to-front and preserve grid order after F5 at '+width+'px',async({page})=>{
    test.setTimeout(90_000);
    await page.setViewportSize({width,height:850});
    await page.goto('/');
    await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:20_000});
    await page.getByTestId('captain-transport').click({timeout:25_000});
    await page.getByTestId('transport-confirm').click();
    const board=page.getByTestId('ground-squad-board');
    await expect(board).toBeVisible();

    // SVG child order is painter order. At landing the canonical roster is
    // NOT back-to-front: Dorn stands behind Venn, Mira stands in front.
    const painted=()=>board.locator('g[data-officer-id]').evaluateAll(nodes=>
      nodes.map(node=>({
        id:node.getAttribute('data-officer-id'),
        footY:Number(node.getAttribute('data-proj-y')),
      })));
    expect((await painted()).map(unit=>unit.id)).toEqual(['dorn','venn','mira']);
    expect((await painted()).map(unit=>unit.footY)).toEqual([212,232,252]);

    // This is a real accepted move, not a mock sprite transform. While it
    // animates, depth uses the visible feet; after F5 the saved tile wins.
    await page.locator('[data-cell-id="2,4"]').click({button:'right'});
    const venn=page.getByTestId('ground-unit-venn');
    await expect(venn).toHaveAttribute('data-grid-x','2');
    await expect(venn).toHaveAttribute('data-grid-y','4');
    await expect(venn).toHaveAttribute('data-walk-phase','idle',{timeout:10_000});
    expect((await painted()).map(unit=>unit.id)).toEqual(['venn','dorn','mira']);
    expect((await painted()).map(unit=>unit.footY)).toEqual([172,212,252]);
    await board.screenshot({path:'test-results/ground-depth-'+width+'.png'});

    await page.reload();
    await expect(board).toBeVisible();
    expect((await painted()).map(unit=>unit.id)).toEqual(['venn','dorn','mira']);
    await expect(venn).toHaveAttribute('data-grid-x','2');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}
