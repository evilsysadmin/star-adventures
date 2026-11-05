import {expect, test, type Page} from '@playwright/test';

async function moveOnGround(page: Page, x: number, y: number) {
  const board=page.getByTestId('ground-squad-board');
  const at=await board.evaluate((element,cell)=>{
    const svg=element as SVGSVGElement;
    const point=svg.createSVGPoint();
    point.x=440+(cell.x-cell.y)*40;
    point.y=52+(cell.x+cell.y)*20;
    const matrix=svg.getScreenCTM();
    if(!matrix) throw new Error('No ground camera projection');
    const pixel=point.matrixTransform(matrix),rect=svg.getBoundingClientRect();
    return {x:pixel.x-rect.left,y:pixel.y-rect.top};
  },{x,y});
  await board.click({position:at,button:'right'});
}

for(const width of [390,1280]){
  test('selected real medic rescues civilians, keeps individual positions and restores mandate after F5 at '+width+'px',async({page})=>{
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
    const assist=page.getByTestId('ground-assist-civilians');
    await expect(assist).toBeDisabled();
    await expect(page.getByTestId('mission-phase')).toContainText('MISIÓN EN SUPERFICIE');

    // Kael is adjacent but cannot borrow Isa's distant medical skill.
    await page.getByTestId('ground-select-dorn').click();
    await moveOnGround(page,5,4);
    await expect(page.getByTestId('ground-unit-dorn')).toHaveAttribute('data-grid-x','5');
    await expect(assist).toBeEnabled();
    await assist.click();
    await expect(page.getByTestId('ground-medical-status')).toContainText('Kael Dorn, medicina 1/5');
    await expect(page.getByTestId('medical-report')).toContainText('Asistencia insuficiente');
    await expect(page.getByTestId('mission-phase')).toContainText('MISIÓN EN SUPERFICIE');
    await expect(page.getByTestId('explore-heading')).toContainText('4:5');

    // Isa walks to her own adjacent tile; only her action resolves the order.
    await page.getByTestId('ground-select-mira').click();
    await expect(assist).toBeDisabled();
    await moveOnGround(page,6,5);
    await expect(page.getByTestId('ground-unit-mira')).toHaveAttribute('data-grid-x','6');
    await expect(page.getByTestId('ground-unit-mira')).toHaveAttribute('data-grid-y','5');
    await assist.click();
    await expect(page.getByTestId('ground-medical-status')).toContainText('Evacuación completada por Isa Mira');
    await expect(page.getByTestId('mission-phase')).toContainText('RESCATE CONFIRMADO');
    await expect(page.getByTestId('explore-heading')).toContainText('4:5');
    await expect.poll(()=>page.evaluate(()=>JSON.parse(
      localStorage.getItem('shadowops.star-adventures.outpost-orders.v1') || '{}').actions?.length)).toBe(2);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.getByTestId('ground-squad-board').screenshot({path:'test-results/ground-medical-'+width+'.png'});

    await page.reload();
    await expect(page.getByTestId('ground-squad-board')).toBeVisible();
    await expect(page.getByTestId('ground-unit-dorn')).toHaveAttribute('data-grid-x','5');
    await expect(page.getByTestId('ground-unit-mira')).toHaveAttribute('data-grid-x','6');
    await expect(page.getByTestId('mission-phase')).toContainText('RESCATE CONFIRMADO');
    await expect(page.getByTestId('explore-heading')).toContainText('4:5');
    await page.getByTestId('ground-select-mira').click();
    await expect(assist).toBeEnabled();
    await assist.click();
    await expect(page.getByTestId('ground-medical-status')).toContainText('rescate ya consta');
    await expect.poll(()=>page.evaluate(()=>JSON.parse(
      localStorage.getItem('shadowops.star-adventures.outpost-orders.v1') || '{}').actions?.length)).toBe(2);
  });
}
