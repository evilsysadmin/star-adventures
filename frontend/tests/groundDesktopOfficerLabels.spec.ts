import {expect,test} from '@playwright/test';

// Officer call signs are pure presentation. Their scaling must never change
// SVG picking, canonical 18x12 cells or the portrait mobile interaction.
test.use({storageState:{cookies:[],origins:[]}});

for(const {width,height} of [
  {width:1280,height:850},
  {width:1462,height:666},
  {width:1828,height:832},
  {width:390,height:850},
]){
 test('officer labels remain readable and harmless at '+width+'x'+height,async({page})=>{
  test.setTimeout(100_000);
  await page.setViewportSize({width,height});
  await page.goto('/');
  await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:25000});
  await page.getByTestId('captain-transport').click();
  await page.getByTestId('transport-confirm').click();
  const board=page.getByTestId('ground-squad-board');
  await expect(board).toBeVisible();
  const desktop=width>=1100;
  for(const id of ['venn','dorn','mira']){
   const visual=page.getByTestId('ground-officer-nameplate-art-'+id);
   await expect(visual).toHaveAttribute('transform',desktop?(id==='venn'?'scale(0.91)':'scale(0.8)'):'scale(1)');
   await expect(visual.locator('text')).toBeVisible();
   const size=await page.getByTestId('ground-officer-hit-'+id).evaluate(e=>{
    const b=(e as SVGGraphicsElement).getBBox();
    return {width:b.width,height:b.height};
   });
   expect(size).toEqual({width:36,height:57});
  }
  await expect(board.locator('[data-cell-id]')).toHaveCount(216);
  await page.screenshot({path:'test-results/away-officer-nameplates-'+width+'x'+height+'.png'});
  // Actual SVG hit targets still select officers, with all names accessible
  // in the one canonical crew rail. No duplicate DOM controls.
  await page.getByTestId('ground-officer-hit-dorn').click();
  await expect(page.getByTestId('ground-select-dorn')).toHaveAttribute('aria-pressed','true');
  // Emphasis follows selection state only on desktop, never alters any
  // geometry in the canonical officer hit rect or mobile identity.
  await expect(page.getByTestId('ground-officer-nameplate-art-dorn'))
    .toHaveAttribute('transform',desktop?'scale(0.91)':'scale(1)');
  await expect(page.getByTestId('ground-officer-nameplate-art-venn'))
    .toHaveAttribute('transform',desktop?'scale(0.8)':'scale(1)');
  await page.getByTestId('ground-officer-hit-venn').click();
  await expect(page.getByTestId('ground-select-venn')).toHaveAttribute('aria-pressed','true');
  await expect(page.getByTestId('ground-select-mira')).toHaveCount(1);
  await page.reload();
  await expect(board).toBeVisible();
  await expect(page.getByTestId('ground-officer-nameplate-art-venn'))
    .toHaveAttribute('transform',desktop?'scale(0.91)':'scale(1)');
 });
}
