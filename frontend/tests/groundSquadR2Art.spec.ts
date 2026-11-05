import {expect, test} from '@playwright/test';

// The general Playwright fixture starts in the diagnostic journal view.
// Check the real immersive bridge -> planetary landing instead.
test.use({storageState: {cookies: [], origins: []}});
const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLytAAAAABJRU5ErkJggg==',
  'base64',
);

async function land(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByTestId('captain-transport').click();
  await page.getByTestId('transport-confirm').click();
  await expect(page.getByTestId('ground-squad-board')).toBeVisible();
}

for (const width of [390, 1280]) {
  test('planetary team reuses actual R2 manifest sprite URLs while retaining selection ' + width, async ({page}) => {
    test.setTimeout(80_000);
    await page.setViewportSize({width,height:850});
    // Intercept the immutable CDN URLs with a decodable fixture so this
    // checks SVG image lifecycle deterministically, even when R2 is offline.
    await page.route('**/star-adventures/tactical/officer-mvs-*.webp', route =>
      route.fulfill({status:200,contentType:'image/png',
        headers:{'access-control-allow-origin':'*'},body:tinyPng}));
    await land(page);
    const venn = page.getByTestId('ground-officer-sprite-venn');
    const dorn = page.getByTestId('ground-officer-sprite-dorn');
    const mira = page.getByTestId('ground-officer-sprite-mira');
    await expect(venn).toHaveAttribute('href', /officer-mvs-v1-/);
    await expect(mira).toHaveAttribute('href', /officer-mvs-v1-/);
    await expect(dorn).toHaveAttribute('href', /officer-mvs-male-v1-/);
    for (const officer of ['venn','dorn','mira']) {
      await expect(page.getByTestId('ground-officer-sprite-' + officer)).toHaveAttribute('data-asset-state','loaded');
      await expect(page.getByTestId('ground-officer-proxy-' + officer)).toHaveAttribute('opacity','0');
    }
    const poseBefore = await page.getByTestId('ground-unit-dorn').getAttribute('data-grid-x');
    await page.getByTestId('ground-unit-dorn').click();
    await expect(page.getByTestId('ground-select-dorn')).toHaveAttribute('aria-pressed','true');
    await expect(page.getByTestId('ground-unit-dorn')).toHaveAttribute('data-grid-x',poseBefore ?? '');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('R2 outage leaves selectable officers and every movement control visible',async({page})=>{
  test.setTimeout(70_000);
  await page.setViewportSize({width:390,height:850});
  await page.route('**/star-adventures/tactical/officer-mvs-*.webp',route=>route.abort());
  await land(page);
  for(const officer of ['venn','dorn','mira']){
    await expect(page.getByTestId('ground-officer-sprite-'+officer))
      .toHaveAttribute('data-asset-state','fallback');
    await expect(page.getByTestId('ground-officer-proxy-'+officer)).toHaveAttribute('opacity','1');
    await expect(page.getByTestId('ground-unit-'+officer)).toBeVisible();
  }
  await page.getByTestId('ground-unit-mira').click();
  await expect(page.getByTestId('ground-select-mira')).toHaveAttribute('aria-pressed','true');
  await expect(page.getByTestId('ground-move-mode')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
