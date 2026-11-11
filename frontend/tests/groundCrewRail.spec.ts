import {expect,test} from '@playwright/test';

// Actual captain -> transport -> fullscreen landing, not a mocked roster or
// the journal/classic storage fixture. Button IDs remain unique across the HUD.
test.use({storageState:{cookies:[],origins:[]}});

for(const width of [360,390,430,1280,1757]){
  test('authored tactical command frame preserves real selection at '+width+'px',async({page})=>{
    test.setTimeout(100_000);
    page.setDefaultTimeout(15_000);
    const height=width===1757?800:850;
    await page.setViewportSize({width,height});
    await page.goto('/');
    await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:20_000});
    await page.getByTestId('captain-transport').click({timeout:25_000});
    await page.getByTestId('transport-confirm').click();
    const board=page.getByTestId('ground-squad-board');
    const rail=page.getByTestId('ground-crew-rail');
    const dock=page.locator('.ground-squad-toolbar');
    const status=page.locator('.ground-squad-event-strip');
    await expect(board).toBeVisible();
    await expect(rail).toBeVisible();
    await expect(dock).toBeInViewport();
    await expect(page.getByTestId('ground-current-notice')).toBeVisible();
    if(width<=700){
      const selection=page.getByTestId('ground-selection-status');
      const notice=page.getByTestId('ground-current-notice');
      await expect(selection).toHaveCSS('font-size','11px');
      await expect(notice).toHaveCSS('font-size','11px');
      await expect(notice).toHaveCSS('-webkit-line-clamp','2');
      await expect(notice).toContainText('Selecciona un oficial');
      const geometry=await page.evaluate(()=>{
        const rect=(selector:string)=>document.querySelector(selector)!.getBoundingClientRect();
        const info=rect('.ground-squad-event-strip');
        const help=rect('.ground-squad-instructions');
        const crew=rect('[data-testid="ground-crew-rail"]');
        const dock=rect('.ground-squad-toolbar');
        return {
          statusHeight:info.height,
          helpGap:info.top-help.bottom,
          crewGap:crew.top-info.bottom,
          toolbarGap:dock.top-crew.bottom,
        };
      });
      expect(geometry.statusHeight).toBeGreaterThanOrEqual(31);
      expect(geometry.statusHeight).toBeLessThanOrEqual(38);
      expect(geometry.helpGap).toBeGreaterThanOrEqual(0);
      expect(geometry.crewGap).toBeGreaterThanOrEqual(0);
      expect(geometry.toolbarGap).toBeGreaterThanOrEqual(0);
      await page.screenshot({path:'test-results/away-mobile-readable-status-'+width+'.png'});
    }
    for(const id of ['venn','dorn','mira'])
      await expect(page.getByTestId('ground-select-'+id)).toHaveCount(1);
    await expect(rail).toContainText('Nara Venn');
    await expect(rail).toContainText('Kael Dorn');
    await expect(rail).toContainText('Isa Mira');
    await expect(rail).toContainText('Oficial científica');
    await expect(rail).toContainText('Oficial táctico');
    await expect(rail).toContainText('Médica jefe');
    // Original vector portraits render inside the existing accessible button,
    // without third-party image requests or extra focus/click targets.
    await expect(rail.locator('svg[data-testid^="ground-crew-portrait-art-"]')).toHaveCount(3);
    for (const id of ['venn','dorn','mira']) {
      const portrait=page.getByTestId('ground-crew-portrait-art-'+id);
      await expect(portrait).toBeVisible();
      const bounds=await portrait.boundingBox();
      expect(bounds?.width).toBeGreaterThan(15);
      expect(bounds?.height).toBeGreaterThan(18);
      await expect(portrait.locator('image')).toHaveCount(0);
    }

    const layout=await page.evaluate(()=>{
      const rect=(selector:string)=>document.querySelector(selector)!.getBoundingClientRect();
      const rail=rect('[data-testid="ground-crew-rail"]');
      const dock=rect('.ground-squad-toolbar');
      const status=rect('.ground-squad-event-strip');
      const help=rect('.ground-squad-instructions');
      const camera=rect('.ground-squad-viewbar');
      const dornName=rect('[data-testid="ground-unit-dorn"] text.ground-unit-name');
      const scene=rect('[data-testid="ground-squad-board"]');
      return {rail:{left:rail.left,top:rail.top,bottom:rail.bottom,width:rail.width,height:rail.height},
        dock:{left:dock.left,right:dock.right,top:dock.top,bottom:dock.bottom,width:dock.width,height:dock.height},
        status:{left:status.left,top:status.top,bottom:status.bottom,height:status.height},
        help:{top:help.top,bottom:help.bottom,width:help.width},
        camera:{right:camera.right,bottom:camera.bottom,width:camera.width},
        dornName:{left:dornName.left,top:dornName.top},
        sceneWidth:scene.width,sceneHeight:scene.height,
        overflow:document.documentElement.scrollWidth>innerWidth};
    });
    expect(layout.overflow).toBe(false);
    expect(layout.sceneWidth).toBeGreaterThanOrEqual(width-2);
    expect(layout.sceneHeight).toBeGreaterThanOrEqual(height-2);
    expect(layout.dock.bottom).toBeLessThanOrEqual(height);
    expect(layout.rail.top).toBeGreaterThanOrEqual(0);
    if(width>700){
      // Desktop is now an actual command frame: three readable portraits
      // down the left; a two-row order console and status docked alongside.
      expect(layout.rail.width).toBeLessThanOrEqual(175);
      expect(layout.rail.height).toBeGreaterThan(390);
      expect(layout.rail.height).toBeLessThan(550);
      expect(layout.dock.height).toBeGreaterThan(100);
      expect(layout.dock.height).toBeLessThan(155);
      expect(layout.dock.width).toBeLessThan(440);
      expect(layout.status.top).toBeGreaterThanOrEqual(layout.dock.top-5);
      expect(layout.status.left).toBeGreaterThan(layout.dock.right+10);
      expect(layout.status.bottom).toBeLessThanOrEqual(height);
      expect(layout.help.top).toBeGreaterThanOrEqual(layout.rail.bottom);
    }else{
      expect(layout.rail.height).toBeLessThan(68);
      expect(layout.dock.height).toBeLessThan(61);
      expect(layout.status.height).toBeLessThan(38);
      expect(layout.status.bottom).toBeLessThanOrEqual(layout.rail.top+3);
      expect(layout.rail.bottom).toBeLessThanOrEqual(layout.dock.top+5);
      expect(layout.help.bottom).toBeLessThanOrEqual(layout.status.top+4);
      expect(layout.camera.width).toBeLessThan(165);
      expect(layout.camera.right<layout.dornName.left || layout.camera.bottom<layout.dornName.top).toBe(true);
    }

    await page.getByTestId('ground-select-dorn').click();
    await expect(page.getByTestId('ground-select-dorn')).toHaveAttribute('aria-pressed','true');
    await expect(page.getByTestId('ground-select-venn')).toHaveAttribute('aria-pressed','false');
    await page.getByTestId('ground-selection-additive').click();
    await page.getByTestId('ground-select-mira').click();
    await expect(page.getByTestId('ground-selection-status')).toContainText('2 de 3');
    await page.getByTestId('ground-selection-additive').click();
    await page.getByTestId('ground-select-all').click();
    await expect(page.getByTestId('ground-selection-status')).toContainText('Todo el equipo');
    await page.getByTestId('ground-select-venn').click();
    await board.locator('[data-cell-id="2,4"]').click({button:'right'});
    await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-x','2');
    await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-y','4');
    await expect(page.getByTestId('ground-current-notice')).toContainText('2:4');
    await page.screenshot({path:'test-results/away-crew-rail-'+width+'.png'});
    await page.reload();
    await expect(board).toBeVisible();
    await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-x','2');
  });
}
