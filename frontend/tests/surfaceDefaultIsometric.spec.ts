import {expect, test} from '@playwright/test';

// Exercise the real immersive landing path, not the legacy journal layout
// injected by the shared Playwright tactical-view fixture.
test.use({storageState: {cookies: [], origins: []}});

for(const width of [360,390,430,1280,1757]){
  test('desembarco abre equipo isométrico y mantiene cámara clásica como alternativa '+width+'px',async({page})=>{
    test.setTimeout(85_000);
    // A missing/covered control must fail with its locator, not silently
    // consume the entire shard until CI cancels the run.
    page.setDefaultTimeout(10_000);
    await page.setViewportSize({width,height:width===1757?800:850});
    await page.goto('/');
    // Desktop WebGL can initialize under heavy parallel CI load: allow the
    // native bridge control to stabilize without allowing unbounded hangs.
    await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:20_000});
    await page.getByTestId('captain-transport').click({timeout:25_000});
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
    if(width>=1280){
      // On desktop, the service transmission must read like a corner radio,
      // not the 320px sidebar that obscured a large slice of the map.
      const radio=await page.getByTestId('mission-transmission').boundingBox();
      const dorn=await page.getByTestId('ground-unit-dorn').boundingBox();
      expect(radio).not.toBeNull();
      expect(dorn).not.toBeNull();
      expect(radio!.width).toBeLessThanOrEqual(282);
      expect(radio!.height).toBeLessThanOrEqual(178);
      expect(radio!.x).toBeGreaterThan(dorn!.x+dorn!.width);
    }
    // The mobile mission briefing and camera header must never obscure the
    // actual pickable board; this guards the visual regression from the first
    // real 390px screenshot, not merely document horizontal overflow.
    if(width<=430){
      const geometry=await page.evaluate(()=>{
        const briefing=document.querySelector('.mission-transmission')!.getBoundingClientRect();
        const camera=document.querySelector('.ground-squad-viewbar')!.getBoundingClientRect();
        const board=document.querySelector('[data-testid="ground-squad-board"]')!.getBoundingClientRect();
        return {briefingGap:camera.top-briefing.bottom,
          visibleBoard:Math.min(innerHeight,board.bottom)-Math.max(0,board.top)};
      });
      expect(geometry.briefingGap).toBeGreaterThanOrEqual(0);
      expect(geometry.visibleBoard).toBeGreaterThan(170);
      await expect(page.getByText('Controles y ayuda')).toBeVisible();
    }
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

for(const width of [390,1280,1757]){
  test('transmisión de rescate abandonado no muestra scrollbar horizontal '+width+'px',async({page})=>{
    test.setTimeout(75_000);
    page.setDefaultTimeout(10_000);
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
    if(width>=1280){
      // The extraction action must fit without a hidden scroll step, even
      // when the historical save contains the longest mission status.
      const bounds=await tx.evaluate(node=>{
        const radio=node.getBoundingClientRect();
        const action=node.querySelector('[data-testid="abandoned-return"]')!.getBoundingClientRect();
        return {width:radio.width,height:radio.height,
          noVerticalOverflow:node.scrollHeight<=node.clientHeight+1,
          actionFullyInside:action.top>=radio.top&&action.bottom<=radio.bottom};
      });
      expect(bounds.width).toBeLessThanOrEqual(282);
      expect(bounds.height).toBeLessThanOrEqual(178);
      expect(bounds.noVerticalOverflow).toBe(true);
      expect(bounds.actionFullyInside).toBe(true);
    }
    if(width===390||width===1280||width===1757)
      await page.screenshot({path:'test-results/surface-abandoned-no-horizontal-scroll-'+width+'.png'});
    await page.getByTestId('abandoned-return').click();
    await expect(page.getByTestId('explore-area')).toContainText('Puente');
  });
}
