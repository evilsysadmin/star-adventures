import {expect,test,type Page} from '@playwright/test';

test.use({storageState:{cookies:[],origins:[]}});

async function land(page:Page){
  await page.goto('/');
  await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:25000});
  await page.getByTestId('captain-transport').click();
  await page.getByTestId('transport-confirm').click();
  await expect(page.getByTestId('ground-squad-board')).toBeVisible();
}

for(const width of [360,390,430]){
  test('mobile surface briefing leaves map readable but actions available '+width,async({page})=>{
    test.setTimeout(100_000);
    await page.setViewportSize({width,height:850});
    await land(page);

    const mission=page.getByTestId('mission-transmission');
    const toggle=page.getByTestId('mission-brief-toggle');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded','false');
    await expect(mission).toHaveAttribute('data-brief-expanded','false');
    await expect(page.getByTestId('mission-phase')).toHaveText('MISIÓN EN SUPERFICIE');
    await expect(page.getByTestId('mission-next')).toContainText('puesto de socorro');
    await expect(mission.locator('.mission-transmission-story')).toBeHidden();
    await expect(page.getByTestId('mission-abandon')).toBeHidden();
    const collapsed=await mission.boundingBox();
    expect(collapsed).not.toBeNull();
    expect(collapsed!.width).toBeLessThanOrEqual(170);
    expect(collapsed!.height).toBeLessThanOrEqual(110);
    await page.screenshot({path:'test-results/away-brief-compact-'+width+'.png'});

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded','true');
    await expect(mission).toHaveAttribute('data-brief-expanded','true');
    await expect(mission.locator('.mission-transmission-story')).toBeVisible();
    await expect(page.getByTestId('mission-abandon')).toBeVisible();
    await expect(mission.locator('.mission-transmission-route')).toBeVisible();
    const expanded=await mission.boundingBox();
    expect(expanded).not.toBeNull();
    expect(expanded!.width).toBeGreaterThan(collapsed!.width);
    expect(expanded!.x+expanded!.width).toBeLessThanOrEqual(width+1);
    await page.screenshot({path:'test-results/away-brief-expanded-'+width+'.png'});

    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded','false');
    await expect(page.getByTestId('mission-abandon')).toBeHidden();
    await expect(page.getByTestId('ground-squad-board').locator('polygon[data-cell-id]')).toHaveCount(216);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.reload();
    await expect(toggle).toHaveAttribute('aria-expanded','false');
  });
}

test('desktop surface and mobile bridge keep the full mission controls',async({page})=>{
  test.setTimeout(100_000);
  await page.setViewportSize({width:390,height:850});
  await page.goto('/');
  await expect(page.getByTestId('mission-brief-toggle')).toBeHidden();
  await expect(page.getByTestId('mission-abandon')).toBeVisible();
  await page.setViewportSize({width:1280,height:850});
  await land(page);
  await expect(page.getByTestId('mission-brief-toggle')).toBeHidden();
  await expect(page.getByTestId('mission-abandon')).toBeVisible();
  await expect(page.getByTestId('mission-next')).toContainText('puesto de socorro');
});
