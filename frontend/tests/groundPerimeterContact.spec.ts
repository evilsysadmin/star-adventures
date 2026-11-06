import {expect,test,type Page} from '@playwright/test';

// This is the real surface encounter: no laboratory shortcuts, simulated
// station flags, or move of the independent classic-camera group anchor.
test.use({storageState:{cookies:[],origins:[]}});

async function moveOnGround(page:Page,x:number,y:number){
  const board=page.getByTestId('ground-squad-board');
  const local=await board.evaluate((element,cell)=>{
    const svg=element as SVGSVGElement,point=svg.createSVGPoint();
    point.x=440+(cell.x-cell.y)*40;
    point.y=52+(cell.x+cell.y)*20;
    const ctm=svg.getScreenCTM();
    if(!ctm)throw Error('No surface camera CTM');
    const pixel=point.matrixTransform(ctm),rect=svg.getBoundingClientRect();
    return {x:pixel.x-rect.left,y:pixel.y-rect.top};
  },{x,y});
  await board.click({button:'right',position:local});
}

for(const width of [360,390,1280]){
  test('real selected officer contacts perimeter and resumes tactical checkpoint after F5 '+width+'px',async({page})=>{
    test.setTimeout(140_000);
    page.setDefaultTimeout(18_000);
    await page.setViewportSize({width,height:850});
    await page.goto('/');
    await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:25_000});
    await page.getByTestId('captain-transport').click({timeout:25_000});
    await page.getByTestId('transport-confirm').click();
    const board=page.getByTestId('ground-squad-board');
    await expect(board).toBeVisible();
    await expect(page.getByTestId('ground-perimeter-contact')).toHaveCount(0);

    // Only a real nearby operator unlocks this contextual sixth command.
    await page.getByTestId('ground-select-mira').click();
    await moveOnGround(page,7,6);
    const mira=page.getByTestId('ground-unit-mira');
    await expect(mira).toHaveAttribute('data-grid-x','7');
    await expect(mira).toHaveAttribute('data-grid-y','6');
    await expect(mira).toHaveAttribute('data-walk-phase','idle',{timeout:20_000});
    const contact=page.getByTestId('ground-perimeter-contact');
    await expect(contact).toBeVisible();
    await expect(contact).toBeEnabled();
    await page.getByTestId('ground-select-venn').click();
    await expect(contact).toHaveCount(0);
    await page.getByTestId('ground-select-mira').click();
    await expect(contact).toBeVisible();

    const layout=await page.evaluate(()=>{
      const dock=document.querySelector('.ground-squad-toolbar')!.getBoundingClientRect();
      const rail=document.querySelector('[data-testid="ground-crew-rail"]')!.getBoundingClientRect();
      return {dockHeight:dock.height,dockBottom:dock.bottom,railTop:rail.top,
        overflow:document.documentElement.scrollWidth>innerWidth,
        six:document.querySelectorAll('.ground-squad-toolbar button').length};
    });
    expect(layout.six).toBe(6);
    expect(layout.overflow).toBe(false);
    if(width<700){
      expect(layout.dockHeight).toBeLessThan(65);
      expect(layout.dockBottom).toBeLessThanOrEqual(850);
      expect(layout.railTop).toBeGreaterThan(0);
    }
    await page.screenshot({path:'test-results/away-perimeter-contact-'+width+'.png'});
    await contact.click();
    await expect(page.getByTestId('field-encounter-scene')).toBeVisible();
    await expect(page.getByTestId('scenario-name')).toHaveText('Evacuación en el cañón');
    await expect(page.getByTestId('mission-phase')).toHaveText('MISIÓN EN SUPERFICIE');
    await expect(page.getByTestId('field-resolution')).toHaveCount(0);
    // A fresh refresh must use the validated saved squad cell, because the
    // classic surface camera has never left its own 4:5 anchor.
    await page.reload();
    await expect(page.getByTestId('field-encounter-scene')).toBeVisible();
    await expect(page.getByTestId('scenario-name')).toHaveText('Evacuación en el cañón');
    await page.getByTestId('field-encounter-return').click();
    await expect(page.getByTestId('field-encounter-scene')).toHaveCount(0);
    await expect(board).toBeVisible();
    await expect(page.getByTestId('ground-unit-mira')).toHaveAttribute('data-grid-x','7');
    await expect(page.getByTestId('ground-unit-mira')).toHaveAttribute('data-grid-y','6');
    await expect(page.getByTestId('explore-heading')).toContainText('4:5');
    await expect(page.getByTestId('mission-phase')).toHaveText('MISIÓN EN SUPERFICIE');
    // Resuming the optional encounter must reuse its already stored history.
    await page.getByTestId('ground-select-mira').click();
    await page.getByTestId('ground-perimeter-contact').click();
    await expect(page.getByTestId('field-encounter-scene')).toBeVisible();
    await expect(page.getByTestId('scenario-turn')).toContainText('Ronda 1');
  });
}
