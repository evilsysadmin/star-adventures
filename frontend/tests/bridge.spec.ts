import { test, expect } from '@playwright/test';

for (const width of [360, 390, 430, 1280]) {
  test(`bridge fits ${width}px and displays actionable choices`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1280 ? 820 : 850 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Ecos en la frontera/i })).toBeVisible();
    await expect(page.getByTestId('choice-scan')).toBeVisible();
    await expect(page.getByTestId('choice-hail')).toBeVisible();
    await expect(page.getByTestId('choice-intercept')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({ path: `test-results/bridge-${width}.png`, fullPage: true });
  });
}

test('science, diplomacy and tactical choices produce distinct genuine outcomes', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('choice-scan').click();
  await expect(page.getByTestId('science-score')).toHaveText('02');
  await page.getByTestId('choice-broadcast').click();
  await expect(page.getByTestId('ending')).toContainText('Paz negociada');
  await expect(page.getByTestId('science-score')).toHaveText('05');
  await expect(page.getByRole('button', { name: /Nueva misión/i })).toBeVisible();
  await page.getByRole('button', { name: /Nueva misión/i }).click();
  await expect(page.getByTestId('science-score')).toHaveText('00');
  await page.getByTestId('choice-hail').click();
  await page.getByTestId('choice-mediate').click();
  await expect(page.getByTestId('diplomacy-score')).toHaveText('05');
  await expect(page.getByTestId('ending')).toContainText('Paz negociada');
  await page.getByRole('button', { name: /Nueva misión/i }).click();
  await page.getByTestId('choice-intercept').click();
  await page.getByTestId('choice-disable').click();
  await expect(page.getByTestId('damage-score')).toHaveText('01');
  await expect(page.getByTestId('ending')).toContainText('Victoria táctica');
});

test('keyboard choices and skip-navigation work', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('choice-hail')).toBeVisible();
  await page.keyboard.press('2');
  await expect(page.getByTestId('diplomacy-score')).toHaveText('02');
  await page.keyboard.press('1');
  await expect(page.getByTestId('ending')).toContainText('Paz negociada');
  await page.keyboard.press('r');
  await expect(page.getByTestId('choice-scan')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Ir a las órdenes' })).toBeFocused();
});


test('a saved command history restores the same decision after refresh', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('choice-hail').click();
  await expect(page.getByTestId('diplomacy-score')).toHaveText('02');
  await page.reload();
  await expect(page.getByTestId('choice-mediate')).toBeVisible();
  await expect(page.getByTestId('diplomacy-score')).toHaveText('02');
  await page.getByTestId('choice-mediate').click();
  await page.reload();
  await expect(page.getByTestId('ending')).toContainText('Paz negociada');
  await expect(page.getByTestId('diplomacy-score')).toHaveText('05');
});

test('corrupt local checkpoint falls back to a new mission without crashing', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('shadowops.star-adventures.border-signal.v2', '{bad save'));
  await page.reload();
  await expect(page.getByTestId('choice-scan')).toBeVisible();
  await expect(page.getByText('Guardado incompatible · misión reiniciada')).toBeVisible();
});

test('station swaps change narrative outcomes and survive reload', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('crew-roster').locator('summary').click();
  await page.getByTestId('station-science').selectOption('dorn');
  await expect(page.getByTestId('station-tactical')).toHaveValue('venn');
  await expect(page.getByTestId('staff-scan')).toContainText('Kael Dorn');
  await page.getByTestId('choice-scan').click();
  await page.getByTestId('choice-broadcast').click();
  await expect(page.getByTestId('ending')).toContainText('Retirada estratégica');
  await expect(page.getByTestId('narrative')).toContainText('La orden fracasa');
  await page.reload();
  await expect(page.getByTestId('ending')).toContainText('Retirada estratégica');
  await page.getByTestId('crew-roster').locator('summary').click();
  await expect(page.getByTestId('station-science')).toHaveValue('dorn');
});

test('crew XP survives a new mission and F5', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('choice-scan').click();
  await page.getByTestId('choice-broadcast').click();
  await page.getByRole('button', { name: /Nueva misión/i }).click();
  await page.reload();
  await page.getByTestId('crew-roster').locator('summary').click();
  await expect(page.getByTestId('station-science').locator('..')).toContainText('75 XP');
  await expect(page.getByTestId('choice-scan')).toBeVisible();
});

test('legacy v1 progress migrates exactly without retroactive XP', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.removeItem('shadowops.star-adventures.border-signal.v2');
    localStorage.setItem('shadowops.star-adventures.border-signal.v1', JSON.stringify({
      saveVersion: 1, episodeId: 'border-signal', commands: ['scan']
    }));
  });
  await page.reload();
  await expect(page.getByTestId('science-score')).toHaveText('01');
  await expect(page.getByTestId('choice-broadcast')).toBeVisible();
  await page.getByTestId('crew-roster').locator('summary').click();
  await expect(page.getByTestId('station-science').locator('..')).toContainText('0 XP');
  await page.reload();
  await expect(page.getByTestId('science-score')).toHaveText('01');
});

test('corrupt v2 does not silently restore stale v1', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('shadowops.star-adventures.border-signal.v2', '{bad');
    localStorage.setItem('shadowops.star-adventures.border-signal.v1', JSON.stringify({
      saveVersion: 1, episodeId: 'border-signal', commands: ['hail']
    }));
  });
  await page.reload();
  await expect(page.getByTestId('science-score')).toHaveText('00');
  await expect(page.getByTestId('diplomacy-score')).toHaveText('00');
  await expect(page.getByText('Guardado incompatible · misión reiniciada')).toBeVisible();
});
