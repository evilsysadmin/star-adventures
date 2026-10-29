import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { PERIMETER_SAVE_KEY } from '../src/perimeterSession';
import { serializeCombatReplay } from '../src/isoScenarioCombatReplay';
import { CHECKPOINT_KEY, SPATIAL_CHECKPOINT_KEY } from '../src/session';
import { serializeSpatialCheckpoint } from '../../src/spatialCheckpoint.mjs';
const world = JSON.parse(readFileSync(new URL('../../content/scenes/meridian.json', import.meta.url), 'utf8'));

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
    // The independently lazy-loaded renderer can mount after its keyboard
    // wrapper gains focus; require the actual canvas before measuring it.
    await expect(page.getByTestId('scenario-render-canvas')).toBeVisible();
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

for (const width of [390, 1280]) {
test(`a real tactical ceasefire updates the optional field objective without fabricating a civilian rescue (${width}px)`, async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width, height: width === 390 ? 850 : 900 });
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
  await page.reload();
  await expect(page.getByTestId('field-encounter-scene')).toBeVisible();
  await expect(page.getByTestId('scenario-truce')).toContainText('Alto el fuego aceptado');
  await expect(page.getByTestId('field-resolution')).toContainText('Alto el fuego negociado');
  await expect(page.getByTestId('scenario-unit-security')).toContainText('7:8');
  await expect(page.getByTestId('scenario-combat-retry')).toHaveCount(0);
  await page.getByTestId('scenario-resume-rescue').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `test-results/field-truce-resume-${width}.png`, fullPage: false });
  // A resolved optional encounter must offer an immediate, physical way back
  // to the SAME surface tile. It must not award a rescue or beam out for free.
  await page.getByTestId('scenario-resume-rescue').click();
  await expect(page.getByTestId('explore-heading')).toContainText('6:5');
  await expect(page.getByTestId('medical-report')).toHaveCount(0);
  await expect(page.getByTestId('field-resolution')).toContainText('Alto el fuego negociado');
  await expect(page.getByTestId('field-resolution')).toBeInViewport();
  await expect(page.getByTestId('explore-area')).toBeInViewport();
  await expect(page.getByTestId('explore-forward')).toBeFocused();
  await page.reload();
  await expect(page.getByTestId('field-encounter-scene')).toHaveCount(0);
  await expect(page.getByTestId('explore-heading')).toContainText('6:5');
  await expect(page.getByTestId('field-resolution')).toContainText('Alto el fuego negociado');
  await page.getByTestId('explore-use').click();
  await expect(page.getByTestId('field-encounter-scene')).toHaveCount(0);
  await expect(page.getByTestId('explore-feedback')).toContainText('perímetro ya está resuelto');
  await page.screenshot({ path: `test-results/field-truce-${width}.png`, fullPage: false });

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
  await page.reload();
  await expect(page.getByTestId('mission-perimeter-outcome')).toContainText('Tregua negociada');
  await page.screenshot({ path: `test-results/mission-debrief-truce-${width}.png`, fullPage: false });
  // Replaying a rescue is a new run, not an opportunity to inherit the ceasefire.
  await page.getByTestId('mission-replay').click();
  await page.reload();
  await expect(page.getByTestId('mission-phase')).toHaveText('TRANSMISIÓN ENTRANTE');
  await expect(page.getByTestId('field-resolution')).toHaveCount(0);
  await enterSurface(page);
  await reachPerimeterUplink(page);
  await expect(page.getByTestId('scenario-turn')).toContainText('Ronda 1');
  await expect(page.getByTestId('scenario-unit-security')).toContainText('1:3');
  await expect(page.getByTestId('scenario-hostile-aegis')).toContainText('PV 2/2');
  await expect(page.getByTestId('scenario-truce')).toHaveCount(0);
});
}

test('a wounded physical squad resumes after F5 and after deliberately pausing the encounter', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 850 });
  await page.goto('/');
  await enterSurface(page);
  await reachPerimeterUplink(page);
  await page.getByTestId('scenario-unit-security').click();
  await page.getByTestId('scenario-accessible-grid').locator('summary').click();
  for (const cell of ['1:8', '5:8', '7:8']) {
    await page.getByRole('button', { name: 'Casilla ' + cell, exact: true }).click();
    await page.getByTestId('scenario-move').click();
  }
  await page.getByTestId('scenario-end-turn').click();
  await expect(page.getByTestId('scenario-unit-security')).toContainText('PV 2 / 3');
  await page.reload();
  await expect(page.getByTestId('field-encounter-scene')).toBeVisible();
  await expect(page.getByTestId('scenario-unit-security')).toContainText('7:8');
  await expect(page.getByTestId('scenario-unit-security')).toContainText('PV 2 / 3');
  await expect(page.getByTestId('scenario-turn')).toContainText('Ronda 2');
  await expect(page.getByTestId('scenario-ap')).toContainText('3 / 3');
  await expect(page.getByTestId('field-resolution')).toHaveCount(0);
  await page.getByTestId('field-encounter-return').click();
  await page.reload();
  await expect(page.getByTestId('field-encounter-scene')).toHaveCount(0);
  await expect(page.getByTestId('explore-heading')).toContainText('6:5');
  await page.getByTestId('explore-use').click();
  await expect(page.getByTestId('scenario-unit-security')).toContainText('7:8');
  await expect(page.getByTestId('scenario-unit-security')).toContainText('PV 2 / 3');
  await expect(page.getByTestId('scenario-turn')).toContainText('Ronda 2');
  await page.getByTestId('scenario-render-canvas').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/perimeter-injury-restored-390.png', fullPage: false });
});

