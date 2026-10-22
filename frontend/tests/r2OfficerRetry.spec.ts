import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(
  new URL('../src/assets/r2-assets-manifest.json', import.meta.url), 'utf8',
)) as { assets: Record<string, { url: string }> };
const femaleWalkUrl = manifest.assets['starAdventures.tactical.officerFemaleWalkV1'].url;

test('manual retry ignores stale async callbacks without moving or hiding the officer', async ({ page }) => {
  await page.goto('/');
  const actual = await page.evaluate(async () => {
    const THREE = await import('/node_modules/.vite/deps/three.js');
    const { mountResilientOfficer } = await import('/src/tacticalOfficerFallback.ts');
    const scene = new THREE.Scene();
    const events: string[] = [];
    const callbacks: Array<{
      ok: (texture: THREE.Texture) => void;
      fail: (error: unknown) => void;
      texture: THREE.Texture;
    }> = [];
    let discarded = 0;
    const unit = mountResilientOfficer({
      scene, id: 'science', assetUrl: 'test://officer-walk', at: { x: 1, z: -2 },
      loadTexture: (_url, ok, fail) => {
        const texture = new THREE.Texture();
        texture.addEventListener('dispose', () => { discarded++; });
        callbacks.push({ok, fail, texture});
        return texture;
      },
      onStatus: value => events.push(value),
    });
    unit.setFrame(5);
    callbacks[0].fail(new Error('HTTP 503'));
    const failed = { state: unit.status(), shown: unit.placeholder.visible, atlas: unit.sprite.visible };
    const retryAccepted = unit.retryTexture();
    const retryWhileLoading = unit.retryTexture();
    const restarted = {
      state: unit.status(), shown: unit.placeholder.visible,
      atlas: unit.sprite.visible, requests: callbacks.length,
    };
    // An old request may still signal success after its replacement started.
    callbacks[0].ok(callbacks[0].texture);
    const afterStaleSuccess = {
      state: unit.status(), shown: unit.placeholder.visible, atlas: unit.sprite.visible,
      requests: callbacks.length,
    };
    callbacks[0].fail(new Error('stale failure'));
    const afterStaleFailure = unit.status();
    callbacks[1].ok(callbacks[1].texture);
    const loaded = {
      state: unit.status(), shown: unit.placeholder.visible, atlas: unit.sprite.visible,
      x: callbacks[1].texture.offset.x, y: callbacks[1].texture.offset.y,
      repeatX: callbacks[1].texture.repeat.x, repeatY: callbacks[1].texture.repeat.y,
      rootX: unit.root.position.x, rootY: unit.root.position.y, rootZ: unit.root.position.z,
      attempts: callbacks.length,
    };
    const retryWhileLoaded = unit.retryTexture();
    unit.dispose();
    const retryAfterDispose = unit.retryTexture();
    const removed = !scene.children.includes(unit.root);
    return {
      failed, retryAccepted, retryWhileLoading, restarted, afterStaleSuccess,
      afterStaleFailure, loaded, retryWhileLoaded, retryAfterDispose,
      removed, discarded, events,
    };
  });
  expect(actual.failed).toEqual({ state:'failed', shown:true, atlas:false });
  expect(actual.retryAccepted).toBe(true);
  expect(actual.retryWhileLoading).toBe(false);
  expect(actual.restarted).toEqual({ state:'loading', shown:true, atlas:false, requests:2 });
  expect(actual.afterStaleSuccess).toEqual({ state:'loading', shown:true, atlas:false, requests:2 });
  expect(actual.afterStaleFailure).toBe('loading');
  expect(actual.loaded).toEqual({
    state:'loaded', shown:false, atlas:true,
    x:2/3, y:0, repeatX:1/3, repeatY:1/2,
    rootX:1, rootY:0, rootZ:-2, attempts:2,
  });
  expect(actual.retryWhileLoaded).toBe(false);
  expect(actual.retryAfterDispose).toBe(false);
  expect(actual.removed).toBe(true);
  expect(actual.discarded).toBeGreaterThanOrEqual(2);
  expect(actual.events).toEqual(['failed', 'loading', 'loaded', 'disposed']);
});

test('real Three.TextureLoader recovers from 503 on the next manual attempt', async ({ page }) => {
  test.setTimeout(55_000);
  let offline = true;
  let requests = 0;
  await page.route(femaleWalkUrl, route => {
    requests++;
    if (offline) {
      return route.fulfill({
        status:503,
        headers: { 'content-type':'text/plain', 'access-control-allow-origin':'*', 'cache-control':'no-store' },
        body:'Simulated temporary R2 outage',
      });
    }
    return route.continue();
  });
  await page.goto('/');
  await page.evaluate(async url => {
    const THREE = await import('/node_modules/.vite/deps/three.js');
    const { mountResilientOfficer } = await import('/src/tacticalOfficerFallback.ts');
    const scene = new THREE.Scene();
    const unit = mountResilientOfficer({
      scene, id:'reconnect', assetUrl:url, at:{x:2,z:-3},
    });
    unit.setFrame(4);
    (window as any).__officerRetryUnit = unit;
  }, femaleWalkUrl);
  const unitState = () => page.evaluate(() => {
    const unit = (window as any).__officerRetryUnit;
    const map = unit?.sprite.material.map;
    return { status:unit?.status(), proxy:unit?.placeholder.visible, sprite:unit?.sprite.visible,
      x:unit?.root.position.x, y:unit?.root.position.y, z:unit?.root.position.z,
      offsetX:map?.offset.x ?? null, offsetY:map?.offset.y ?? null };
  });
  await expect.poll(async () => (await unitState()).status).toBe('failed');
  expect(await unitState()).toMatchObject({proxy:true,sprite:false,x:2,y:0,z:-3});
  offline = false;
  const accepted = await page.evaluate(() => (window as any).__officerRetryUnit.retryTexture());
  expect(accepted).toBe(true);
  await expect.poll(async () => (await unitState()).status, {timeout:20_000}).toBe('loaded');
  expect(await unitState()).toEqual({
    status:'loaded', proxy:false, sprite:true,
    x:2,y:0,z:-3,offsetX:1/3,offsetY:0,
  });
  expect(requests).toBeGreaterThanOrEqual(2);
  await page.evaluate(() => {
    (window as any).__officerRetryUnit.dispose();
    delete (window as any).__officerRetryUnit;
  });
});
