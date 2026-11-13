import {expect,test} from '@playwright/test';

test.use({storageState:{cookies:[],origins:[]}});

for(const width of [390,1280]){
 test('continuous rescue bay is a real explored interior, not extra game tiles '+width,async({page})=>{
  test.setTimeout(110_000);
  await page.setViewportSize({width,height:850});
  await page.goto('/');
  await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:20_000});
  await page.getByTestId('captain-transport').click({timeout:25_000});
  await page.getByTestId('transport-confirm').click();
  const board=page.getByTestId('ground-squad-board');
  await expect(board).toBeVisible();

  const bay=page.getByTestId('ground-rescue-bay');
  await expect(bay).toHaveCount(1);
  await expect(page.getByTestId('ground-bay-continuous-floor')).toHaveCount(1);
  await expect(page.getByTestId('ground-bay-floor-4,5'))
    .toHaveAttribute('data-fog','visible');
  // The bay is made of real open cells. Existing walls and mission stations
  // cannot be painted as walkable interior tiles.
  await expect(page.getByTestId('ground-bay-floor-3,2')).toHaveCount(0);
  await expect(page.getByTestId('ground-bay-floor-6,4')).toHaveCount(0);
  await expect(page.getByTestId('ground-bay-floor-11,7')).toHaveCount(0);
  const hatch=page.getByTestId('ground-bay-central-hatch');
  await expect(hatch).toHaveAttribute('data-fog','visible');
  // The physical room is still one floor, but its approved transfer
  // platform now paints after the 3D environment and is a sibling of the
  // room underlay. Assert the platform itself, not a stale child selector.
  const overlay=page.getByTestId('ground-bay-platform-overlay');
  await expect(overlay).toHaveCount(1);
  const layout=await hatch.evaluate(node=>{
    const shape=(node as SVGGraphicsElement).getBBox();
    const stage=node.closest('[data-testid="ground-bay-platform-overlay"]');
    return {width:shape.width,height:shape.height,
      pointerEvents:stage?getComputedStyle(stage).pointerEvents:'missing'};
  });
  expect(layout.width).toBeGreaterThan(145);
  expect(layout.height).toBeGreaterThan(65);
  expect(layout.pointerEvents).toBe('none');

  const edge=page.getByTestId('ground-bay-wall-face-5,6-south');
  await expect(edge).toHaveAttribute('data-fog','visible');
  const surface=board.locator('[data-cell-id="5,4"]');
  await expect(surface).toHaveCount(1);
  await board.screenshot({path:'test-results/away-connected-rescue-bay-'+width+'.png'});

  // A genuine picked tile remains the only movement authority. Room artwork
  // never adds colliders or captures the right click.
  await surface.click({button:'right'});
  const venn=page.getByTestId('ground-unit-venn');
  await expect(venn).toHaveAttribute('data-grid-x','5');
  await expect(venn).toHaveAttribute('data-grid-y','4');
  await expect(venn).toHaveAttribute('data-walk-phase','idle',{timeout:15_000});
  await page.reload();
  await expect(page.getByTestId('ground-bay-floor-4,5')).toHaveCount(1);
  await expect(page.getByTestId('ground-bay-central-hatch')).toHaveCount(1);
  await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-x','5');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}
