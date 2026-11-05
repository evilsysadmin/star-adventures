import {expect,test} from '@playwright/test';

// The visual animation consumes the already accepted ground-position route.
// It never writes a second game move or changes the persisted coordinates.
test.use({storageState:{cookies:[],origins:[]}});

async function land(page: import('@playwright/test').Page){
  await page.goto('/');
  await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:20_000});
  await page.getByTestId('captain-transport').click({timeout:25_000});
  await page.getByTestId('transport-confirm').click();
  await expect(page.getByTestId('ground-squad-board')).toBeVisible();
}
for(const width of [390,1280]){
 test('accepted grid order plays real walk-atlas frames '+width+'px',async({page})=>{
  test.setTimeout(90_000);
  page.setDefaultTimeout(15_000);
  await page.setViewportSize({width,height:850});
  await land(page);
  const venn=page.getByTestId('ground-unit-venn');
  const dorn=page.getByTestId('ground-unit-dorn');
  await expect(venn).toHaveAttribute('data-grid-x','4');
  await expect(venn).toHaveAttribute('data-grid-y','5');
  const dornPose=await dorn.getAttribute('transform');
  await page.locator('[data-cell-id="2,4"]').click({button:'right'});
  await expect(venn).toHaveAttribute('data-grid-x','2');
  await expect(venn).toHaveAttribute('data-grid-y','4');
  // An actual accepted path is >1 tile and must show a nonzero atlas frame
  // before ending on the authoritative final cell.
  await expect(venn).toHaveAttribute('data-walk-phase','moving');
  await expect.poll(async()=>Number(await venn.getAttribute('data-walk-frame')),{timeout:3_000})
    .toBeGreaterThan(0);
  await expect(venn).toHaveAttribute('data-walk-phase','idle',{timeout:10_000});
  await expect(dorn).toHaveAttribute('transform',dornPose??'');
  await page.reload();
  await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-x','2');
  await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-y','4');
  await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-walk-phase','idle');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}

test('reduced motion skips animation while preserving saved officer destination',async({page})=>{
 test.setTimeout(70_000);
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.setViewportSize({width:390,height:850});
 await land(page);
 await page.locator('[data-cell-id="2,4"]').click({button:'right'});
 const venn=page.getByTestId('ground-unit-venn');
 await expect(venn).toHaveAttribute('data-grid-x','2');
 await expect(venn).toHaveAttribute('data-grid-y','4');
 await expect(venn).toHaveAttribute('data-walk-phase','idle');
 await page.reload();
 await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-x','2');
});
