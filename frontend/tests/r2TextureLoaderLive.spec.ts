import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(
  new URL('../src/assets/r2-assets-manifest.json', import.meta.url), 'utf8',
)) as { assets: Record<string, { url: string }> };
const femaleUrl = manifest.assets['starAdventures.tactical.officerFemaleWalkV1'].url;

type Result = {
  status: string; placeholder: boolean; sprite: boolean;
  inScene: boolean; afterDisposed: boolean; repeatX: number | null; repeatY: number | null;
};

async function probeRealTextureLoader(page: Page): Promise<Result> {
  // This is the exact production utility and real Three.TextureLoader.
  // Unlike r2OfficerFallback.spec.ts there is NO injected fake loader.
  return page.evaluate(async url => {
    const THREE = await import('/node_modules/.vite/deps/three.js');
    const { mountResilientOfficer } = await import('/src/tacticalOfficerFallback.ts');
    const scene = new THREE.Scene();
    return new Promise<Result>((resolve, reject) => {
      let unit: ReturnType<typeof mountResilientOfficer>;
      const timeout = setTimeout(() => {
        unit?.dispose();
        reject(new Error('Real Three.js image loading never completed'));
      }, 15_000);
      unit = mountResilientOfficer({
        scene, id: 'live-cdn', assetUrl: url, at: {x: 2,z: 4},
        onStatus: state => {
          if (state !== 'loaded' && state !== 'failed') return;
          // TextureLoader calls this asynchronously: unit has been initialized.
          clearTimeout(timeout);
          const map = unit.sprite.material.map;
          const result = {
            status: state,
            placeholder: unit.placeholder.visible,
            sprite: unit.sprite.visible,
            inScene: scene.children.includes(unit.root),
            afterDisposed: false,
            repeatX: map ? map.repeat.x : null,
            repeatY: map ? map.repeat.y : null,
          };
          unit.dispose();
          result.afterDisposed = !scene.children.includes(unit.root);
          resolve(result);
        },
      });
    });
  }, femaleUrl);
}

test('actual Three.TextureLoader 503 keeps visible officer and releases scene resources', async ({ page }) => {
  test.setTimeout(50_000);
  let intercepted = 0;
  await page.route(femaleUrl, route => {
    intercepted++;
    return route.fulfill({
      status:503,
      headers: { 'content-type':'text/plain', 'access-control-allow-origin':'*', 'cache-control':'no-store' },
      body:'Simulated R2 outage',
    });
  });
  await page.goto('/');
  const result = await probeRealTextureLoader(page);
  expect(intercepted).toBeGreaterThanOrEqual(1);
  expect(result).toMatchObject({
    status:'failed', placeholder:true, sprite:false, inScene:true,
    afterDisposed:true, repeatX:null, repeatY:null,
  });
  await page.getByRole('button', { name: '5:4' }).click();
  await expect(page.getByTestId('tactical-selected')).toContainText('5:4');
});

test('actual Three.TextureLoader recovers to published sprite when R2 works', async ({ page }) => {
  test.setTimeout(50_000);
  await page.goto('/');
  const result = await probeRealTextureLoader(page);
  expect(result).toMatchObject({
    status:'loaded', placeholder:false, sprite:true, inScene:true,
    afterDisposed:true, repeatX:1/3, repeatY:1/2,
  });
  await page.getByRole('button', { name: '7:0' }).click();
  await expect(page.getByTestId('tactical-selected')).toContainText('7:0');
});
