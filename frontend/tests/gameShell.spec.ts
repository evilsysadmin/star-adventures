import { expect, test } from '@playwright/test';
import { projectCell } from '../src/tacticalGrid';
import { createIsoCamera } from '../src/tacticalIsoCamera';

test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: 'parallel' });
const settingsKey = 'shadowops.star-adventures.presentation.v1';

for (const width of [390, 1280]) {
  test(`fullscreen game pauses, changes options, exits and resumes at ${width}px`, async ({ page }) => {
    test.setTimeout(100_000);
    await page.setViewportSize({ width, height: 850 });
    await page.goto('/');
    const canvas = page.getByTestId('bridge-interior');
    await expect(canvas).toHaveAttribute('data-bridge-rendered', 'true', { timeout: 20_000 });
    const bounds = (await canvas.boundingBox())!;
    expect(bounds.x).toBe(0); expect(bounds.y).toBe(0);
    expect(bounds.width).toBe(width); expect(bounds.height).toBe(850);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(850);
    for (const id of ['game-menu-open', 'tactical-lab-toggle', 'captain-science', 'captain-transport']) {
      const box = (await page.getByTestId(id).boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0); expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.y + box.height).toBeLessThanOrEqual(850);
    }
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByTestId('explore-forward')).toHaveCount(0);
    await expect(canvas).toHaveAttribute('data-bridge-pose', '3:5:N');
    await page.getByTestId('game-menu-open').click();
    const menu = page.getByRole('dialog');
    await expect(menu).toContainText('Juego en pausa');
    await page.keyboard.press('ArrowUp'); await page.keyboard.press('e');
    await expect(canvas).toHaveAttribute('data-bridge-pose', '3:5:N');
    await expect(page.getByTestId('captain-science')).toBeDisabled();
    await page.keyboard.press('Tab');
    expect(await menu.evaluate(element => element.contains(document.activeElement))).toBe(true);
    await menu.screenshot({ path: `test-results/game-menu-${width}.png` });
    await page.getByTestId('game-options').click();
    await page.getByTestId('game-hints').uncheck();
    await page.keyboard.press('Escape');
    await page.getByTestId('game-exit').click();
    await expect(menu).toContainText('El mando te espera');
    await page.keyboard.press('ArrowUp');
    await page.getByTestId('game-continue').click();
    await expect(menu).toHaveCount(0);
    await expect(canvas).toHaveAttribute('data-bridge-pose', '3:5:N');
    await expect(page.getByTestId('mission-waypoint')).toHaveCount(0);
    await page.reload();
    await expect(canvas).toHaveAttribute('data-bridge-pose', '3:5:N', { timeout: 20_000 });
    await expect(page.getByTestId('mission-waypoint')).toHaveCount(0);
    await page.screenshot({ path: `test-results/game-fullscreen-${width}.png` });
  });
}

for (const width of [360, 390, 430, 1280]) {
  test(`POC canvas picks all 100 cells and returns to the same bridge at ${width}px`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width, height: 850 });
    await page.goto('/');
    await expect(page.getByTestId('explore-heading')).toContainText('CAPITÁN');
    const rescue = await page.evaluate(() => localStorage.getItem('shadowops.star-adventures.outpost-orders.v1'));
    await page.getByTestId('tactical-lab-toggle').click();
    const canvas = page.getByTestId('scenario-render-canvas');
    await expect(canvas).toHaveAttribute('data-tactical-ready', 'true', { timeout: 20_000 });
    await canvas.scrollIntoViewIfNeeded();
    for (let row = 0; row < 10; row++) for (let col = 0; col < 10; col++) {
      const id = `${col}:${row}`;
      // Officer/target selection can reflow the surrounding command rows.
      // Project against the canvas's current rectangle, as the raycaster does.
      const bounds = (await canvas.boundingBox())!;
      const camera = createIsoCamera(bounds.width / bounds.height, 10, 3.18);
      const point = projectCell({ id, col, row }, camera,
        { left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height }, 10);
      // A projected coordinate is useful only when the real canvas receives it.
      // This catches overlays and viewport clipping before reporting a picking error.
      expect(await canvas.evaluate((element, point) =>
        document.elementFromPoint(point.x, point.y) === element, point),
      `Casilla ${id}: el centro proyectado debe alcanzar el canvas a ${width}px`).toBe(true);
      await page.mouse.click(point.x, point.y);
      await expect(page.getByTestId('scenario-selected')).toHaveText(id);
    }
    await expect(page.getByTestId('scenario-ap')).toContainText('3 / 3');
    await page.screenshot({ path: `test-results/game-poc-${width}.png` });
    await page.getByTestId('game-poc-return').click();
    await expect(page.getByTestId('scenario-lab')).toHaveCount(0);
    await expect(page.getByTestId('explore-heading')).toContainText('CAPITÁN');
    expect(await page.evaluate(() => localStorage.getItem('shadowops.star-adventures.outpost-orders.v1'))).toBe(rescue);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  });
}

