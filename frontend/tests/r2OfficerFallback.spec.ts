import { test, expect } from '@playwright/test';

test('a missing atlas leaves a stable visible officer proxy, then successful decode restores sprite', async ({ page }) => {
  await page.goto('/');
  const outcome = await page.evaluate(async () => {
    const THREE = await import('/node_modules/.vite/deps/three.js');
    const { mountResilientOfficer } = await import('/src/tacticalOfficerFallback.ts');
    const scene = new THREE.Scene();
    const events: string[] = [];
    let succeeded: ((texture: any) => void) | undefined;
    let failed: ((error: unknown) => void) | undefined;
    const unit = mountResilientOfficer({
      scene, id: 'science', assetUrl: 'https://example.invalid/officer.webp',
      at: { x: 2, z: -3 },
      onStatus: status => events.push(status),
      loadTexture: (_url, onLoad, onError) => {
        succeeded = onLoad;
        failed = onError;
        return new THREE.Texture();
      },
    });
    const before = {
      state: unit.status(), visible: unit.placeholder.visible,
      sprite: unit.sprite.visible, pieces: unit.placeholder.children.length,
      x: unit.root.position.x, z: unit.root.position.z,
      mounted: scene.children.includes(unit.root),
    };
    failed!(new Error('HTTP 503'));
    const outage = {
      state: unit.status(), placeholder: unit.placeholder.visible,
      sprite: unit.sprite.visible, pieces: unit.placeholder.children.length,
    };
    const replacement = new THREE.Texture();
    succeeded!(replacement);
    const recovered = {
      state: unit.status(), placeholder: unit.placeholder.visible,
      sprite: unit.sprite.visible, columns: replacement.repeat.x,
      rows: replacement.repeat.y, colorSpace: replacement.colorSpace,
    };
    unit.setTile(4, 5);
    const position = { x: unit.root.position.x, z: unit.root.position.z };
    unit.dispose();
    const removed = !scene.children.includes(unit.root);
    const stateAfterDispose = unit.status();
    // An asynchronous callback racing cleanup cannot resurrect stale actors.
    succeeded!(new THREE.Texture());
    return { before, outage, recovered, position, events,
      removed, stateAfterDispose, final: unit.status(),
      fallbackAfterDispose: unit.placeholder.visible };
  });
  expect(outcome.before).toMatchObject({
    state: 'loading', visible: true, sprite: false,
    pieces: 3, x: 2, z: -3, mounted: true,
  });
  expect(outcome.outage).toEqual({
    state: 'failed', placeholder: true, sprite: false, pieces: 3,
  });
  expect(outcome.recovered).toMatchObject({
    state: 'loaded', placeholder: false, sprite: true,
    columns: 1/3, rows: 1/2,
  });
  expect(outcome.position).toEqual({ x: 4, z: 5 });
  expect(outcome.events).toEqual(['failed', 'loaded', 'disposed']);
  expect(outcome.removed).toBe(true);
  expect(outcome.stateAfterDispose).toBe('disposed');
  expect(outcome.final).toBe('disposed');
  expect(outcome.fallbackAfterDispose).toBe(false);
});

test('an atlas loader exception does not create invisible officers or corrupt the grid', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const THREE = await import('/node_modules/.vite/deps/three.js');
    const { mountResilientOfficer } = await import('/src/tacticalOfficerFallback.ts');
    const scene = new THREE.Scene();
    const unit = mountResilientOfficer({
      scene, id: 'tactical', assetUrl: 'broken://officer.webp', at: {x:0,z:0},
      loadTexture: () => { throw new Error('decoder unavailable'); },
    });
    const state = {
      status: unit.status(), visible: unit.placeholder.visible,
      spriteVisible: unit.sprite.visible, children: scene.children.length,
    };
    unit.dispose();
    return state;
  });
  expect(result).toEqual({ status:'failed', visible:true, spriteVisible:false, children:1 });
});

test('isolated offline fallback model is visibly rendered at mobile width', async ({ page }) => {
  await page.setViewportSize({ width:390, height:850 });
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const THREE = await import('/node_modules/.vite/deps/three.js');
    const { mountResilientOfficer } = await import('/src/tacticalOfficerFallback.ts');
    const canvas = document.createElement('canvas');
    canvas.id = 'isolated-officer-fallback';
    canvas.style.cssText = 'display:block;width:320px;height:320px;margin:16px auto;border:1px solid #496a7c;';
    document.body.append(canvas);
    const renderer = new THREE.WebGLRenderer({canvas, antialias:true});
    renderer.setSize(320,320,false);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0c2031');
    const camera = new THREE.OrthographicCamera(-1.65, 1.65, 1.65, -1.65, 0.1, 100);
    camera.position.set(4,4.2,5.8); camera.lookAt(0,.75,0);
    camera.updateProjectionMatrix();
    const officer = mountResilientOfficer({
      scene, id:'test-no-cdn', assetUrl:'offline://unavailable', at:{x:0,z:0},
      accent:0x6bbfc0,
      loadTexture: (_url, _onLoad, onError) => {
        onError(new Error('503'));
        return new THREE.Texture();
      },
    });
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(2.5,2.5),
      new THREE.MeshBasicMaterial({color:0x36505b,side:THREE.DoubleSide}),
    );
    ground.rotation.x=-Math.PI/2;
    scene.add(ground);
    renderer.render(scene,camera);
    return { status:officer.status(), visible:officer.placeholder.visible,
      spriteVisible:officer.sprite.visible, canvasWidth:canvas.width,
      canvasHeight:canvas.height };
  });
  expect(result).toMatchObject({status:'failed',visible:true,spriteVisible:false,canvasWidth:320,canvasHeight:320});
  const element = page.locator('#isolated-officer-fallback');
  await expect(element).toBeVisible();
  await element.screenshot({path:'test-results/r2-officer-fallback-390.png'});
});