test('physical combat victory and enemy damage survive refresh without awarding the medical rescue', async ({ page }) => {
  test.setTimeout(75_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await enterSurface(page);
  await reachPerimeterUplink(page);
  await page.getByTestId('scenario-unit-security').click();
  await page.getByTestId('scenario-accessible-grid').locator('summary').click();
  const move = async (cell: string) => {
    await page.getByRole('button', { name: 'Casilla ' + cell, exact: true }).click();
    await page.getByTestId('scenario-move').click();
  };
  for (const cell of ['1:8', '5:8', '7:8']) await move(cell);
  await page.getByTestId('scenario-end-turn').click();
  await page.getByTestId('scenario-hostile-aegis').click();
  await page.getByTestId('scenario-fire-order').click();
  await page.getByTestId('scenario-fire-order').click();
  await move('9:8');
  await page.getByTestId('scenario-end-turn').click();
  await page.getByTestId('scenario-hostile-veil').click();
  await page.getByTestId('scenario-fire-order').click();
  await page.getByTestId('scenario-fire-order').click();
  await expect(page.getByTestId('field-resolution')).toContainText('Amenazas neutralizadas');
  await page.reload();
  await expect(page.getByTestId('scenario-combat-result')).toContainText('Perímetro asegurado');
  await expect(page.getByTestId('scenario-hostile-aegis')).toContainText('PV 0/2');
  await expect(page.getByTestId('scenario-hostile-veil')).toContainText('PV 0/2');
  await expect(page.getByTestId('scenario-unit-security')).toContainText('PV 2 / 3');
  await expect(page.getByTestId('mission-phase')).toHaveText('MISIÓN EN SUPERFICIE');
  await page.getByTestId('scenario-resume-rescue').click();
  await page.reload();
  await expect(page.getByTestId('field-resolution')).toContainText('Amenazas neutralizadas');
  await expect(page.getByTestId('medical-report')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/perimeter-victory-restored-1280.png', fullPage: false });
});

for (const broken of ['perimeter', 'crew'] as const) {
  test(`a corrupt ${broken} checkpoint cannot restore an orphaned physical ceasefire`, async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('explore-area')).toContainText('Puente');
    const combat = JSON.parse(serializeCombatReplay('evacuation', [
      { type: 'move', officer: 'security', cell: '1:8' },
      { type: 'move', officer: 'security', cell: '5:8' },
      { type: 'move', officer: 'security', cell: '7:8' },
      { type: 'end-turn' }, { type: 'parley', officer: 'security' },
    ]));
    const raw = JSON.stringify({ version: 1, rescueRun: 0, active: true,
      combat: broken === 'perimeter' ? { ...combat, victory: true } : combat });
    const spatial = serializeSpatialCheckpoint(world, {
      version: 1, area: 'surface', x: 6, y: 5, heading: 'E', pending: null,
    });
    await page.evaluate(({ raw, spatial, broken, keys }) => {
      localStorage.setItem(keys.field, raw);
      localStorage.setItem(keys.spatial, spatial);
      if (broken === 'crew') localStorage.setItem(keys.crew, '{');
    }, { raw, spatial, broken, keys: {
      field: PERIMETER_SAVE_KEY, spatial: SPATIAL_CHECKPOINT_KEY, crew: CHECKPOINT_KEY,
    } });
    await page.reload();
    await expect(page.getByTestId('explore-heading')).toContainText('6:5');
    await expect(page.getByTestId('field-encounter-scene')).toHaveCount(0);
    await expect(page.getByTestId('field-resolution')).toHaveCount(0);
    if (broken === 'perimeter') {
      await expect(page.getByTestId('perimeter-save-notice')).toContainText('incompatible');
      expect(await page.evaluate(key => localStorage.getItem(key), PERIMETER_SAVE_KEY)).toBe(raw);
    } else {
      await expect.poll(() => page.evaluate(key =>
        JSON.parse(localStorage.getItem(key)!).combat.actions.length, PERIMETER_SAVE_KEY)).toBe(0);
      // The recovered crew checkpoint is now valid: another F5 must still not
      // resurrect the old run-zero ceasefire from before recovery.
      await page.reload();
      await expect(page.getByTestId('field-resolution')).toHaveCount(0);
    }
    await page.getByTestId('explore-use').click();
    await expect(page.getByTestId('scenario-turn')).toContainText('Ronda 1');
    await expect(page.getByTestId('scenario-truce')).toHaveCount(0);
    await expect(page.getByTestId('scenario-hostile-aegis')).toContainText('PV 2/2');
  });
}
