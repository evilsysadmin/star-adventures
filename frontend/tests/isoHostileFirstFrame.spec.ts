import { test, expect } from '@playwright/test';

// Simulate a late first render timestamp without slowing the real browser.
// Before the fix, the hostile walk had already expired by this first frame,
// so enemies jumped directly to their destination despite valid movement.
for (const width of [390, 1280]) {
 test(`hostile advances visibly after a delayed first frame at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 850 });
  await page.goto('/');
  await page.getByTestId('tactical-view-missions').click();
  await page.getByTestId('scenario-mode-advanced').locator('summary').click();
  await page.getByTestId('scenario-hostile-toggle').click();
  const canvas = page.getByTestId('scenario-render-canvas');
  await expect(page.getByTestId('scenario-hostile-aegis')).toContainText('6:6');
  await canvas.evaluate(element => {
   const observer = new MutationObserver(() => {
    const moving = Number(element.getAttribute('data-hostile-moving') ?? '0');
    if (moving < 1) return;
    element.setAttribute('data-test-saw-hostile-motion', '1');
    element.setAttribute('data-test-first-hostile-frame',
     element.getAttribute('data-hostile-walk-frame') ?? 'missing');
    observer.disconnect();
   });
   observer.observe(element, { attributes: true, attributeFilter: ['data-hostile-moving'] });
   const original = window.requestAnimationFrame.bind(window);
   // Timestamp jump affects only the callback's reported time, not the wall
   // clock. An animation started on the state-update timestamp would skip.
   window.requestAnimationFrame = callback =>
    original(timestamp => callback(timestamp + 2_000));
  });
  await page.getByTestId('scenario-end-turn').click();
  await expect(page.getByTestId('scenario-turn')).toContainText('Ronda 2');
  await expect(canvas).toHaveAttribute('data-test-saw-hostile-motion', '1');
  await expect(canvas).toHaveAttribute('data-test-first-hostile-frame', '0');
  await expect(canvas).toHaveAttribute('data-hostile-moving', '0', { timeout: 4_000 });
  await expect(page.getByTestId('scenario-hostile-aegis')).not.toContainText('6:6');
  await page.screenshot({
   path: `test-results/hostile-first-render-${width}.png`, fullPage: true,
  });
 });
}