test('audio options control real Web Audio and a muted accepted tactical shot', async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    const starts: number[] = [], levels: number[] = [];
    Object.assign(window, { gameAudioEvidence: { starts, levels } });
    const originalOscillator = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () {
      const oscillator = originalOscillator.call(this);
      const originalStart = oscillator.start.bind(oscillator);
      oscillator.start = (at = 0) => { starts.push(at); originalStart(at); };
      return oscillator;
    };
    const originalGain = AudioContext.prototype.createGain;
    AudioContext.prototype.createGain = function () {
      const gain = originalGain.call(this), originalSet = gain.gain.setValueAtTime.bind(gain.gain);
      gain.gain.setValueAtTime = (value, at) => { levels.push(value); return originalSet(value, at); };
      return gain;
    };
  });
  await page.goto('/');
  await page.getByTestId('game-menu-open').click();
  await page.getByTestId('game-audio').click();
  await page.getByTestId('game-volume').focus();
  await page.keyboard.press('Home');
  for (let step = 0; step < 5; step++) await page.keyboard.press('ArrowRight');
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).volume, settingsKey)).toBe(.25);
  await page.getByTestId('game-audio-preview').click();
  const evidence = () => page.evaluate(() => (window as Window & { gameAudioEvidence: { starts: number[]; levels: number[] } }).gameAudioEvidence);
  expect((await evidence()).starts).toHaveLength(2);
  expect((await evidence()).levels).toContain(.25);
  await page.getByTestId('game-mute').check();
  await expect(page.getByTestId('game-audio-preview')).toBeDisabled();
  await page.keyboard.press('Escape'); await page.getByTestId('game-resume').click();
  await page.getByTestId('tactical-lab-toggle').click();
  await page.getByTestId('scenario-accessible-grid').locator('summary').click();
  await page.getByTestId('scenario-unit-security').click();
  for (const cell of ['3:7', '5:6']) {
    await page.getByRole('button', { name: `Casilla ${cell}`, exact: true }).click();
    await page.getByTestId('scenario-move').click();
  }
  await page.getByTestId('scenario-hostile-aegis').click();
  await page.getByTestId('scenario-fire-order').click();
  await expect(page.getByTestId('scenario-hostile-aegis')).toContainText('PV 1/2');
  expect((await evidence()).starts).toHaveLength(2);
  await page.reload();
  await page.getByTestId('game-menu-open').click(); await page.getByTestId('game-audio').click();
  await expect(page.getByTestId('game-volume')).toHaveValue('0.25');
  await expect(page.getByTestId('game-mute')).toBeChecked();
});

test('browser fullscreen is requested by a real click and the menu remains usable', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('game-menu-open').click(); await page.getByTestId('game-options').click();
  const toggle = page.getByTestId('game-fullscreen');
  if (await page.evaluate(() => document.fullscreenEnabled)) {
    await toggle.click();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement?.getAttribute('data-testid'))).toBe('game-shell');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await toggle.click();
    await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
  } else await expect(toggle).toBeDisabled();
  await page.keyboard.press('Escape'); await page.getByTestId('game-resume').click();
  await page.getByTestId('captain-science').click();
  await expect(page.getByTestId('choice-scan')).toBeVisible();
});

for (const width of [390, 1280]) {
  test(`captain science orders and confirmed transport at ${width}px`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 850 });
    await page.goto('/');
    await expect(page.getByTestId('bridge-interior')).toHaveAttribute('data-bridge-rendered', 'true', { timeout: 20_000 });
    await page.screenshot({ path: `test-results/captain-bridge-${width}.png` });
    await page.getByTestId('captain-science').click();
    await page.getByTestId('choice-scan').click();
    await page.getByTestId('choice-broadcast').click();
    await expect(page.getByTestId('ending')).toContainText('Paz negociada');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('bridge-interior')).toHaveAttribute('data-bridge-pose', '3:5:N');
    await page.getByTestId('captain-transport').click();
    await page.getByTestId('transport-decline').click();
    await expect(page.getByTestId('captain-controls')).toBeVisible();
    await page.getByTestId('captain-transport').click();
    await page.getByTestId('transport-confirm').click();
    await expect(page.getByTestId('explore-forward')).toBeVisible();
    await expect(page.getByTestId('captain-controls')).toHaveCount(0);
  });
}

for (const width of [390, 1280]) {
  test(`captain rescue returns to the seated bridge and survives F5 at ${width}px`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 850 });
    await page.goto('/');
    await page.getByTestId('captain-transport').click();
    await page.getByTestId('transport-confirm').click();
    for (const target of ['Puesto de socorro', 'Solicitar teletransporte de regreso']) {
      let reached = false;
      for (let step = 0; step < 40; step++) {
        const waypoint = page.getByTestId('mission-waypoint');
        await expect(waypoint).toContainText(target);
        const action = await waypoint.getAttribute('data-action');
        if (action === 'use') {
          await page.getByTestId('explore-use').click(); reached = true; break;
        }
        const control = { forward: 'forward', 'turn-left': 'left', 'turn-right': 'right' }[action!];
        expect(control).toBeTruthy();
        await page.getByTestId(`explore-${control}`).click();
      }
      expect(reached).toBe(true);
      if (target === 'Puesto de socorro')
        await expect(page.getByTestId('mission-phase')).toHaveText('RESCATE CONFIRMADO');
    }
    await page.getByTestId('transport-confirm').click();
    await expect(page.getByTestId('mission-phase')).toHaveText('REGRESO AL PUENTE');
    await expect(page.getByTestId('captain-controls')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('mission-phase')).toHaveText('REGRESO AL PUENTE');
    await expect(page.getByTestId('bridge-interior')).toHaveAttribute('data-bridge-mode', 'captain', { timeout: 20_000 });
    await page.getByTestId('game-journal-toggle').click();
    await page.getByTestId('mandate-archive').locator('summary').first().click();
    await expect(page.getByTestId('mandate-public-events')).toContainText('Civiles evacuados');
    await expect(page.getByTestId('mandate-official-status')).toHaveText('Completada');
    await page.screenshot({ path: `test-results/captain-rescue-return-${width}.png` });
  });
}
