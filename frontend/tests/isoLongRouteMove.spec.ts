import { test, expect, type Page } from '@playwright/test';
import { createIsoCamera } from '../src/tacticalIsoCamera';
import { projectCell } from '../src/tacticalGrid';

async function tapCell(page: Page, id: string) {
  const canvas = page.getByTestId('scenario-render-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const [col,row] = id.split(':').map(Number);
  const point = projectCell({id,col,row},
    createIsoCamera(box!.width / box!.height, 12, 3.18),
    {left:box!.x,top:box!.y,width:box!.width,height:box!.height}, 12);
  await page.mouse.click(point.x,point.y);
}

for (const width of [390, 1280]) {
  test(`far derelict destination walks in successive real stages at ${width}px`, async ({page}) => {
    test.setTimeout(90_000);
    await page.setViewportSize({width,height:850});
    await page.goto('/');
    await page.getByTestId('tactical-view-missions').click();
    await page.getByTestId('scenario-play-combat').click();
    await page.getByTestId('scenario-tab-derelict').click();
    const canvas = page.getByTestId('scenario-render-canvas');
    await expect(canvas).toBeVisible();
    await expect(page.getByTestId('scenario-unit-science')).toContainText('1:1');

    // A real fixture blocks this console tile; selecting it must not move.
    await tapCell(page,'9:9');
    await expect(page.getByTestId('scenario-selected')).toHaveText('9:9');
    await expect(page.getByTestId('scenario-move')).toBeDisabled();
    await expect(page.getByTestId('scenario-ap')).toContainText('3 / 3');

    // First tap selects a distant reachable tile, with no hidden movement.
    await tapCell(page,'10:9');
    await expect(page.getByTestId('scenario-selected')).toHaveText('10:9');
    await expect(page.getByTestId('scenario-route')).toContainText('17 casillas · avanza por tramos de 5');
    await expect(page.getByTestId('scenario-move')).toContainText('Avanzar 5 casillas hacia 10:9');
    await expect(page.getByTestId('scenario-move')).toBeEnabled();
    await expect(page.getByTestId('scenario-ap')).toContainText('3 / 3');
    await canvas.screenshot({path:`test-results/derelict-far-route-selected-${width}.png`});

    // Second tap spends one AP and physically walks five real BFS cells.
    await tapCell(page,'10:9');
    await expect(page.getByTestId('scenario-unit-science')).toContainText('4:3');
    await expect(page.getByTestId('scenario-ap')).toContainText('2 / 3');
    await expect(canvas).toHaveAttribute('data-squad-route-length','5');
    await expect(canvas).toHaveAttribute('data-squad-moving','1',{timeout:3000});
    await canvas.screenshot({path:`test-results/derelict-first-stage-walking-${width}.png`});
    await expect(canvas).toHaveAttribute('data-squad-moving','0',{timeout:8000});
    await expect(page.getByTestId('scenario-selected')).toHaveText('10:9');
    await expect(page.getByTestId('scenario-route')).toContainText('12 casillas');
    await canvas.screenshot({path:`test-results/derelict-first-stage-arrived-${width}.png`});

    // A further tap on the SAME target continues from the new real cell.
    await tapCell(page,'10:9');
    await expect(page.getByTestId('scenario-unit-science')).toContainText('6:6');
    await expect(page.getByTestId('scenario-ap')).toContainText('1 / 3');
    await expect(canvas).toHaveAttribute('data-squad-route-length','5');
    await expect(canvas).toHaveAttribute('data-squad-moving','1',{timeout:3000});
    await expect(canvas).toHaveAttribute('data-squad-moving','0',{timeout:8000});
    await expect(page.getByTestId('scenario-selected')).toHaveText('10:9');
    await page.screenshot({path:`test-results/derelict-two-legal-stages-${width}.png`,fullPage:true});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
