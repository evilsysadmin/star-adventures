import {expect,test} from '@playwright/test';

test.use({storageState:{cookies:[],origins:[]}});

for(const width of [390,1280]){
  test('planetary command frame preserves authentic UI and picking '+width,async({page})=>{
    test.setTimeout(100_000);
    await page.setViewportSize({width,height:850});
    await page.goto('/');
    await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:25000});
    await page.getByTestId('captain-transport').click();
    await page.getByTestId('transport-confirm').click();
    const stage=page.getByTestId('ground-squad-board');
    await expect(stage).toBeVisible();
    const crew=page.getByTestId('ground-crew-rail');
    const toolbar=page.locator('.firstperson-is-squad .ground-squad-toolbar');
    const mission=page.getByTestId('mission-transmission');
    const consoleArea=page.locator('.firstperson-is-squad .ground-squad-event-strip');
    await expect(crew).toBeVisible();
    await expect(toolbar).toBeVisible();
    await expect(mission).toBeVisible();
    const [crewRect,toolbarRect,missionRect,consoleRect]=await Promise.all([
      crew.boundingBox(),toolbar.boundingBox(),mission.boundingBox(),
      consoleArea.boundingBox()
    ]);
    if(!crewRect||!toolbarRect||!missionRect||!consoleRect)
      throw new Error('Missing real tactical frame');
    if(width>=1100){
      // The full-size mock-inspired layout anchors crew to the left and the
      // functional command console across the bottom without cloning inputs.
      expect(crewRect.x).toBeLessThan(17);
      expect(crewRect.width).toBeGreaterThan(140);
      expect(crewRect.y).toBeGreaterThan(65);
      expect(crewRect.y+crewRect.height).toBeLessThan(toolbarRect.y);
      expect(toolbarRect.x).toBeLessThan(17);
      expect(toolbarRect.width).toBeGreaterThan(380);
      expect(toolbarRect.y).toBeGreaterThan(690);
      expect(consoleRect.x).toBeGreaterThan(toolbarRect.x+toolbarRect.width+10);
      expect(missionRect.x).toBeGreaterThan(940);
      // Desktop's real transmission now docks in the lower-right service
      // berth, below the station titles and above the command console.
      expect(missionRect.y).toBeGreaterThan(275);
      expect(missionRect.y+missionRect.height).toBeLessThan(consoleRect.y-10);
      const portraits=await crew.locator('.ground-squad-crew-portrait').all();
      expect(portraits).toHaveLength(3);
      for(const portrait of portraits){
        const bounds=await portrait.boundingBox();
        expect(bounds?.height??0).toBeGreaterThan(77);
      }
    }else{
      // Keep phone-sized interaction compact and usable; the desktop rail
      // must never force horizontal scroll or bury the move button.
      expect(crewRect.width).toBeLessThan(width-8);
      expect(toolbarRect.width).toBeLessThan(width-8);
      await expect(page.getByTestId('ground-move-mode')).toBeVisible();
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
      .toBe(true);
    await stage.screenshot({path:'test-results/away-command-stage-'+width+'.png'});
    await page.screenshot({path:'test-results/away-command-frame-'+width+'.png'});
    // The left-side portraits still select REAL officers and the board
    // remains the only source of legal movement targets.
    await page.getByTestId('ground-select-dorn').click();
    await expect(page.getByTestId('ground-select-dorn')).toHaveAttribute('aria-pressed','true');
    await expect(stage.locator('[data-cell-id]')).toHaveCount(216);
  });
}
