import {expect, test} from '@playwright/test';

async function moveOnGround(page: import('@playwright/test').Page, x: number, y: number) {
  const board = page.getByTestId('ground-squad-board');
  const position = await board.evaluate((element, cell) => {
    const svg = element as SVGSVGElement;
    const point = svg.createSVGPoint();
    point.x = 440 + (cell.x - cell.y) * 40;
    point.y = 52 + (cell.x + cell.y) * 20;
    const matrix = svg.getScreenCTM();
    if (!matrix) throw new Error('No ground camera projection');
    const pixel = point.matrixTransform(matrix);
    const rect = svg.getBoundingClientRect();
    return {x: pixel.x - rect.left, y: pixel.y - rect.top};
  }, {x,y});
  await board.click({position,button:'right'});
}

for (const width of [390,1280]) {
  test('real selected scientist investigates the ground probe, persists finding and leaves campaign anchor intact at '+width+'px',async({page})=>{
    test.setTimeout(85_000);
    await page.setViewportSize({width,height:850});
    await page.goto('/');
    await page.getByTestId('explore-right').click();
    await page.getByTestId('explore-forward').click();
    await page.getByTestId('explore-right').click();
    await page.getByTestId('explore-use').click();
    await page.getByTestId('transport-confirm').click();
    await expect(page.getByTestId('explore-area')).toContainText('Superficie');
    await expect(page.getByTestId('ground-squad-board')).toBeVisible();

    const inspect = page.getByTestId('ground-inspect-probe');
    await expect(inspect).toBeDisabled();
    await expect(page.getByTestId('away-finding')).toContainText('Sonda pendiente');

    // The operator's actual cell matters, not the classic group anchor.
    await page.getByTestId('ground-select-dorn').click();
    await moveOnGround(page,4,3);
    await expect(page.getByTestId('ground-unit-dorn')).toHaveAttribute('data-grid-y','3');
    await expect(inspect).toBeEnabled();
    await inspect.click();
    await expect(page.getByTestId('ground-probe-status')).toContainText('Kael Dorn: ciencia 1/5');
    await expect(page.getByTestId('away-finding')).toContainText('Investigación insuficiente');
    await expect(page.getByTestId('explore-heading')).toContainText('4:5');

    // Nara is a real scientist. Moving her to another adjacent cell allows
    // success without borrowing a skill across the squad.
    await page.getByTestId('ground-select-venn').click();
    await expect(inspect).toBeDisabled();
    await moveOnGround(page,5,2);
    await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-x','5');
    await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-y','2');
    await inspect.click();
    await expect(page.getByTestId('ground-probe-status')).toContainText('Nara Venn: firma mineral registrada');
    await expect(page.getByTestId('away-finding')).toContainText('Sonda investigada: firma mineral registrada');
    await expect(page.getByTestId('explore-heading')).toContainText('4:5');
    await page.getByTestId('ground-squad-board').screenshot({path:'test-results/ground-probe-'+width+'.png'});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);

    await page.reload();
    await expect(page.getByTestId('ground-squad-board')).toBeVisible();
    await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-x','5');
    await expect(page.getByTestId('ground-unit-dorn')).toHaveAttribute('data-grid-y','3');
    await expect(page.getByTestId('away-finding')).toContainText('Sonda investigada: firma mineral registrada');
    await expect(page.getByTestId('explore-heading')).toContainText('4:5');
    await page.getByTestId('ground-inspect-probe').click();
    await expect(page.getByTestId('ground-probe-status')).toContainText('ya fue investigada');
  });
}


for(const width of [390,1280]){
 test('realtime station button matches actual fractional arrival at '+width+'px',async({page})=>{
  test.setTimeout(85000);
  await page.setViewportSize({width,height:850});
  await page.goto('/');
  // Same real captain deployment as the continuous-runtime browser journey.
  await expect(page.getByTestId('captain-controls')).toBeVisible();
  await page.getByTestId('captain-transport').click();
  await page.getByTestId('transport-confirm').click();
  await expect(page.getByTestId('ground-squad-board')).toBeVisible();
  await page.locator('.ground-squad-instructions summary').click();
  const toggle=page.getByTestId('ground-realtime-toggle');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed','true');
  await page.getByTestId('ground-select-venn').click();
  const inspect=page.getByTestId('ground-inspect-probe');
  const officer=page.getByTestId('ground-unit-venn');
  await expect(inspect).toBeDisabled();
  await moveOnGround(page,4.34,3.2);
  await expect(officer).toHaveAttribute('data-walk-phase','moving');
  await expect(inspect).toBeDisabled();
  await expect(officer).toHaveAttribute('data-walk-phase','idle',{timeout:10000});
  await expect(inspect).toBeDisabled();
  await moveOnGround(page,4.14,3);
  await expect(inspect).toBeEnabled({timeout:10000});
  await expect(officer).toHaveAttribute('data-walk-phase','idle');
  const x=Number(await officer.getAttribute('data-world-x'));
  const y=Number(await officer.getAttribute('data-world-y'));
  expect(Math.hypot(x-4,y-3)).toBeGreaterThan(.01);
  expect(Math.hypot(x-4,y-3)).toBeLessThanOrEqual(.2);
  await page.screenshot({path:'test-results/ground-realtime-probe-ready-'+width+'.png'});
  await inspect.click();
  await expect(page.getByTestId('away-finding')).toContainText('Sonda investigada: firma mineral registrada');
  await expect(page.getByTestId('explore-heading')).toContainText('4:5');
 });
}
