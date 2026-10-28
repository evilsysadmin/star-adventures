import { test, expect, type Page } from '@playwright/test';

const CONTROLS: Record<string, string> = {
  forward: 'explore-forward',
  'turn-left': 'explore-left',
  'turn-right': 'explore-right',
};

/** Follow the visible HUD, issuing real movement/turn orders, never changing state directly. */
async function followWaypoint(page: Page, target: string) {
  for (let index = 0; index < 40; index++) {
    const hint = page.getByTestId('mission-waypoint');
    await expect(hint).toContainText(target);
    const action = await hint.getAttribute('data-action');
    if (action === 'use') {
      await expect(hint).toContainText('Objetivo al alcance');
      await page.getByTestId('explore-use').click();
      return index;
    }
    expect(action).not.toBeNull();
    const control = CONTROLS[action!];
    expect(control).toBeTruthy();
    await page.getByTestId(control).click();
    await expect(page.getByTestId('explore-feedback')).not.toContainText('Paso bloqueado');
  }
  throw new Error(`HUD failed to guide player to ${target}`);
}

for (const width of [390, 1280]) {
  test(`live mission compass leads through physical bridge → rescue → return at ${width}px`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width, height: 850 });
    await page.goto('/');
    await expect(page.getByTestId('mission-phase')).toHaveText('TRANSMISIÓN ENTRANTE');
    await expect(page.getByTestId('mission-waypoint-command')).toHaveText('GIRA A LA DERECHA ↷');
    const ribbon = await page.getByTestId('mission-waypoint').boundingBox();
    expect(ribbon).not.toBeNull();
    expect(ribbon!.x).toBeGreaterThanOrEqual(0);
    expect(ribbon!.x + ribbon!.width).toBeLessThanOrEqual(width + 1);
    await page.screenshot({ path: `test-results/mission-compass-bridge-${width}.png`, fullPage: true });

    await followWaypoint(page, 'Acceso a la sala de transporte');
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByTestId('mission-waypoint')).toHaveCount(0);
    await page.getByTestId('transport-confirm').click();
    await expect(page.getByTestId('mission-phase')).toHaveText('MISIÓN EN SUPERFICIE');
    await expect(page.getByTestId('mission-waypoint')).toContainText('Puesto de socorro');
    await page.screenshot({ path: `test-results/mission-compass-field-${width}.png`, fullPage: true });

    await followWaypoint(page, 'Puesto de socorro');
    await expect(page.getByTestId('mission-phase')).toHaveText('RESCATE CONFIRMADO');
    await expect(page.getByTestId('mission-waypoint')).toContainText('Solicitar teletransporte de regreso');
    await followWaypoint(page, 'Solicitar teletransporte de regreso');
    await page.getByTestId('transport-confirm').click();
    await expect(page.getByTestId('mission-phase')).toHaveText('REGRESO AL PUENTE');
    await expect(page.getByTestId('mission-waypoint')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/mission-compass-return-${width}.png`, fullPage: true });

    await page.reload();
    await expect(page.getByTestId('mission-phase')).toHaveText('REGRESO AL PUENTE');
    await expect(page.getByTestId('mission-waypoint')).toHaveCount(0);
  });
}
