import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('../src/assets/r2-assets-manifest.json', import.meta.url), 'utf8')) as { assets: Record<string, ManifestEntry> };

/*
 * Live CDN integrity gate. Browser fetch (CORS) and Image decode are both
 * required: a checked-in R2 manifest does not prove its objects are live,
 * uncorrupted or compatible with Three.js TextureLoader.
 *
 * This test intentionally does not change TacticalProbe, because the Codex
 * CLI is separately iterating the tactical renderer and unit animations.
 */
type ManifestEntry = {
  url: string;
  key: string;
  sha256: string;
  bytes: number;
  contentType: string;
};

const prefix = 'https://assets.chess-studio.shadowops.dpdns.org/star-adventures/tactical/';

for (const [id, entry] of Object.entries(manifest.assets) as Array<[string, ManifestEntry]>) {
  test(`R2 atlas is public, CORS-decodable and byte-identical: ${id}`, async ({ page }) => {
    test.setTimeout(55_000);
    expect(entry.url).toBe(prefix + entry.key.split('/').slice(2).join('/'));
    expect(entry.key.startsWith('star-adventures/tactical/')).toBe(true);
    expect(entry.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(entry.key).toContain(entry.sha256.slice(0, 16));
    expect(entry.bytes).toBeGreaterThan(0);
    expect(entry.contentType).toBe('image/webp');

    await page.goto('/');
    // Run as the actual Vite browser origin, not server-side Playwright API.
    // That verifies the CORS contract the Three.js TextureLoader depends on.
    const result = await page.evaluate(async (asset: ManifestEntry) => {
      const response = await fetch(asset.url, { mode: 'cors', cache: 'no-store' });
      if (!response.ok) return { status: response.status, error: 'http' };
      const bytes = await response.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const hex = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');

      // A second independent browser image decode verifies a valid WebP and
      // CORS-compatible Image element (not just 200 OK with arbitrary bytes).
      const decoded = await new Promise<{width:number;height:number}>((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
        image.onerror = () => reject(new Error('Remote WebP failed browser image decode'));
        image.src = asset.url;
      });
      return {
        status: response.status,
        contentType: response.headers.get('content-type')?.split(';')[0].trim(),
        size: bytes.byteLength,
        sha256: hex,
        ...decoded,
      };
    }, entry);

    expect(result, `${id} must be downloadable as an image over CORS`).toMatchObject({
      status: 200, contentType: 'image/webp', size: entry.bytes, sha256: entry.sha256,
    });
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);

    if (/officer(?:Female|Male)(?:Walk|Run|Jump|Crouch|Fire)V[1-9]\d*$/.test(id)) {
      // All authored motion atlases use 3 columns x 2 rows, not just walk.
      // Validate every new motion Codex adds without modifying this test.
      expect(result.width % 3).toBe(0);
      expect(result.height % 2).toBe(0);
    }
  });
}

test('manifest retains mandatory originals and pairs every additional motion for both officers', () => {
  // New animation cycles should add independently verifiable atlas URLs,
  // not break the CI just because the total grew beyond the original four.
  const ids = Object.keys(manifest.assets);
  const names = new Set(ids);
  for (const baseline of [
    'starAdventures.tactical.officerFemaleMvsV1',
    'starAdventures.tactical.officerFemaleWalkV1',
    'starAdventures.tactical.officerMaleMvsV1',
    'starAdventures.tactical.officerMaleWalkV1',
  ]) {
    expect(names.has(baseline), `Mandatory asset missing: ${baseline}`).toBe(true);
  }
  for (const id of ids) {
    expect(id).toMatch(/^starAdventures\.tactical\.officer(?:Female|Male)[A-Z][A-Za-z0-9]*V[1-9]\d*$/);
    const partner = id.includes('officerFemale')
      ? id.replace('officerFemale', 'officerMale')
      : id.replace('officerMale', 'officerFemale');
    expect(names.has(partner), `Missing matching gender atlas for ${id}`).toBe(true);
  }
  const keys = Object.values(manifest.assets).map(asset => asset.key);
  const urls = Object.values(manifest.assets).map(asset => asset.url);
  expect(new Set(keys).size).toBe(keys.length);
  expect(new Set(urls).size).toBe(urls.length);
});
