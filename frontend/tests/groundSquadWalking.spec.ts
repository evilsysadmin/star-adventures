import {expect,test} from '@playwright/test';

// The visual animation consumes the already accepted ground-position route.
// It never writes a second game move or changes the persisted coordinates.
test.use({storageState:{cookies:[],origins:[]}});
const tinyPng=Buffer.from(
 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLytAAAAABJRU5ErkJggg==',
 'base64',
);

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
  // Independent, decodable fixture proves that the six-frame walk sheet is
  // actually loaded, not merely an idle character translated across the map.
  await page.route(/\/star-adventures\/tactical\/officer-(female|male)-walk-v1-[^/]+\.webp$/,route=>
    route.fulfill({status:200,contentType:'image/png',
      headers:{'access-control-allow-origin':'*'},body:tinyPng}));
  await land(page);
  const venn=page.getByTestId('ground-unit-venn');
  await expect(venn).toHaveAttribute('data-walk-atlas-ready','true');
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
  const walkArt=page.getByTestId('ground-officer-walk-venn');
  await expect(walkArt).toBeVisible();
  // The colony art scale is independent of input geometry and route state.
  // Assert the actual shared transform, rather than weakening sprite checks.
  await expect(page.getByTestId('ground-officer-visible-art-venn'))
    .toHaveAttribute('transform','translate(0 9) scale(.76) translate(0 -9)');
  await expect(page.getByTestId('ground-officer-hit-venn')).toHaveAttribute('width','36');
  await expect(walkArt.locator('div')).toHaveCSS('background-size','300% 200%');
  await expect(walkArt.locator('div')).toHaveCSS('background-image',/officer-female-walk-v1-/);
  // Cropped frame keeps the explicit 54×80 world-size atlas, rendered at
  // 76% through the shared *art-only* transform (selection is still full size).
  const bounds=await walkArt.boundingBox();
  // The inner walk atlas remains 54×80 SVG units; its parent art-only scale
  // is 0.76. Follow camera zoom still derives from the actual viewBox and
  // rendered SVG bounds, not a fixed screen-pixel ceiling.
  const expected=await page.getByTestId('ground-squad-board').evaluate(node=>{
    const svg=node as SVGSVGElement,view=svg.viewBox.baseVal;
    const rect=svg.getBoundingClientRect();
    const art=svg.querySelector('[data-testid="ground-officer-visible-art-venn"]');
    if(art?.getAttribute('transform')!=='translate(0 9) scale(.76) translate(0 -9)')
      throw new Error('Unexpected authored officer art scale');
    return {width:54*.76*rect.width/view.width,height:80*.76*rect.height/view.height};
  });
  expect(bounds?.width).toBeGreaterThan(expected.width-2);
  expect(bounds?.width).toBeLessThan(expected.width+2);
  expect(bounds?.height).toBeGreaterThan(expected.height-2);
  expect(bounds?.height).toBeLessThan(expected.height+2);
  await expect.poll(async()=>Number(await venn.getAttribute('data-walk-frame')),{timeout:3_000})
    .toBeGreaterThan(0);
  // Capture the actual cropped atlas renderer, not a separately composed mock.
  await page.getByTestId('ground-squad-board').screenshot({
    path:'test-results/ground-walk-'+width+'.png',
  });
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
