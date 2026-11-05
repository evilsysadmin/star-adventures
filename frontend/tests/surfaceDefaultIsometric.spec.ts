import {expect, test} from '@playwright/test';

for(const width of [360,390,430,1280,1757]){
  test('desembarco abre equipo isométrico y mantiene cámara clásica como alternativa '+width+'px',async({page})=>{
    test.setTimeout(85_000);
    await page.setViewportSize({width,height:width===1757?800:850});
    await page.goto('/');
    await page.getByTestId('captain-transport').click();
    await page.getByTestId('transport-confirm').click();
    await expect(page.getByTestId('explore-area')).toContainText('Superficie');
    // The *first* rendered surface view must already be the real squad board.
    await expect(page.getByTestId('ground-squad-board')).toBeVisible();
    await expect(page.getByTestId('ground-unit-venn')).toBeVisible();
    await expect(page.getByTestId('ground-unit-dorn')).toBeVisible();
    await expect(page.getByTestId('ground-unit-mira')).toBeVisible();
    await expect(page.getByTestId('ground-squad-toggle')).toHaveText('Exploración clásica');
    await expect(page.getByTestId('explore-forward')).toHaveCount(0);
    await expect(page.getByTestId('ground-inspect-probe')).toBeVisible();
    await expect(page.getByTestId('ground-assist-civilians')).toBeVisible();
    // At 1757x800 the map must not grow vertically and hide the command bar.
    if(width>=1280){
      await expect(page.getByTestId('ground-move-mode')).toBeInViewport();
      await expect(page.getByTestId('ground-inspect-probe')).toBeInViewport();
    }
    if(width===390||width===1280||width===1757)
      await page.screenshot({path:'test-results/surface-default-squad-'+width+'.png'});

    // Explicit rollback remains a usable playable surface camera, not a fake
    // back button. Turning the legacy camera must not delete individual saves.
    await page.getByTestId('ground-squad-toggle').click();
    await expect(page.getByTestId('ground-squad-toggle')).toHaveText('Volver al equipo');
    await expect(page.getByTestId('compatible-firstperson-canvas')).toBeVisible();
    await page.getByTestId('explore-left').click();
    await page.getByTestId('ground-squad-toggle').click();
    await expect(page.getByTestId('ground-squad-board')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('ground-squad-board')).toBeVisible();
    await expect(page.getByTestId('ground-squad-toggle')).toHaveText('Exploración clásica');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}

for(const width of [390,1280]){
  test('transmisión de rescate abandonado no muestra scrollbar horizontal '+width+'px',async({page})=>{
    test.setTimeout(75_000);
    await page.setViewportSize({width,height:850});
    await page.goto('/');
    await page.getByTestId('captain-transport').click();
    await page.getByTestId('transport-confirm').click();
    await expect(page.getByTestId('ground-squad-board')).toBeVisible();
    // Reproduce exactly a persisted legacy surface save with refused rescue.
    await expect.poll(()=>page.evaluate(()=>localStorage.getItem('shadowops.star-adventures.spatial.v1'))).toContain('surface');
    await page.evaluate(()=>localStorage.setItem('shadowops.star-adventures.outpost-orders.v1',JSON.stringify({
      saveVersion:1,mandateId:'outpost-orders',actions:[
        {type:'record',incidentId:'rescue-abandoned',orderId:'evacuate',kind:'refusal',witnesses:[],public:true},
        {type:'resolve',orderId:'evacuate',incidentId:'rescue-abandoned',status:'refused'},
      ],
    })));
    await page.reload();
    await expect(page.getByTestId('mission-phase')).toContainText('RESCATE ABANDONADO');
    await expect(page.getByTestId('ground-squad-board')).toBeVisible();
    const tx=page.locator('.mission-transmission');
    await expect.poll(()=>tx.evaluate(node=>({
      noHorizontalOverflow:node.scrollWidth<=node.clientWidth+1,
      overflowX:getComputedStyle(node).overflowX,
    }))).toEqual({noHorizontalOverflow:true,overflowX:'hidden'});
    await page.getByTestId('abandoned-return').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('abandoned-return')).toBeVisible();
    if(width===390||width===1280)
      await page.screenshot({path:'test-results/surface-abandoned-no-horizontal-scroll-'+width+'.png'});
    await page.getByTestId('abandoned-return').click();
    await expect(page.getByTestId('explore-area')).toContainText('Puente');
  });
}
