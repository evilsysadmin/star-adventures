import * as THREE from 'three';

// Presentation only. Every furnishing occupies the cell authored in the world;
// the existing spatial engine remains the sole authority for navigation/use.
export type BridgePose = { x: number; y: number; heading: string };
type Station = { id: string; x: number; y: number; label: string; type: string };
type BridgeMap = { width: number; height: number; objects: Station[] };

const TILE = 2;
const ANGLES: Record<string, number> = { N: 0, E: -Math.PI / 2, S: Math.PI, W: Math.PI / 2 };

export function createBridgeInterior(canvas: HTMLCanvasElement, map: BridgeMap) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setSize(960, 480, false);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#070e19');
  scene.fog = new THREE.Fog('#101922', 15, 36);
  const camera = new THREE.PerspectiveCamera(58, 2, .05, 80);
  const textures = new Set<THREE.Texture>();
  const materials = new Set<THREE.Material>();
  const geometries = new Set<THREE.BufferGeometry>();
  let disposed = false;
  // A small authored light probe avoids rendering an entire second room into
  // six 256px cube faces every time the bridge is mounted (notably after F5).
  const probe = document.createElement('canvas'); probe.width = 256; probe.height = 128;
  const probeContext = probe.getContext('2d')!;
  const probeGradient = probeContext.createLinearGradient(0, 0, 0, 128);
  probeGradient.addColorStop(0, '#b9c9d1'); probeGradient.addColorStop(.45, '#768890');
  probeGradient.addColorStop(.6, '#52626d'); probeGradient.addColorStop(1, '#292f33');
  probeContext.fillStyle = probeGradient; probeContext.fillRect(0, 0, 256, 128);
  probeContext.fillStyle = '#e8d9b9'; probeContext.fillRect(16, 28, 70, 12);
  probeContext.fillStyle = '#cadce3'; probeContext.fillRect(145, 20, 85, 9);
  const probeTexture = new THREE.CanvasTexture(probe);
  probeTexture.colorSpace = THREE.SRGBColorSpace;
  probeTexture.mapping = THREE.EquirectangularReflectionMapping;
  const generator = new THREE.PMREMGenerator(renderer);
  const environmentTarget = generator.fromEquirectangular(probeTexture);
  scene.environment = environmentTarget.texture;
  scene.environmentIntensity = .55;
  probeTexture.dispose(); generator.dispose();

  const mat = (color: string, metalness = .4, roughness = .46) => {
    const material = new THREE.MeshStandardMaterial({ color, metalness, roughness });
    materials.add(material); return material;
  };
  const luminous = (color: string) => {
    const material = new THREE.MeshBasicMaterial({ color });
    materials.add(material); return material;
  };
  const hull = mat('#35414c', .65, .34), dark = mat('#101820', .48, .38);
  const panel = mat('#53616a', .55, .43), bronze = mat('#b18a54', .72, .32);
  const seat = mat('#28343d', .03, .94), seatEdge = mat('#39444b', .55, .42);
  const cyan = luminous('#80d2d4'), amber = luminous('#f0ba78');
  const soft = luminous('#e2e6d4');
  const box = new THREE.BoxGeometry(1, 1, 1); geometries.add(box);
  const plane = new THREE.PlaneGeometry(1, 1); geometries.add(plane);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 24); geometries.add(cylinder);
  // Shared rounded solid for upholstery and console housings. Modest bevels
  // catch the environment light without a high-poly asset or runtime CSG.
  const outline = new THREE.Shape();
  outline.moveTo(-.4, -.465); outline.lineTo(.4, -.465);
  outline.quadraticCurveTo(.465, -.465, .465, -.4); outline.lineTo(.465, .4);
  outline.quadraticCurveTo(.465, .465, .4, .465); outline.lineTo(-.4, .465);
  outline.quadraticCurveTo(-.465, .465, -.465, .4); outline.lineTo(-.465, -.4);
  outline.quadraticCurveTo(-.465, -.465, -.4, -.465);
  const roundedBox = new THREE.ExtrudeGeometry(outline, {
    depth: .93, bevelEnabled: true, bevelSegments: 2,
    steps: 1, bevelSize: .035, bevelThickness: .035, curveSegments: 3,
  });
  roundedBox.translate(0, 0, -.465); geometries.add(roundedBox);
  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material,
    parent: THREE.Object3D, x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
    const item = new THREE.Mesh(geometry, material);
    item.position.set(x, y, z); item.scale.set(sx, sy, sz); parent.add(item); return item;
  };
  const block = (parent: THREE.Object3D, material: THREE.Material,
    x: number, y: number, z: number, sx: number, sy: number, sz: number) =>
    mesh(box, material, parent, x, y, z, sx, sy, sz);
  const rounded = (parent: THREE.Object3D, material: THREE.Material,
    x: number, y: number, z: number, sx: number, sy: number, sz: number) =>
    mesh(roundedBox, material, parent, x, y, z, sx, sy, sz);
  const point = (x: number, y: number) => ({
    x: (x - (map.width - 1) / 2) * TILE,
    z: (y - (map.height - 1) / 2) * TILE,
  });

  // Canvas-authored instrumentation is decorative: labels identify real
  // stations, never fictitious live stats, percentages or mission achievements.
  const display = (title: string, accent: string, variant = 0) => {
    const source = document.createElement('canvas'); source.width = 512; source.height = 256;
    const ctx = source.getContext('2d')!;
    ctx.fillStyle = '#09171e'; ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = accent; ctx.fillRect(20, 20, 4, 28);
    ctx.font = '600 21px system-ui'; ctx.fillText(title, 38, 43, 450);
    ctx.fillStyle = '#506877'; ctx.font = '11px monospace';
    ctx.fillText('MERIDIAN  /  ESTACIÓN LOCAL', 22, 68);
    ctx.strokeStyle = '#29424d'; ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath(); ctx.moveTo(24, 94 + i * 17); ctx.lineTo(488, 94 + i * 17); ctx.stroke();
    }
    ctx.strokeStyle = accent; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 48; i++) {
      const y = 146 + Math.sin(i * .28 + variant) * 19 + Math.sin(i * .79) * 8;
      if (!i) ctx.moveTo(24, y); else ctx.lineTo(24 + i * 6, y);
    }
    ctx.stroke();
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i % 2 ? '#36535e' : accent;
      ctx.fillRect(363, 100 + i * 22, 65 + (i % 3) * 16, 7);
    }
    ctx.fillStyle = '#be9a68';
    for (let i = 0; i < 6; i++) ctx.fillRect(24 + i * 52, 224, 41, 5);
    const texture = new THREE.CanvasTexture(source); texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); textures.add(texture);
    const material = new THREE.MeshBasicMaterial({ map: texture }); materials.add(material); return material;
  };
  const decal = (parent: THREE.Object3D, material: THREE.Material,
    x: number, y: number, z: number, w: number, h: number, rx = 0, ry = 0) => {
    const item = mesh(plane, material, parent, x, y, z, w, h, 1);
    item.rotation.set(rx, ry, 0); return item;
  };

  // Matte deck with physical seams, recessed brass route lights and a central
  // carpet. All are flat decoration; no extra collision or invisible steps.
  block(scene, dark, 0, -.16, 0, 16, .3, 14);
  const floorA = mat('#263139', .28, .7), floorB = mat('#2d3740', .32, .65);
  for (let x = 1; x < map.width - 1; x++) for (let y = 1; y < map.height - 1; y++) {
    const p = point(x, y);
    block(scene, (x + y) % 2 ? floorA : floorB, p.x, .001, p.z, 1.985, .035, 1.985).receiveShadow = true;
  }
  const carpet = mat('#30353d', .02, 1);
  block(scene, carpet, 0, .025, 1, 4.3, .016, 7.6).receiveShadow = true;
  for (const x of [-2.25, 2.25]) {
    block(scene, bronze, x, .045, 1, .045, .014, 7.7);
    for (const z of [-2, 0, 2, 4]) block(scene, amber, x, .058, z, .055, .012, .38);
  }
  // Recessed room envelope; the northern wall opens onto the main viewscreen.
  block(scene, hull, 0, .43, -6.04, 14.1, .86, .28);
  block(scene, dark, 0, 3.37, 0, 16, .25, 14);
  block(scene, hull, 0, 3.05, -6.04, 14.1, .5, .3);
  for (const x of [-7.08, 7.08]) {
    block(scene, hull, x, 1.62, 0, .2, 3.3, 12.2);
    block(scene, bronze, x * .989, .33, 0, .04, .055, 12);
    block(scene, cyan, x * .985, 2.5, 0, .035, .035, 12);
    for (const z of [-5, -1, 3, 5.5]) {
      block(scene, dark, x * .979, 1.68, z, .18, 3.25, .17);
      block(scene, panel, x * .963, 1.7, z, .12, 2.9, .055);
    }
    for (const z of [-3, 1, 4.2]) {
      block(scene, dark, x * .976, 1.35, z, .16, 1.3, 1.5);
      decal(scene, display('SISTEMAS', '#83babc', z), x * .961, 1.43, z, 1.3, .72, 0, x < 0 ? Math.PI / 2 : -Math.PI / 2);
    }
  }
  block(scene, hull, 0, 1.6, 6.1, 14.3, 3.2, .22);
  for (const x of [-5.5, -3, 3, 5.5]) {
    block(scene, dark, x, 1.6, 5.95, 1.9, 2.7, .12);
    block(scene, panel, x, 1.6, 5.87, 1.72, 2.45, .04);
    block(scene, bronze, x, 2.9, 5.82, 1.74, .035, .04);
  }
  // Overhead structural ribs and broad softbox strips, in contrast to small
  // colored console accents. No bloom/postprocessing or per-frame animation.
  for (const z of [-4.7, -.7, 3.3]) {
    block(scene, hull, 0, 3.12, z, 14, .24, .26);
    block(scene, dark, 0, 2.98, z, 10.8, .12, .38);
    block(scene, soft, 0, 2.91, z, 7.8, .025, .11);
    for (const side of [-1, 1]) block(scene, panel, side * 4.9, 3.19, z + .7, 2.8, .04, .95);
    for (const x of [-6.5, 6.5]) {
      const brace = block(scene, panel, x, 2.72, z, 1.5, .15, .3);
      brace.rotation.z = x < 0 ? .5 : -.5;
    }
  }
  // Original space art is a distant viewscreen, never a substitute interior.
  const viewMaterial = luminous('#142a40');
  const view = decal(scene, viewMaterial, 0, 1.94, -6.18, 13.6, 2.22);
  new THREE.TextureLoader().load('/art/meridian-orbit-v1.webp', texture => {
    if (disposed) { texture.dispose(); return; }
    texture.colorSpace = THREE.SRGBColorSpace;
    // Cover the panoramic glass without stretching the spherical planet.
    texture.repeat.set(1, 2 / (13.6 / 2.22));
    texture.offset.y = (1 - texture.repeat.y) / 2;
    textures.add(texture);
    const art = new THREE.MeshBasicMaterial({ map: texture }); materials.add(art);
    view.material = art; renderer.render(scene, camera);
    canvas.dataset.bridgeArtLoaded = 'true';
  }, undefined, () => { /* The dark viewscreen remains a valid offline fallback. */ });
  for (const x of [-6.9, 6.9]) block(scene, bronze, x, 1.95, -6, .12, 2.45, .3);
  block(scene, bronze, 0, .81, -5.99, 13.8, .055, .22);
  block(scene, cyan, 0, .75, -5.87, 13.7, .023, .04);

  function chair(parent: THREE.Object3D, x = 0, z = .35, captain = false) {
    const frame = new THREE.Group(); parent.add(frame); parent = frame;
    // Standing eye height must clear the helm headrest when using its console.
    // The command chair retains its taller silhouette.
    frame.scale.y = captain ? 1 : .78;
    mesh(cylinder, dark, parent, x, .14, z, .48, .18, .48);
    mesh(cylinder, panel, parent, x, .38, z, .1, .45, .1);
    rounded(parent, seatEdge, x, .62, z, .88, .18, .83);
    rounded(parent, seat, x, .73, z - .03, .77, .16, .71);
    const back = rounded(parent, seatEdge, x, 1.05, z + .36, .87, .92, .18);
    back.rotation.x = -.1;
    rounded(parent, seat, x, 1.1, z + .24, .72, .71, .1);
    rounded(parent, seat, x, 1.12, z + .47, .69, .58, .07);
    rounded(parent, seat, x, 1.56, z + .4, .6, .18, .2);
    block(parent, bronze, x, 1.35, z + .515, .13, .025, .012);
    for (const side of [-1, 1]) {
      block(parent, seatEdge, x + side * .28, 1.1, z + .51, .012, .43, .012);
    }
    for (const side of [-1, 1]) {
      block(parent, dark, x + side * .5, .81, z, .12, .45, .7);
      rounded(parent, captain ? bronze : panel, x + side * .5, 1.04, z, .17, .07, .72);
      block(parent, cyan, x + side * .5, 1.09, z - .16, .1, .012, .19);
    }
  }

  const shadowSource = document.createElement('canvas'); shadowSource.width = shadowSource.height = 64;
  const shadowContext = shadowSource.getContext('2d')!;
  const shadowGradient = shadowContext.createRadialGradient(32, 32, 3, 32, 32, 32);
  shadowGradient.addColorStop(0, '#000000b0'); shadowGradient.addColorStop(1, '#00000000');
  shadowContext.fillStyle = shadowGradient; shadowContext.fillRect(0, 0, 64, 64);
  const shadowTexture = new THREE.CanvasTexture(shadowSource); textures.add(shadowTexture);
  const contactShadow = new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false });
  materials.add(contactShadow);

  for (const station of map.objects) {
    const p = point(station.x, station.y);
    const group = new THREE.Group(); group.position.set(p.x, 0, p.z);
    group.name = station.id; scene.add(group);
    decal(group, contactShadow, 0, .072, .15, 2.05, 2.05, -Math.PI / 2);
    if (station.id === 'captain') {
      chair(group, 0, 0, true);
      block(group, bronze, 0, .03, 0, 1.75, .025, 1.75);
      block(group, dark, 0, .05, 0, 1.65, .025, 1.65);
      // Re-add chair's pedestal above the flat decorative base.
      continue;
    }
    if (station.type === 'transition') {
      block(group, dark, 0, 1.4, .55, 1.85, 2.8, .3);
      for (const side of [-1, 1]) {
        block(group, panel, side * .44, 1.4, .35, .84, 2.7, .08);
        block(group, cyan, side * .78, 1.4, .28, .035, 2.35, .025);
      }
      block(group, bronze, 0, 2.77, .28, 1.85, .08, .12);
      decal(group, display('TRANSPORTE', '#a4d7cc'), 0, 2.51, .29, 1.25, .3, 0, Math.PI);
      continue;
    }
    const side = station.id === 'science' ? 1 : station.id === 'tactical' ? -1 : 0;
    group.rotation.y = side * Math.PI / 2;
    block(group, dark, 0, .46, 0, 1.55, .9, .77);
    rounded(group, hull, 0, .75, -.08, 1.78, .38, .96);
    block(group, bronze, 0, .94, .42, 1.75, .045, .06);
    const screen = rounded(group, dark, 0, 1.08, -.08, 1.66, .14, .93);
    screen.rotation.x = .34;
    const title = station.id === 'science' ? 'CIENCIA' : station.id === 'tactical' ? 'SEGURIDAD'
      : station.id === 'helm' ? 'NAVEGACIÓN' : 'COMUNICACIONES';
    decal(group, display(title, side < 0 ? '#e3af76' : '#8ed5cf', station.x),
      0, 1.16, -.1, 1.51, .73, -Math.PI / 2 + .34);
    for (let i = 0; i < 5; i++) block(group, i % 2 ? amber : cyan, -.55 + i * .27, .78, .49, .14, .025, .025);
    for (let i = 0; i < 7; i++) block(group, panel, -.57 + i * .19, .41, .405, .1, .18, .025);
    // Back monitor has enough height to read across the bridge.
    block(group, hull, 0, 1.26, -.43, 1.63, .59, .11);
    decal(group, display(title, '#a5cdd4', station.y), 0, 1.28, -.365, 1.48, .47);
    // Chairs stay inside the already solid station tile.
    chair(group, 0, .4);
  }

  // Include nested chair frames, while excluding the room envelope and the
  // flat screen/contact-shadow decals from the cached furniture shadow map.
  for (const child of scene.children) if (child instanceof THREE.Group && child.name) {
    child.traverse(item => {
      if (item instanceof THREE.Mesh && item.geometry !== plane) {
        item.castShadow = true; item.receiveShadow = true;
      }
    });
  }

  scene.add(new THREE.HemisphereLight('#b6d6e7', '#403126', 1.6));
  const key = new THREE.DirectionalLight('#f2d5ad', 3.1); key.position.set(-4, 7, 4); scene.add(key);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: .5, far: 25 });
  key.shadow.bias = -.0003; key.shadow.normalBias = .025;
  const fill = new THREE.DirectionalLight('#79b8df', 1.5); fill.position.set(1, 3, -8); scene.add(fill);
  const aft = new THREE.PointLight('#e4bc88', 25, 15, 2); aft.position.set(0, 2.8, 4.5); scene.add(aft);

  return {
    render(pose: BridgePose, alert: boolean) {
      if (disposed) return;
      const p = point(pose.x, pose.y);
      camera.position.set(p.x, 1.72, p.z);
      camera.rotation.set(-.055, ANGLES[pose.heading] ?? 0, 0, 'YXZ');
      aft.color.set(alert ? '#f39975' : '#e4bc88');
      renderer.render(scene, camera);
      canvas.dataset.bridgePose = `${pose.x}:${pose.y}:${pose.heading}`;
      canvas.dataset.bridgeRendered = 'true';
    },
    dispose() {
      disposed = true;
      geometries.forEach(item => item.dispose()); materials.forEach(item => item.dispose());
      textures.forEach(item => item.dispose()); scene.clear();
      environmentTarget.dispose();
      key.shadow.dispose();
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}
