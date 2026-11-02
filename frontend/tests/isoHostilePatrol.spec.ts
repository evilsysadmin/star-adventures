import { test, expect } from '@playwright/test';
import { createIsoCamera } from '../src/tacticalIsoCamera';
import { projectCell } from '../src/tacticalGrid';
import { hostilePatrolCellsAt } from '../src/isoHostilePatrol';

async function choose(page: import('@playwright/test').Page, id: string) {
  const canvas = page.getByTestId('iso-render-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  const [col, row] = id.split(':').map(Number);
  const point = projectCell({ col, row, id }, createIsoCamera(box.width / box.height),
    { left: box.x, top: box.y, width: box.width, height: box.height });
  await page.mouse.click(point.x, point.y);
  await expect(page.getByTestId('iso-selected')).toContainText(id);
}

for (const width of [390, 1280]) test(`opt-in hostile patrol moves real walking atlases and updates logical target cells at ${width}px`, async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width, height: 850 });
  // This test explicitly exercises walking animation. Do not inherit reduced
  // motion from the browser environment: in that mode the renderer correctly
  // suppresses the patrol, regardless of the opt-in button label.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.clock.install({ time: new Date('2026-10-29T00:00:00Z') });
  await page.goto('/');
  await page.getByTestId('tactical-view-iso').click();
  await expect(page.getByTestId('iso-atlas-status')).toContainText('Atlas R2 reales: 4/4', { timeout: 20_000 });
  // Let the real RAF acknowledge the opt-in command *before* freezing time.
  // A paused Playwright clock can starve this first frame on busy desktop CI,
  // producing a false negative even though React accepted the command.
  await choose(page, '6:2');
  await expect(page.getByTestId('iso-aim-status')).toContainText('línea despejada');
  await page.getByTestId('iso-patrol').click();
  await expect(page.getByTestId('iso-patrol')).toContainText('Detener patrulla');
  const canvas = page.getByTestId('iso-render-canvas');
  await expect(canvas).toHaveAttribute('data-patrol-active', 'true', { timeout: 15_000 });
  // Freeze at the clock's *current* instant, not at an arbitrary later
  // hour: a large leap would skip several real patrol segments and make the
  // next exact logical cell dependent on how long R2 assets took to load.
  const simulatedNow = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(new Date(simulatedNow));
  await page.clock.runFor(1_050);
  await expect.poll(async () => Number(await canvas.getAttribute('data-patrol-elapsed'))).toBeGreaterThanOrEqual(900);
  await expect(page.getByTestId('iso-hostile-cells')).toContainText('6:1');

  await choose(page, '6:1');
  await expect(page.getByTestId('iso-selected')).toContainText('Hostil de entrenamiento');
  await expect(page.getByTestId('iso-aim-status')).toContainText('línea despejada');
  await expect(page.getByTestId('iso-move')).toBeDisabled();
  await choose(page, '4:1');
  await expect(page.getByTestId('iso-move')).toBeEnabled();
  await page.getByTestId('iso-move').click();
  const frozenCells = await page.getByTestId('iso-hostile-cells').textContent();
  await page.clock.runFor(500);
  expect(await page.getByTestId('iso-hostile-cells').textContent()).toBe(frozenCells);
  await page.clock.runFor(1_500);
  await expect(page.getByTestId('iso-motion-status')).toContainText('Recorrido completado', { timeout: 10_000 });
  // Stopping patrol resets both contacts to authored start cells on the
  // next animation frame. Wait for that authoritative state instead of
  // clicking a stale moving position immediately after the button flips.
  await page.getByTestId('iso-patrol').click();
  await page.clock.runFor(32);
  await expect(page.getByTestId('iso-patrol')).toContainText('Activar patrulla');
  const initialCells = hostilePatrolCellsAt(0);
  await expect.poll(async () =>
    (await page.getByTestId('iso-hostile-cells').textContent())?.match(/[0-7]:[0-7]/g)
  ).toEqual([...initialCells]);
  await choose(page, initialCells[0]);
  expect(await page.getByTestId('iso-selected').textContent()).toContain('Hostil de entrenamiento');
  await page.screenshot({ path: `test-results/iso-hostile-patrol-${width}.png`, fullPage: true });
});
