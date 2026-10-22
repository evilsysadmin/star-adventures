import { test, expect } from '@playwright/test';

for (const width of [390, 1280]) {
  test(`real atlas magnifier shows both original animation sheets at ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height:850});
    await page.goto('/');
    await page.getByTestId('tactical-view-iso').click();
    await expect(page.getByTestId('iso-lab')).toBeVisible();
    await expect(page.getByTestId('iso-atlas-inspector')).toHaveCount(0);
    await page.getByTestId('iso-inspect-toggle').click();
    await expect(page.getByTestId('iso-atlas-inspector')).toBeVisible();
    for(const sex of ['female','male']) {
      const element = page.getByTestId(`iso-atlas-preview-${sex}`);
      await expect(element).toBeVisible();
      const bg = await element.evaluate(el => getComputedStyle(el).backgroundImage);
      expect(bg).toContain('/star-adventures/tactical/officer-');
      expect(bg).toContain('.webp');
    }
    const start = await page.getByTestId('iso-atlas-preview-female')
      .evaluate(el => getComputedStyle(el).backgroundPosition);
    await expect.poll(() => page.getByTestId('iso-atlas-preview-female')
      .evaluate(el => getComputedStyle(el).backgroundPosition), { timeout: 3_000 })
      .not.toBe(start);
    await page.getByTestId('iso-motion').click();
    await expect(page.getByTestId('iso-atlas-frame-female')).toContainText('Fotograma 1/6');
    await expect(page.getByTestId('iso-atlas-status')).toContainText('Atlas R2 reales: 2/2', {timeout:15_000});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path:`test-results/iso-atlas-magnifier-${width}.png`,fullPage:true});
    await page.getByTestId('iso-inspect-toggle').click();
    await expect(page.getByTestId('iso-atlas-inspector')).toHaveCount(0);
    await page.getByTestId('tactical-view-current').click();
    await expect(page.getByTestId('tactical-selected')).toBeVisible();
  });
}
