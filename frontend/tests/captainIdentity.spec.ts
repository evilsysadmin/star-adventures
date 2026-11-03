import { expect, test } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

for (const width of [390, 1280]) {
  test(`the renamed captain appears with an existing save at ${width}px`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 850 });
    await page.addInitScript(() => localStorage.setItem('shadowops.star-adventures.border-signal.v2', JSON.stringify({
      saveVersion: 2, episodeId: 'border-signal', actions: [
        { type: 'assign', station: 'science', officerId: 'varela' },
        { type: 'order', choiceId: 'scan' },
        { type: 'assign', station: 'command', officerId: 'varela' },
      ],
    })));
    await page.goto('/');
    await expect(page.getByTestId('bridge-interior')).toHaveAttribute('data-bridge-officer-captain', 'varela', { timeout: 30_000 });
    await expect(page.getByTestId('explore-target')).toContainText('Adrián Varela');
    await page.screenshot({ path: `test-results/captain-identity-${width}.png` });
    await page.getByTestId('game-journal-toggle').click();
    await page.getByTestId('crew-roster').locator('summary').click();
    await expect(page.getByTestId('station-command').locator('option:checked')).toHaveText('Adrián Varela');
    await page.getByTestId('game-journal-close').click();
    await page.getByTestId('captain-science').click();
    await expect(page.getByTestId('choice-broadcast')).toBeVisible();
  });
}
