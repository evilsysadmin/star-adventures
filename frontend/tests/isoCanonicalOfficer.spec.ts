import { test, expect } from '@playwright/test';
import { createIsoCamera } from '../src/tacticalIsoCamera';
import { projectCell } from '../src/tacticalGrid';

for (const width of [390, 1280]) {
  test(`canonical 3D science officer visibly turns at route corners and preserves grid picking at ${width}px`, async ({page}) => {
    test.setTimeout(70_000);
    await page.setViewportSize({width, height:850});
    await page.goto('/');
    await page.getByTestId('tactical-view-missions').click();
    const canvas=page.getByTestId('scenario-render-canvas');
    await expect(canvas).toBeVisible();
    await expect(canvas).toHaveAttribute('data-canonical-officer','science');
    await expect(canvas).toHaveAttribute('data-canonical-pose','idle');
    await canvas.screenshot({path:`test-results/canonical-officer-idle-${width}.png`});

    await page.getByTestId('scenario-accessible-grid').locator('summary').click();
    await page.getByRole('button',{name:'Casilla 3:2'}).click();
    await expect(page.getByTestId('scenario-move')).toBeEnabled();
    await page.getByTestId('scenario-move').click();
    await expect(canvas).toHaveAttribute('data-canonical-pose','walk');
    await expect(canvas).toHaveAttribute('data-canonical-facing',String(Math.PI/2));
    await canvas.screenshot({path:`test-results/canonical-officer-walk-${width}.png`});
    await expect(canvas).toHaveAttribute('data-squad-moving','0',{timeout:7000});
    await expect(canvas).toHaveAttribute('data-canonical-pose','idle');
    // The third orthogonal segment turns south; a billboard could not do this.
    await expect(canvas).toHaveAttribute('data-canonical-facing','0');
    await expect(page.getByTestId('scenario-unit-science')).toContainText('3:2');
    await canvas.screenshot({path:`test-results/canonical-officer-turned-${width}.png`});

    await canvas.scrollIntoViewIfNeeded();
    const box=(await canvas.boundingBox())!;
    const p=projectCell({id:'3:3',col:3,row:3},
      createIsoCamera(box.width/box.height,10),
      {left:box.x,top:box.y,width:box.width,height:box.height},10);
    await page.mouse.click(p.x,p.y);
    await expect(page.getByTestId('scenario-selected')).toHaveText('3:3');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}
