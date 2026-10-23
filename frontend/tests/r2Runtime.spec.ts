import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

type Asset = { url: string; key: string; contentType: string };
const { assets } = JSON.parse(
  readFileSync(new URL('../src/assets/r2-assets-manifest.json', import.meta.url), 'utf8'),
) as { assets: Record<string, Asset> };

const walkIds = [
  'starAdventures.tactical.officerFemaleWalkV1',
  'starAdventures.tactical.officerMaleWalkV1',
] as const;

test('actual tactical viewport loads run and walk R2 atlases for both officers', async ({ page }) => {
  test.setTimeout(95_000);
  const manifests = {
    run: [
      'starAdventures.tactical.officerFemaleRunV1',
      'starAdventures.tactical.officerMaleRunV1',
    ],
    walk: walkIds,
  };
  const expected = (ids: readonly string[]) => ids.map(id => {
    const asset = assets[id];
    expect(asset?.url, `${id} missing in reviewed manifest`)
      .toMatch(/^https:\\/\\/assets\\.chess-studio\\.shadowops\\.dpdns\\.org\\/star-adventures\\/tactical\\//);
    return asset;
  });
  const onRequests = (items: Asset[]) => items.map(asset => page.waitForResponse(
    response => response.url() === asset.url &&
      response.request().resourceType() === 'image',
    { timeout: 25_000 },
  ));
  const assertResponses = async (promises: ReturnType<typeof onRequests>, items: Asset[]) => {
    const responses = await Promise.all(promises);
    for (let i = 0; i < responses.length; i++) {
      expect(responses[i].status(), items[i].url).toBe(200);
      expect(responses[i].headers()['content-type']?.split(';')[0].trim()).toBe('image/webp');
    }
  };
  // Codex's run cycles are now the default in the current tactical viewport.
  // Register listeners before mount, then explicitly switch to walk and verify
  // the second pair of real network fetches, rather than assuming a stale mode.
  const runAssets = expected(manifests.run);
  const running = onRequests(runAssets);
  await page.setViewportSize({ width: 390, height: 850 });
  await page.goto('/');
  await expect(page.getByTestId('tactical-canvas')).toBeVisible();
  await expect(page.getByTestId('tactical-mvs')).toContainText('correr 10 FPS');
  await assertResponses(running,runAssets);

  const walkAssets = expected(manifests.walk);
  const walking = onRequests(walkAssets);
  await page.getByRole('button',{name:'Movimiento: correr'}).click();
  await expect(page.getByTestId('tactical-mvs')).toContainText('caminar 6 FPS');
  await assertResponses(walking,walkAssets);
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
