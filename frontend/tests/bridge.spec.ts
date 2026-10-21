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
  await expect(page.getByTestId('science-score')).toHaveText('01');
  await page.getByTestId('choice-broadcast').click();
  await expect(page.getByTestId('ending')).toContainText('Paz negociada');
  await expect(page.getByTestId('science-score')).toHaveText('03');
  await expect(page.getByRole('button', { name: /Nueva misión/i })).toBeVisible();
  await page.getByRole('button', { name: /Nueva misión/i }).click();
  await expect(page.getByTestId('science-score')).toHaveText('00');
  await page.getByTestId('choice-hail').click();
  await page.getByTestId('choice-mediate').click();
  await expect(page.getByTestId('diplomacy-score')).toHaveText('03');
  await expect(page.getByTestId('ending')).toContainText('Paz negociada');
  await page.getByRole('button', { name: /Nueva misión/i }).click();
  await page.getByTestId('choice-intercept').click();
  await page.getByTestId('choice-disable').click();
  await expect(page.getByTestId('damage-score')).toHaveText('03');
  await expect(page.getByTestId('ending')).toContainText('Victoria táctica');
});

test('keyboard choices and skip-navigation work', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('2');
  await expect(page.getByTestId('diplomacy-score')).toHaveText('01');
  await page.keyboard.press('1');
  await expect(page.getByTestId('ending')).toContainText('Paz negociada');
  await page.keyboard.press('r');
  await expect(page.getByTestId('choice-scan')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Ir a las órdenes' })).toBeFocused();
});
