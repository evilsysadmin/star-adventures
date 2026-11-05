import { expect, test } from '@playwright/test';

async function clickCell(page: import('@playwright/test').Page, x: number, y: number, button: 'left' | 'right') {
  const board=page.getByTestId('ground-squad-board');
  const at=await board.evaluate((element,cell)=>{
    const svg=element as SVGSVGElement;
    const point=svg.createSVGPoint();
    point.x=440+(cell.x-cell.y)*40;
    point.y=52+(cell.x+cell.y)*20;
    const matrix=svg.getScreenCTM();
    if(!matrix) throw new Error('No tactical camera matrix');
    const pixel=point.matrixTransform(matrix),rect=svg.getBoundingClientRect();
    return {x:pixel.x-rect.left,y:pixel.y-rect.top};
  },{x,y});
  await board.click({position:at,button});
}

for(const width of [360,390,430,1280]){
  test('two-officer formation and dispersed regroup persist at '+width+'px',async({page})=>{
    test.setTimeout(85_000);
    await page.setViewportSize({width,height:850});
    await page.goto('/');
    await page.getByTestId('explore-right').click();
    await page.getByTestId('explore-forward').click();
    await page.getByTestId('explore-right').click();
    await page.getByTestId('explore-use').click();
    await page.getByTestId('transport-confirm').click();
    await expect(page.getByTestId('ground-squad-board')).toBeVisible();
    const venn=page.getByTestId('ground-unit-venn');
    const dorn=page.getByTestId('ground-unit-dorn');
    const mira=page.getByTestId('ground-unit-mira');

    // Shift on desktop; additive roster mode is the same operation on touch.
    if(width<520) {
      await page.getByTestId('ground-selection-additive').click();
      await page.getByTestId('ground-select-dorn').click();
      await expect(page.getByTestId('ground-selection-additive')).toHaveAttribute('aria-pressed','true');
    } else {
      await dorn.click({modifiers:['Shift']});
    }
    await expect(page.getByTestId('ground-selection-status')).toContainText('2 de 3');
    await clickCell(page,3,5,'right');
    await expect(page.getByTestId('ground-move-status')).toContainText('Formación de 2');
    await expect(venn).toHaveAttribute('data-grid-x','3');
    await expect(venn).toHaveAttribute('data-grid-y','5');
    await expect(dorn).toHaveAttribute('data-grid-x','3');
    await expect(dorn).toHaveAttribute('data-grid-y','4');
    await expect(mira).toHaveAttribute('data-grid-x','5');
    await expect(mira).toHaveAttribute('data-grid-y','5');
    await expect(page.getByTestId('explore-heading')).toContainText('4:5');

    await page.reload();
    await expect(page.getByTestId('ground-squad-board')).toBeVisible();
    await expect(venn).toHaveAttribute('data-grid-x','3');
    await expect(dorn).toHaveAttribute('data-grid-x','3');
    await expect(mira).toHaveAttribute('data-grid-x','5');

    // A dispersed group now regroups with deterministic per-officer routes,
    // rather than jumping the legacy spatial anchor.
    await page.getByTestId('ground-select-all').click();
    await page.getByTestId('ground-move-mode').click(); // touch-compatible order
    await clickCell(page,4,5,'left');
    await expect(page.getByTestId('ground-move-status')).toContainText('Formación de 3');
    await expect(venn).toHaveAttribute('data-grid-x','4');
    await expect(venn).toHaveAttribute('data-grid-y','5');
    await expect(dorn).toHaveAttribute('data-grid-x','4');
    await expect(dorn).toHaveAttribute('data-grid-y','4');
    await expect(mira).toHaveAttribute('data-grid-x','5');
    await expect(mira).toHaveAttribute('data-grid-y','5');
    const cells=await page.locator('[data-officer-id]').evaluateAll(units=>
      units.map(unit=>unit.getAttribute('data-grid-x')+','+unit.getAttribute('data-grid-y')));
    expect(new Set(cells).size).toBe(3);
    await expect(page.getByTestId('explore-heading')).toContainText('4:5');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    if(width===390 || width===1280)
      await page.getByTestId('ground-squad-board').screenshot({path:'test-results/ground-formation-'+width+'.png'});

    await page.reload();
    await expect(page.getByTestId('ground-squad-board')).toBeVisible();
    await expect(venn).toHaveAttribute('data-grid-x','4');
    await expect(dorn).toHaveAttribute('data-grid-y','4');
    await expect(mira).toHaveAttribute('data-grid-x','5');

    // An occupied object cannot become a formation anchor.
    await page.getByTestId('ground-select-all').click();
    await clickCell(page,6,4,'right');
    await expect(page.getByTestId('ground-move-status')).toContainText('bloqueada');
    await expect(venn).toHaveAttribute('data-grid-x','4');
  });
}
