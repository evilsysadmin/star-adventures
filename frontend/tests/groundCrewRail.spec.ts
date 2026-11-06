import {expect,test} from '@playwright/test';

// Actual captain -> transport -> fullscreen landing, not a mocked roster or
// the journal/classic storage fixture. Button IDs remain unique across the HUD.
test.use({storageState:{cookies:[],origins:[]}});

for(const width of [360,390,430,1280,1757]){
  test('compact crew rail and one-row orders preserve real selection at '+width+'px',async({page})=>{
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
    for(const id of ['venn','dorn','mira'])
      await expect(page.getByTestId('ground-select-'+id)).toHaveCount(1);
    await expect(rail).toContainText('Nara Venn');
    await expect(rail).toContainText('Kael Dorn');
    await expect(rail).toContainText('Isa Mira');
    await expect(rail).toContainText('Oficial científica');
    await expect(rail).toContainText('Oficial táctico');
    await expect(rail).toContainText('Médica jefe');

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
        dock:{top:dock.top,bottom:dock.bottom,width:dock.width,height:dock.height},
        status:{top:status.top,bottom:status.bottom,height:status.height},
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
      expect(layout.rail.width).toBeLessThanOrEqual(175);
      expect(layout.rail.height).toBeLessThan(210);
      expect(layout.dock.height).toBeLessThan(58);
      expect(layout.dock.width).toBeLessThan(500);
      expect(layout.status.bottom).toBeLessThan(layout.dock.top);
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
