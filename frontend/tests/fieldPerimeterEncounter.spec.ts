import { test, expect, type Page } from '@playwright/test';

async function enterSurface(page: Page) {
  // Actual bridge movement, not a state injection.
  for (const command of ['right', 'forward', 'right', 'use']) {
    await page.getByTestId('explore-' + command).click();
  }
  await page.getByTestId('transport-confirm').click();
  await expect(page.getByTestId('explore-area')).toContainText('Superficie planetaria');
}

async function reachPerimeterUplink(page: Page) {
  // Spawn 4:5 N -> 4:4 E -> 5:4 S -> 5:5 E -> 6:5, facing 7:5.
  for (const command of ['forward', 'right', 'forward', 'right', 'forward', 'left', 'forward']) {
    await page.getByTestId('explore-' + command).click();
  }
  await expect(page.getByTestId('explore-target')).toContainText('Baliza de seguridad');
  await page.getByTestId('explore-use').click();
}

for (const width of [390, 1280]) {
  test(`optional tactical encounter starts at a physical surface uplink and returns to the same tile (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 850 : 900 });
    await page.goto('/');
    await enterSurface(page);
    await expect(page.getByTestId('field-encounter-scene')).toHaveCount(0);
    await reachPerimeterUplink(page);
    await expect(page.getByTestId('field-encounter-scene')).toBeVisible();
    await expect(page.getByTestId('scenario-name')).toHaveText('Evacuación en el cañón');
    await expect(page.getByTestId('scenario-fire-guide')).toContainText('Para disparar');
    await expect(page.getByTestId('scenario-replay-toggle')).toHaveCount(0);
    await expect(page.getByTestId('field-resolution')).toHaveCount(0);
    await expect(page.getByTestId('mission-phase')).toHaveText('MISIÓN EN SUPERFICIE');
    // Reviewable first frame: the board, not a page of explanatory copy,
    // must be onscreen immediately on both mobile and desktop.
    await expect(page.getByTestId('scenario-keyboard')).toBeFocused();
    const board = await page.getByTestId('scenario-render-canvas').boundingBox();
    expect(board).not.toBeNull();
    expect(board!.y).toBeGreaterThanOrEqual(-30);
    expect(board!.y).toBeLessThan(360);
    await expect(page.getByTestId('field-encounter-return')).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/field-contact-${width}.png`, fullPage: false });

    await page.getByTestId('field-encounter-return').click();
    await expect(page.getByTestId('field-encounter-scene')).toHaveCount(0);
    // Returning from a scrolled tactical board must not strand the player
    // halfway down the mobile journal, with exploration offscreen.
    await expect(page.getByTestId('mission-transmission')).toBeInViewport();
    await expect(page.getByTestId('explore-area')).toBeInViewport();
    await expect(page.getByTestId('explore-forward')).toBeFocused();
    await expect(page.getByTestId('explore-heading')).toContainText('6:5');
    await expect(page.getByTestId('explore-target')).toContainText('Baliza de seguridad');
    await expect(page.getByTestId('field-resolution')).toHaveCount(0);

    // Tactical contact is optional. A player who declines it can still save
    // civilians using the existing physical medicine route and real skill check.
    for (const command of ['left', 'left', 'forward', 'right', 'forward', 'right', 'use']) {
      await page.getByTestId('explore-' + command).click();
    }
    await expect(page.getByTestId('medical-report')).toContainText('Evacuación completada');
    await expect(page.getByTestId('mission-phase')).toHaveText('RESCATE CONFIRMADO');
    await page.screenshot({ path: `test-results/field-contact-rescue-${width}.png`, fullPage: false });
  });
}

test('a real tactical ceasefire updates the optional field objective without fabricating a civilian rescue', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 850 });
  await page.goto('/');
  await enterSurface(page);
  await reachPerimeterUplink(page);
  await page.getByTestId('scenario-unit-security').click();
  await page.getByTestId('scenario-accessible-grid').locator('summary').click();

  // Route around the actual canyon barrier in three legal orders, then hail.
  for (const cell of ['1:8', '5:8', '7:8']) {
    await page.getByTestId('scenario-accessible-grid').getByRole('button', { name: 'Casilla ' + cell }).click();
    await expect(page.getByTestId('scenario-move')).toBeEnabled();
    await page.getByTestId('scenario-move').click();
  }
  await expect(page.getByTestId('scenario-ap')).toContainText('0 / 3');
  await page.getByTestId('scenario-end-turn').click();
  await expect(page.getByTestId('scenario-parley')).toBeEnabled();
  await page.getByTestId('scenario-parley').click();
  await expect(page.getByTestId('scenario-truce')).toContainText('Alto el fuego aceptado');
  await expect(page.getByTestId('field-resolution')).toContainText('Alto el fuego negociado');
  await expect(page.getByTestId('mission-phase')).toHaveText('MISIÓN EN SUPERFICIE');
  await expect(page.getByTestId('scenario-combat-result')).toContainText('los civiles aún necesitan asistencia médica');
  await expect(page.getByTestId('scenario-resume-rescue')).toBeVisible();
  await page.screenshot({ path: 'test-results/field-truce-resume-390.png', fullPage: false });
  // A resolved optional encounter must offer an immediate, physical way back
  // to the SAME surface tile. It must not award a rescue or beam out for free.
  await page.getByTestId('scenario-resume-rescue').click();
  await expect(page.getByTestId('explore-heading')).toContainText('6:5');
  await expect(page.getByTestId('medical-report')).toHaveCount(0);
  await expect(page.getByTestId('field-resolution')).toContainText('Alto el fuego negociado');
  await expect(page.getByTestId('field-resolution')).toBeInViewport();
  await expect(page.getByTestId('explore-area')).toBeInViewport();
  await expect(page.getByTestId('explore-forward')).toBeFocused();
  await page.screenshot({ path: 'test-results/field-truce-390.png', fullPage: false });

  // The negotiated contact becomes a distinct, visible outcome of the real
  // evacuation only after medical rescue and physical return to the bridge.
  for (const command of ['left', 'left', 'forward', 'right', 'forward', 'right', 'use']) {
    await page.getByTestId('explore-' + command).click();
  }
  await expect(page.getByTestId('mission-phase')).toHaveText('RESCATE CONFIRMADO');
  for (const command of ['right', 'forward', 'right', 'forward', 'left', 'use']) {
    await page.getByTestId('explore-' + command).click();
  }
  await page.getByTestId('transport-confirm').click();
  await expect(page.getByTestId('mission-phase')).toHaveText('REGRESO AL PUENTE');
  await expect(page.getByTestId('mission-perimeter-outcome')).toContainText('Tregua negociada');
  await expect(page.getByTestId('mission-return-report')).toContainText('Civiles a salvo');
  await page.screenshot({ path: 'test-results/mission-debrief-truce-390.png', fullPage: false });
});
