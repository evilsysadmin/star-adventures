import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

type Asset = { url: string; key: string; contentType: string };
const { assets } = JSON.parse(
  readFileSync(new URL('../src/assets/r2-assets-manifest.json', import.meta.url), 'utf8'),
) as { assets: Record<string, Asset> };

const activeMotionIds = [
  'starAdventures.tactical.officerFemaleRunV1',
  'starAdventures.tactical.officerMaleRunV1',
] as const;

test('actual tactical viewport requests both published R2 default-motion atlases', async ({ page }) => {
  test.setTimeout(50_000);
  const expected = activeMotionIds.map(id => {
    const value = assets[id];
    expect(value?.url, `${id} missing in reviewed manifest`).toMatch(/^https:\/\/assets\.chess-studio\.shadowops\.dpdns\.org\/star-adventures\/tactical\//);
    return value;
  });

  // Register listeners *before* the page loads: app TextureLoader fires during
  // mount, and waiting until the canvas appears would miss the requests.
  const loaded = expected.map(asset => page.waitForResponse(
    response => response.url() === asset.url && response.request().resourceType() === 'image',
    { timeout: 25_000 },
  ));
  await page.setViewportSize({ width: 390, height: 850 });
  await page.goto('/');
  await expect(page.getByTestId('tactical-canvas')).toBeVisible();

  const responses = await Promise.all(loaded);
  for (let index = 0; index < responses.length; index++) {
    const response = responses[index];
    expect(response.status(), expected[index].url).toBe(200);
    expect(response.headers()['content-type']?.split(';')[0].trim()).toBe('image/webp');
    // The independently tested manifest SHA/byte integrity gate is in
    // r2Atlases.spec.ts. Here we prove the real game requests those URLs.
  }
  await expect(page.getByTestId('tactical-mvs')).toContainText('oficial hombre');
  await page.getByRole('button', { name: '7:7' }).click();
  await expect(page.getByTestId('tactical-selected')).toContainText('7:7');
});

test('a temporary R2 atlas outage does not prevent grid selection', async ({ page }) => {
  // Existing renderer does not yet provide an authored "missing officer"
  // fallback. This test asserts *only* that the board and its input survive.
  let intercepted = 0;
  await page.route('**/star-adventures/tactical/*.webp', route => {
    intercepted++;
    return route.fulfill({
      status: 503,
      headers: { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' },
      body: 'Simulated CDN failure',
    });
  });
  await page.goto('/');
  await expect(page.getByTestId('tactical-canvas')).toBeVisible();
  await expect.poll(() => intercepted).toBeGreaterThanOrEqual(2);
  await page.getByRole('button', { name: '5:4' }).click();
  await expect(page.getByTestId('tactical-selected')).toContainText('5:4');
});
