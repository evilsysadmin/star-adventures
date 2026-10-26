import { test, expect } from '@playwright/test';

// Mock only the browser audio device, not the combat engine or accepted shot.
// This proves the UI triggers audio on a legal click, never on a blocked one.
for (const width of [390, 1280]) {
 test(`accepted tactical fire sounds immediately and at impact on ${width}px`, async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
   const starts: number[] = [];
   (window as Window & { tacticalAudioStarts?: number[] }).tacticalAudioStarts = starts;
   class FakeAudioContext {
    currentTime = 12;
    state = 'running';
    destination = {};
    createOscillator() {
     return {
      type: 'sine',
      frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() {}, start(at: number) { starts.push(at); }, stop() {},
     };
    }
    createGain() {
     return {
      gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() {},
     };
    }
    resume() { return Promise.resolve(); }
   }
   Object.defineProperty(window, 'AudioContext', { configurable: true, value: FakeAudioContext });
  });
  await page.setViewportSize({ width, height: 850 });
  await page.goto('/');
  await page.getByTestId('tactical-view-missions').click();
  await page.getByTestId('scenario-play-combat').click();
  await page.getByTestId('scenario-accessible-grid').locator('summary').click();
  await expect(page.getByTestId('scenario-fire')).toBeDisabled();
  expect(await page.evaluate(() => (window as Window & { tacticalAudioStarts?: number[] }).tacticalAudioStarts)).toEqual([]);
  await page.getByTestId('scenario-unit-security').click();
  for (const cell of ['3:7', '5:6']) {
   await page.getByRole('button', { name: 'Casilla ' + cell, exact: true }).click();
   await page.getByTestId('scenario-move').click();
  }
  await page.getByTestId('scenario-hostile-aegis').click();
  await expect(page.getByTestId('scenario-fire')).toBeEnabled();
  await page.getByTestId('scenario-fire').click();
  const canvas = page.getByTestId('scenario-render-canvas');
  await expect(canvas).toHaveAttribute('data-shot-sequence', '1');
  const starts = await page.evaluate(() => (window as Window & { tacticalAudioStarts?: number[] }).tacticalAudioStarts!);
  expect(starts).toHaveLength(2);
  expect(starts[0]).toBe(12);
  expect(starts[1] - starts[0]).toBeCloseTo(0.64, 5);
  await page.reload();
  await page.getByTestId('tactical-view-missions').click();
  await page.getByTestId('scenario-play-combat').click();
  expect(await page.evaluate(() => (window as Window & { tacticalAudioStarts?: number[] }).tacticalAudioStarts)).toEqual([]);
 });
}
