import * as THREE from 'three';

// Presentation only. Every furnishing occupies the cell authored in the world;
// the existing spatial engine remains the sole authority for navigation/use.
export type BridgePose = { x: number; y: number; heading: string; seated?: boolean };
export type BridgeCrewStation = 'captain' | 'helm' | 'science' | 'comms' | 'tactical';
export type BridgeCrewRoster = Readonly<Record<BridgeCrewStation, Readonly<{ id: string; name: string }>>>;
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
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#070e19');
  scene.fog = new THREE.Fog('#101922', 19, 40);
  const camera = new THREE.PerspectiveCamera(58, 2, .05, 80);
  const textures = new Set<THREE.Texture>();
  const materials = new Set<THREE.Material>();
  const geometries = new Set<THREE.BufferGeometry>();
  const batches = new Set<THREE.InstancedMesh>();
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
  scene.environmentIntensity = .7;
  probeTexture.dispose(); generator.dispose();

  const mat = (color: string, metalness = .4, roughness = .46) => {
    const material = new THREE.MeshStandardMaterial({ color, metalness, roughness });
    materials.add(material); return material;
  };
  const luminous = (color: string) => {
    const material = new THREE.MeshBasicMaterial({ color });
    materials.add(material); return material;
  };
  const hull = mat('#827779', .52, .4), dark = mat('#181a28', .48, .38);
  const panel = mat('#b1a4a1', .46, .41), bronze = mat('#bd9368', .72, .32);
  const instrumentShell = mat('#484654', .38, .62);
  const seat = mat('#593c47', .03, .94), seatEdge = mat('#77616a', .55, .42);
  const captainLeather = mat('#344751', .12, .78);
  const commandSeatShell = mat('#202f39', .35, .58);
  const cyan = luminous('#80d2d4'), amber = luminous('#f0ba78');
  const soft = luminous('#fff1cd');
  // Small deterministic surface maps provide scale at standing distance.
  // They are authored here; no external image, model or frame loop is needed.
  const surface = (kind: 'fabric' | 'metal' | 'deck', repeat: number) => {
    const source = document.createElement('canvas'); source.width = source.height = 128;
    const ctx = source.getContext('2d')!;
    const pixels = ctx.createImageData(128, 128);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      const grain = ((x * 73 + y * 137 + x * y * 17) % 31) - 15;
      const weave = kind === 'fabric' ? ((x % 4 < 2) !== (y % 4 < 2) ? 24 : -24)
        : kind === 'metal' ? ((y % 3) * 9 - 9) : (x % 16 === 0 || y % 16 === 0 ? -15 : 0);
      const i = (y * 128 + x) * 4;
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = 128 + grain + weave;
      pixels.data[i + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
    const texture = new THREE.CanvasTexture(source);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(repeat, repeat);
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    textures.add(texture); return texture;
  };
  seat.bumpMap = surface('fabric', 3); seat.bumpScale = .018;
  hull.bumpMap = surface('metal', 2); hull.bumpScale = .009;
  panel.bumpMap = hull.bumpMap; panel.bumpScale = .006;
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
  // A manufactured wedge, rather than a stack of cuboids, for the desk body.
  const deskProfile = new THREE.Shape();
  deskProfile.moveTo(-.46, .78); deskProfile.lineTo(.44, .78);
  deskProfile.lineTo(.44, 1.33); deskProfile.lineTo(.29, 1.36);
  deskProfile.lineTo(-.46, 1.04); deskProfile.closePath();
  const deskGeometry = new THREE.ExtrudeGeometry(deskProfile, {
    depth: 1.64, bevelEnabled: true, bevelSegments: 2, steps: 1,
    bevelSize: .035, bevelThickness: .035,
  });
  deskGeometry.translate(0, 0, -.82); deskGeometry.rotateY(Math.PI / 2);
  geometries.add(deskGeometry);
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
    const source = document.createElement('canvas'); source.width = 768; source.height = 384;
    const ctx = source.getContext('2d')!;
    ctx.fillStyle = '#07171e'; ctx.fillRect(0, 0, 768, 384);
    ctx.fillStyle = '#152e37'; ctx.fillRect(0, 0, 768, 75);
    ctx.fillStyle = accent; ctx.fillRect(24, 21, 4, 30);
    ctx.font = '500 27px system-ui'; ctx.fillText(title, 43, 47, 690);
    ctx.fillStyle = '#91acb0'; ctx.font = '12px monospace';
    ctx.fillText('MERIDIAN  /  DIAGRAMA DE ESTACIÓN', 28, 100);
    ctx.strokeStyle = '#25434c'; ctx.lineWidth = 1;
    for (let x = 28; x < 525; x += 26) {
      ctx.beginPath(); ctx.moveTo(x, 119); ctx.lineTo(x, 322); ctx.stroke();
    }
    for (let y = 119; y < 328; y += 26) {
      ctx.beginPath(); ctx.moveTo(28, y); ctx.lineTo(525, y); ctx.stroke();
    }
    ctx.strokeStyle = accent; ctx.lineWidth = 2;
    if (title === 'NAVEGACIÓN' || title === 'SEGURIDAD') {
      // Authored orbital/sector schematic, without simulated sensor numbers.
      for (const radius of [40, 75, 108]) {
        ctx.beginPath(); ctx.ellipse(274, 223, radius * 1.7, radius * .8, -.17, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = accent;
      ctx.beginPath(); ctx.moveTo(274, 206); ctx.lineTo(284, 235); ctx.lineTo(274, 229); ctx.lineTo(264, 235); ctx.closePath(); ctx.fill();
      ctx.setLineDash([4, 9]); ctx.beginPath(); ctx.moveTo(274, 223); ctx.lineTo(447, 157); ctx.stroke(); ctx.setLineDash([]);
    } else if (title === 'CIENCIA') {
      for (let line = 0; line < 3; line++) {
        ctx.globalAlpha = 1 - line * .22; ctx.beginPath();
        for (let i = 0; i <= 100; i++) {
          const y = 211 + line * 16 + Math.sin(i * .12 + variant) * 25 + Math.sin(i * .43) * 13;
          if (!i) ctx.moveTo(28, y); else ctx.lineTo(28 + i * 4.95, y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else {
      for (let i = 0; i < 29; i++) {
        const h = 15 + Math.abs(Math.sin(i * .57 + variant)) * 120;
        ctx.fillStyle = i % 4 ? accent : '#e6bb8d'; ctx.fillRect(35 + i * 16, 224 - h / 2, 7, h);
      }
    }
    ctx.fillStyle = '#17343e'; ctx.fillRect(548, 121, 192, 204);
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i % 2 ? '#527279' : accent;
      ctx.fillRect(564, 139 + i * 36, 12, 12);
      ctx.fillRect(590, 139 + i * 36, 119, 3);
      ctx.fillStyle = '#557078'; ctx.fillRect(590, 148 + i * 36, 75, 3);
    }
    ctx.fillStyle = '#93a7a5'; ctx.font = '11px monospace'; ctx.fillText('INTERFAZ LOCAL', 28, 359);
    ctx.fillStyle = '#be9a68';
    for (let i = 0; i < 7; i++) ctx.fillRect(382 + i * 51, 347, 41, 10);
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
  floorA.bumpMap = surface('deck', 4); floorA.bumpScale = .014;
  floorB.bumpMap = floorA.bumpMap; floorB.bumpScale = .014;
  const deckSource = document.createElement('canvas'); deckSource.width = deckSource.height = 256;
  const deckContext = deckSource.getContext('2d')!;
  deckContext.fillStyle = '#d2d9d7'; deckContext.fillRect(0, 0, 256, 256);
  deckContext.strokeStyle = '#a4b0af'; deckContext.lineWidth = 1;
  deckContext.strokeRect(12.5, 12.5, 231, 231);
  deckContext.strokeStyle = '#bbc4c3'; deckContext.strokeRect(15.5, 15.5, 225, 225);
  deckContext.fillStyle = '#708282';
  for (const x of [8, 248]) for (const y of [8, 248]) {
    deckContext.beginPath(); deckContext.arc(x, y, 1.5, 0, Math.PI * 2); deckContext.fill();
  }
  const deckTexture = new THREE.CanvasTexture(deckSource);
  deckTexture.colorSpace = THREE.SRGBColorSpace;
  deckTexture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); textures.add(deckTexture);
  floorA.map = floorB.map = deckTexture;
  for (let x = 1; x < map.width - 1; x++) for (let y = 1; y < map.height - 1; y++) {
    const p = point(x, y);
    block(scene, (x + y) % 2 ? floorA : floorB, p.x, .001, p.z, 1.985, .035, 1.985).receiveShadow = true;
  }
  const carpet = mat('#403541', .02, 1); carpet.bumpMap = seat.bumpMap; carpet.bumpScale = .02;
  block(scene, carpet, 0, .025, 1, 4.3, .016, 7.6).receiveShadow = true;
  for (const x of [-2.25, 2.25]) {
    block(scene, bronze, x, .045, 1, .045, .014, 7.7);
    for (const z of [-2, 0, 2, 4]) block(scene, amber, x, .058, z, .055, .012, .38);
  }
  // Recessed room envelope; the northern wall opens onto the main viewscreen.
  block(scene, hull, 0, .43, -6.04, 14.1, .86, .28);
  block(scene, dark, 0, 4.27, 0, 16, .25, 14);
  block(scene, hull, 0, 3.65, -6.04, 14.1, .9, .3);
  for (const x of [-7.08, 7.08]) {
    block(scene, hull, x, 2.05, 0, .2, 4.15, 12.2);
    block(scene, bronze, x * .989, .33, 0, .04, .055, 12);
    block(scene, cyan, x * .985, 2.95, 0, .035, .025, 12);
    for (const z of [-5, -1, 3, 5.5]) {
      block(scene, dark, x * .979, 2.1, z, .24, 4.2, .28);
      block(scene, panel, x * .963, 1.8, z, .12, 3.35, .09);
      const strut = block(scene, panel, x * .91, 3.66, z, 1.25, .18, .28);
      strut.rotation.z = x < 0 ? .65 : -.65;
    }
    for (const z of [-3, 1, 4.2]) {
      block(scene, dark, x * .976, 1.35, z, .16, 1.3, 1.5);
      decal(scene, display('SISTEMAS', '#83babc', z), x * .961, 1.43, z, 1.3, .72, 0, x < 0 ? Math.PI / 2 : -Math.PI / 2);
      // Recessed acoustic panels and service vents give the envelope scale.
      block(scene, dark, x * .974, 2.52, z, .12, .37, 2.1);
      for (let i = 0; i < 9; i++) block(scene, panel, x * .962, 2.52, z - .84 + i * .21, .04, .26, .024);
      block(scene, dark, x * .975, .46, z, .13, .55, 2.1);
      for (let i = 0; i < 5; i++) block(scene, hull, x * .962, .27 + i * .09, z, .025, .025, 1.85);
    }
  }
  block(scene, hull, 0, 2.05, 6.1, 14.3, 4.1, .22);
  for (const x of [-5.5, -3, 3, 5.5]) {
    block(scene, dark, x, 1.6, 5.95, 1.9, 2.7, .12);
    block(scene, panel, x, 1.6, 5.87, 1.72, 2.45, .04);
    block(scene, bronze, x, 2.9, 5.82, 1.74, .035, .04);
  }
  // A raised, coffered ceiling replaces the low flat test-room lid.
  // All overhead elements clear the standing camera in every walkable cell.
  for (const z of [-4.7, -.7, 3.3]) {
    block(scene, hull, 0, 4.04, z, 14, .22, .28);
    block(scene, dark, 0, 3.91, z, 10.8, .12, .44);
    block(scene, soft, 0, 3.84, z, 8.8, .025, .075);
    for (const side of [-1, 1]) {
      block(scene, panel, side * 4.9, 4.09, z + .7, 2.8, .04, .95);
      // Warm recessed diffusers give the overhead structure a recognizable
      // source of light, without another shadowed light or animation loop.
      block(scene, soft, side * 4.9, 3.98, z + .7, 2.3, .018, .54);
      block(scene, bronze, side * 4.9, 3.985, z + .97, 2.4, .024, .026);
      const brace = block(scene, hull, side * 5.8, 3.69, z, 2.2, .15, .35);
      brace.rotation.z = side * -.4;
    }
  }
  // An elliptical light well establishes the command area without a raised
  // platform or a step that the rules engine would not know about.
  const haloGeometry = new THREE.TorusGeometry(2.65, .065, 6, 64); geometries.add(haloGeometry);
  const halo = mesh(haloGeometry, bronze, scene, 0, 3.9, 1, 1.45, 1, 1);
  halo.rotation.x = Math.PI / 2;
  const haloLightGeometry = new THREE.TorusGeometry(2.65, .018, 4, 64); geometries.add(haloLightGeometry);
  const haloLight = mesh(haloLightGeometry, soft, scene, 0, 3.84, 1, 1.45, 1, 1);
  haloLight.rotation.x = Math.PI / 2;
  for (const x of [-3.2, 3.2]) {
    block(scene, hull, x, 4.17, 0, .16, .1, 11.8);
    block(scene, cyan, x, 4.1, 0, .025, .01, 11.6);
  }
  // Original space art is a distant viewscreen, never a substitute interior.
  const viewMaterial = luminous('#142a40');
  const view = decal(scene, viewMaterial, 0, 2.03, -6.18, 13.6, 2.42);
  new THREE.TextureLoader().load('/art/meridian-orbit-v1.webp', texture => {
    if (disposed) { texture.dispose(); return; }
    texture.colorSpace = THREE.SRGBColorSpace;
    // Cover the panoramic glass without stretching the spherical planet.
    texture.repeat.set(1, 2 / (13.6 / 2.42));
    texture.offset.y = (1 - texture.repeat.y) / 2;
    textures.add(texture);
    const art = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }); materials.add(art);
    view.material = art; renderer.render(scene, camera);
    canvas.dataset.bridgeArtLoaded = 'true';
  }, undefined, () => { /* The dark viewscreen remains a valid offline fallback. */ });
  // A continuous, softly rounded aperture gives the main screen a single
  // panoramic silhouette. The frame is decorative and sits in the existing
  // wall; it does not change the walkable grid or station interactions.
  const screenFrame = new THREE.Shape();
  screenFrame.moveTo(-7, .72); screenFrame.lineTo(7, .72);
  screenFrame.lineTo(7, 3.38); screenFrame.lineTo(-7, 3.38); screenFrame.closePath();
  const opening = new THREE.Path();
  opening.moveTo(-6.55, 1.2); opening.quadraticCurveTo(-6.55, .88, -6.15, .88);
  opening.lineTo(6.15, .88); opening.quadraticCurveTo(6.55, .88, 6.55, 1.2);
  opening.lineTo(6.55, 2.78); opening.quadraticCurveTo(6.55, 3.17, 6.08, 3.17);
  opening.lineTo(-6.08, 3.17); opening.quadraticCurveTo(-6.55, 3.17, -6.55, 2.78);
  opening.closePath(); screenFrame.holes.push(opening);
  const frameGeometry = new THREE.ExtrudeGeometry(screenFrame, {
    depth: .18, bevelEnabled: true, bevelThickness: .04, bevelSize: .04,
    bevelSegments: 2, curveSegments: 12,
  });
  geometries.add(frameGeometry);
  mesh(frameGeometry, instrumentShell, scene, 0, 0, -6.01, 1, 1, 1);
  block(scene, soft, 0, 3.25, -5.79, 11.9, .018, .035);
  const identitySource = document.createElement('canvas'); identitySource.width = 1024; identitySource.height = 128;
  const identity = identitySource.getContext('2d')!;
  identity.fillStyle = '#1a292e'; identity.fillRect(0, 0, 1024, 128);
  identity.strokeStyle = '#bb9a6a'; identity.lineWidth = 2;
  identity.beginPath(); identity.moveTo(43, 64); identity.lineTo(68, 39); identity.lineTo(93, 64);
  identity.lineTo(68, 89); identity.closePath(); identity.stroke();
  identity.fillStyle = '#e3c99b'; identity.font = '500 46px system-ui';
  identity.fillText('M E R I D I A N', 136, 80);
  identity.fillStyle = '#96adb2'; identity.font = '18px monospace'; identity.fillText('PUENTE / 01', 754, 73);
  const identityTexture = new THREE.CanvasTexture(identitySource); identityTexture.colorSpace = THREE.SRGBColorSpace;
  textures.add(identityTexture);
  const identityMaterial = new THREE.MeshBasicMaterial({ map: identityTexture }); materials.add(identityMaterial);
  decal(scene, identityMaterial, 0, 3.68, -5.86, 5.4, .675);
  block(scene, bronze, 0, .81, -5.99, 13.8, .055, .22);
  block(scene, cyan, 0, .75, -5.87, 13.7, .023, .04);

  function chair(parent: THREE.Object3D, x = 0, z = .35, captain = false) {
    const frame = new THREE.Group(); parent.add(frame); parent = frame;
    // Standing eye height must clear the helm headrest when using its console.
    // The command chair retains its taller silhouette.
    frame.scale.y = captain ? 1 : .68;
    if (captain) {
      // A low, open-backed command seat keeps the occupant visible. The
      // armrests carry the controls; there is no panel resembling a desk.
      mesh(cylinder, dark, parent, x, .14, z, .43, .18, .43);
      mesh(cylinder, panel, parent, x, .38, z, .12, .45, .12);
      rounded(parent, seatEdge, x, .62, z, .80, .15, .75);
      rounded(parent, captainLeather, x, .72, z - .02, .72, .15, .65);
      rounded(parent, commandSeatShell, x, .98, z + .32, .76, .65, .15);
      rounded(parent, captainLeather, x, 1.01, z + .40, .62, .49, .08);
      for (const side of [-1, 1]) {
        block(parent, dark, x + side * .43, .83, z, .10, .38, .57);
        rounded(parent, seatEdge, x + side * .43, 1.03, z, .15, .07, .65);
        block(parent, dark, x + side * .43, 1.08, z - .20, .11, .012, .26);
        for (let i = 0; i < 3; i++)
          block(parent, i === 2 ? amber : cyan, x + side * .43, 1.09, z - .28 + i * .08, .065, .008, .04);
      }
      return;
    }
    mesh(cylinder, dark, parent, x, .14, z, .48, .18, .48);
    mesh(cylinder, panel, parent, x, .38, z, .1, .45, .1);
    rounded(parent, seatEdge, x, .62, z, .88, .18, .83);
    rounded(parent, seat, x, .73, z - .03, .77, .16, .71);
    const back = rounded(parent, seatEdge, x, 1.05, z + .36, .87, .92, .18);
    back.rotation.x = -.1;
    rounded(parent, seat, x, 1.1, z + .24, .72, .71, .1);
    for (const side of [-1, 1]) {
      rounded(parent, seatEdge, x + side * .37, 1.08, z + .22, .11, .66, .18);
      block(parent, bronze, x + side * .31, 1.14, z + .286, .012, .5, .008);
    }
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
      if (captain) {
        // Tiny practical controls sit on the existing armrest, not in a
        // floating HUD. They remain decorative; actions use the real menu.
        block(parent, dark, x + side * .5, 1.105, z - .23, .13, .012, .34);
        for (let i = 0; i < 4; i++)
          block(parent, i === 3 ? amber : cyan, x + side * .5, 1.114,
            z - .35 + i * .08, .075, .008, .045);
      }
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

  // Original, low-poly bridge personnel. Their identity and appearance follow
  // the saved roster; the pure engine remains authoritative for commands.
  // Shared geometry/materials join the room's existing batching/disposal path.
  const officerOval = new THREE.SphereGeometry(1, 14, 10); geometries.add(officerOval);
  // A gently tapered head and a close-fitting scalp replace overlapping hair
  // spheres. The scalp shares the same underlying shape instead of forming a
  // separate helmet, and its lower edge follows the back of the head.
  const headGeometry = new THREE.SphereGeometry(1, 28, 20);
  const scalpGeometry = new THREE.SphereGeometry(1, 28, 20, 0, Math.PI * 2, 0, Math.PI * .69);
  const shapeHead = (geometry: THREE.SphereGeometry) => {
    const positions = geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
      const taper = 1 - .14 * Math.max(0, -y);
      positions.setXYZ(i, x * taper, y, z * (1 - .08 * Math.max(0, -y)));
    }
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    geometries.add(geometry);
  };
  shapeHead(headGeometry); shapeHead(scalpGeometry);
  // The imported head includes a neck/shoulder base. Command figures use
  // their own smooth neck, so keep a separate head geometry.
  const commandHeadGeometry = headGeometry.clone(); geometries.add(commandHeadGeometry);
  // Fine, deterministic variation on the actual scalp mesh breaks up the
  // single glossy helmet shape without importing a hair texture or asset.
  const commandScalpGeometry = scalpGeometry.clone(); geometries.add(commandScalpGeometry);
  const shadeCommandScalp = (geometry:THREE.BufferGeometry) => {
    const position = geometry.getAttribute('position');
    const shades = new Float32Array(position.count * 3);
    for (let i=0; i<position.count; i++) {
      const x=position.getX(i), y=position.getY(i), z=position.getZ(i);
      const wave=Math.sin(x*47 + Math.sin(y*19)*1.6 + z*13);
      const value=.80 + .20*(wave*.5+.5);
      shades[i*3]=value; shades[i*3+1]=value; shades[i*3+2]=value;
    }
    geometry.setAttribute('color',new THREE.BufferAttribute(shades,3));
  };
  shadeCommandScalp(commandScalpGeometry);
  const coats: Record<string, THREE.MeshStandardMaterial> = {
    helm: mat('#8f593e', .08, .77),
    science: mat('#287b83', .08, .77),
    comms: mat('#665c92', .08, .77),
    tactical: mat('#9b783a', .08, .77),
  };
  const uniformTrim = mat('#d0ab7a', .35, .56);
  // Materials belong to a physical post; updating an assignment recolors its
  // existing instanced geometry without rebuilding the room or its shadows.
  const skinByPost: Record<string, THREE.MeshStandardMaterial> = {
    helm: mat('#bb896d', .03, .9), science: mat('#805a46', .03, .9),
    comms: mat('#d4a47d', .03, .9), tactical: mat('#ab765d', .03, .9),
  };
  const hairByPost: Record<string, THREE.MeshStandardMaterial> = {
    helm: mat('#352e2a', .04, .9), science: mat('#1b2630', .04, .9),
    comms: mat('#60452e', .04, .9), tactical: mat('#322f40', .04, .9),
  };
  const captainSkin = mat('#d4a47d', .03, .9);
  const captainHair = mat('#1b2630', .02, .98);
  captainHair.vertexColors = true;
  // Original illustrative palettes keyed by the game's six canonical IDs.
  // They follow the officer between posts, but do not claim to be portraits.
  const appearances: Record<string, readonly [string, string, string]> = {
    varela: ['#355967', '#d4a47d', '#1b2630'],
    solan: ['#566a84', '#805a46', '#1b2630'],
    venn: ['#287b83', '#bb896d', '#352e2a'],
    dorn: ['#9b783a', '#ab765d', '#322f40'],
    rhee: ['#8f593e', '#d8a988', '#60452e'],
    mira: ['#665c92', '#a57862', '#332527'],
  };
  // The original bridge has no separate navigation/helm staff slot.
  // The helm console is covered visually by the assigned engineering officer;
  // orders still use their existing canonical station checks.
  const deckPosts = ['helm', 'science', 'comms', 'tactical'] as const;
  const nameplates = new Map<string, (name: string) => void>();
  const stationFocusMaterials = new Map<string, THREE.MeshBasicMaterial>();
  const makeStationFocus = (id: string) => {
    const material = luminous('#1d404a');
    stationFocusMaterials.set(id, material);
    return material;
  };
  const makeNameplate = (post: string, title: string) => {
    const source = document.createElement('canvas'); source.width = 768; source.height = 256;
    const ctx = source.getContext('2d')!;
    const texture = new THREE.CanvasTexture(source);
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.add(texture);
    const material = new THREE.MeshBasicMaterial({ map: texture }); materials.add(material);
    nameplates.set(post, name => {
      ctx.fillStyle = '#091922'; ctx.fillRect(0, 0, 768, 256);
      ctx.fillStyle = '#be9f74'; ctx.fillRect(22, 26, 5, 204);
      ctx.fillStyle = '#9dbac1'; ctx.font = '500 23px system-ui';
      ctx.fillText(title, 53, 65, 660);
      ctx.fillStyle = '#e2e5d7'; ctx.font = '600 42px system-ui';
      ctx.fillText(name.toLocaleUpperCase('es'), 53, 151, 670);
      ctx.fillStyle = '#71929b'; ctx.font = '22px monospace';
      ctx.fillText('TRIPULACIÓN ASIGNADA', 53, 208);
      texture.needsUpdate = true;
    });
    nameplates.get(post)!('PUESTO ASIGNADO');
    return material;
  };
  const shoulder = new THREE.Vector3(), hand = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const postOperators = new Map<string, THREE.Group>();
  const addSeatedOfficer = (parent: THREE.Object3D, role: string) => {
    const officer = new THREE.Group();
    officer.name = `bridge-operator-${role}`;
    officer.userData.commandAvatar = true;
    postOperators.set(role, officer);
    parent.add(officer);
    const coat = coats[role] ?? coats.helm;
    const skin = skinByPost[role];
    const hairMaterial = hairByPost[role];
    // Real seated proportions: a broad upper back/shoulder line, visible
    // neck and nape, and elbows reaching the physical instrument. The old
    // floating spherical heads were hard to read above the chair at 390 px.
    mesh(officerOval, coat, officer, 0, .92, .4, .29, .32, .2);
    mesh(officerOval, coat, officer, 0, 1.10, .40, .39, .235, .225);
    mesh(officerOval, coat, officer, 0, .69, .41, .25, .13, .19);
    mesh(officerOval, uniformTrim, officer, 0, 1.205, .435, .255, .045, .21);
    mesh(officerOval, skin, officer, 0, 1.295, .375, .105, .13, .10);
    mesh(headGeometry, skin, officer, 0, 1.43, .35, .17, .215, .16);
    mesh(scalpGeometry, hairMaterial, officer, 0, 1.43, .35, .173, .218, .163);

    // Hands rest in front of the torso at the real decorative instrument.
    for (const side of [-1, 1]) {
      mesh(officerOval, coat, officer, side * .32, 1.15, .385, .135, .14, .17);
      mesh(officerOval, uniformTrim, officer, side * .33, 1.26, .495, .095, .016, .06);
      shoulder.set(side * .29, 1.10, .38);
      hand.set(side * .39, .93, -.04);
      const direction = hand.clone().sub(shoulder);
      const sleeve = mesh(cylinder, coat, officer,
        (shoulder.x + hand.x) / 2, (shoulder.y + hand.y) / 2,
        (shoulder.z + hand.z) / 2, .09, direction.length(), .09);
      sleeve.quaternion.setFromUnitVectors(up, direction.normalize());
      mesh(officerOval, skin, officer, hand.x, hand.y, hand.z - .045, .09, .06, .12);
      mesh(officerOval, coat, officer, side * .145, .53, .14, .125, .11, .26);
    }
  };
  let visibleOfficers = 0;
  // Separate, non-batched avatar: the captain appears only in the seated
  // command camera and disappears in first-person walking exploration.
  const captainCoat = mat('#355967', .14, .72);
  captainCoat.bumpMap = seat.bumpMap; captainCoat.bumpScale = .008;
  const commandCollar = mat('#26343b', .05, .86);
  const captainAvatar = new THREE.Group();
  captainAvatar.name = 'command-chair-captain';
  captainAvatar.userData.commandAvatar = true;
  captainAvatar.visible = false;
  // One continuous tailored torso avoids overlapping spheres at the shoulders.
  // The profile tapers from the chest into the collar and seated waist.
  const torsoProfile = [
    {y:.88, x:.22, z:.15}, {y:1.03, x:.245, z:.17},
    {y:1.23, x:.275, z:.175}, {y:1.34, x:.30, z:.16},
    {y:1.40, x:.24, z:.14}, {y:1.465, x:.10, z:.085},
  ];
  const torsoPoints:number[] = [], torsoFaces:number[] = [];
  const torsoSides = 24;
  for (const ring of torsoProfile) for (let i=0; i<torsoSides; i++) {
    const angle = 2 * Math.PI * i / torsoSides;
    torsoPoints.push(Math.cos(angle) * ring.x, ring.y, .035 + Math.sin(angle) * ring.z);
  }
  for (let ring=0; ring<torsoProfile.length-1; ring++) for (let i=0; i<torsoSides; i++) {
    const a=ring*torsoSides+i, b=ring*torsoSides+(i+1)%torsoSides;
    const c=a+torsoSides, d=b+torsoSides;
    torsoFaces.push(a,c,b,b,c,d);
  }
  const commandTorso = new THREE.BufferGeometry();
  commandTorso.setAttribute('position',new THREE.Float32BufferAttribute(torsoPoints,3));
  commandTorso.setIndex(torsoFaces); commandTorso.computeVertexNormals(); geometries.add(commandTorso);
  mesh(commandTorso, captainCoat, captainAvatar, 0, 0, 0, 1, 1, 1);
  mesh(cylinder, commandCollar, captainAvatar, 0, 1.465, -.015, .085, .045, .09);
  mesh(cylinder, captainSkin, captainAvatar, 0, 1.49, -.015, .065, .12, .075);
  mesh(commandHeadGeometry, captainSkin, captainAvatar, 0, 1.64, -.025, .17, .215, .16);
  const commandHair = mesh(commandScalpGeometry, captainHair, captainAvatar, 0, 1.64, -.025, .173, .218, .163);
  commandHair.name = 'command-hair';

  for (const side of [-1, 1]) {
    // A single tapered sleeve follows shoulder, elbow and wrist. Its rings
    // share normals, so a bend reads as one arm rather than stacked tubes.
    const armPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side*.245,1.30,.025),
      new THREE.Vector3(side*.30,1.21,.04),
      new THREE.Vector3(side*.36,1.065,.025),
      new THREE.Vector3(side*.40,1.08,-.10),
      new THREE.Vector3(side*.42,1.105,-.22),
    ]);
    const armPoints:number[] = [], armFaces:number[] = [];
    const rings=16, sides=12;
    const radial = new THREE.Vector3(), rotation = new THREE.Quaternion();
    for (let ring=0; ring<=rings; ring++) {
      const t=ring/rings, center=armPath.getPoint(t);
      const tangent=armPath.getTangent(t).normalize();
      rotation.setFromUnitVectors(up,tangent);
      const radius=.075 - .025*t;
      for (let i=0; i<sides; i++) {
        const angle=2*Math.PI*i/sides;
        radial.set(Math.cos(angle)*radius,0,Math.sin(angle)*radius*.88).applyQuaternion(rotation);
        armPoints.push(center.x+radial.x,center.y+radial.y,center.z+radial.z);
      }
    }
    for (let ring=0; ring<rings; ring++) for (let i=0; i<sides; i++) {
      const a=ring*sides+i,b=ring*sides+(i+1)%sides,c=a+sides,d=b+sides;
      armFaces.push(a,c,b,b,c,d);
    }
    const armGeometry=new THREE.BufferGeometry();
    armGeometry.setAttribute('position',new THREE.Float32BufferAttribute(armPoints,3));
    armGeometry.setIndex(armFaces); armGeometry.computeVertexNormals(); geometries.add(armGeometry);
    mesh(armGeometry,captainCoat,captainAvatar,0,0,0,1,1,1);
    // A flattened palm and separate thumb rest on the physical armrest.
    mesh(officerOval,captainSkin,captainAvatar,side*.42,1.105,-.265,.046,.023,.07);
    mesh(officerOval,captainSkin,captainAvatar,side*.375,1.103,-.25,.021,.019,.045);
  }

  // The first officer has a dedicated seat in the seated command view.
  // Its occupant is the canonical first officer, never a duplicate operator.
  const firstOfficerSeat = new THREE.Group();
  firstOfficerSeat.name = 'first-officer-seat';
  firstOfficerSeat.position.set(-1.08, 0, -.12);
  firstOfficerSeat.scale.setScalar(.92);
  firstOfficerSeat.visible = false;
  chair(firstOfficerSeat, 0, 0, true);
  const firstOfficerAvatar = captainAvatar.clone(true);
  firstOfficerAvatar.visible = true;
  // Slightly turned toward the captain, rather than an identical rigid pose.
  firstOfficerAvatar.rotation.y = .065;
  const firstCoat = mat('#566a84', .14, .72);
  firstCoat.bumpMap = seat.bumpMap; firstCoat.bumpScale = .008;
  const firstSkin = mat('#805a46', .03, .9);
  const firstHair = mat('#282c30', .02, .98);
  firstHair.vertexColors = true;
  firstOfficerAvatar.traverse(item => {
    if (!(item instanceof THREE.Mesh)) return;
    if (item.material === captainCoat) item.material = firstCoat;
    else if (item.material === captainSkin) item.material = firstSkin;
    else if (item.material === captainHair) item.material = firstHair;
  });
  firstOfficerSeat.add(firstOfficerAvatar);
  firstOfficerSeat.traverse(item => { item.userData.commandAvatar = true; });

  for (const station of map.objects) {
    const p = point(station.x, station.y);
    const group = new THREE.Group(); group.position.set(p.x, 0, p.z);
    group.name = station.id; scene.add(group);
    decal(group, contactShadow, 0, .072, .15, 2.05, 2.05, -Math.PI / 2);
    if (station.id === 'captain') {
      chair(group, 0, 0, true);
      group.add(captainAvatar);
      group.add(firstOfficerSeat);
      // Embedded armrest indicators follow the real command-station focus.
      const commandFocus = makeStationFocus('captain');
      for (const side of [-1, 1])
        block(group, commandFocus, side * .57, 1.145, -.09, .022, .02, .39);
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
      for (const side of [-1, 1]) block(group, amber, side * .86, .15, -.12, .055, .025, .7);
      continue;
    }
    const side = station.id === 'science' ? 1 : station.id === 'tactical' ? -1 : 0;
    group.rotation.y = side * Math.PI / 2;
    // Split pedestal and floating, sloped instrument housing. Each station
    // remains inside its original solid tile, including its chair.
    for (const side of [-1, 1]) {
      const leg = rounded(group, hull, side * .62, .43, -.2, .2, .77, .55);
      leg.rotation.z = side * -.13;
      block(group, bronze, side * .62, .13, -.14, .3, .055, .7);
    }
    block(group, dark, 0, .5, -.22, 1.1, .43, .42);
    mesh(deskGeometry, instrumentShell, group, 0, 0, 0, 1, 1, 1);
    block(group, bronze, 0, 1.035, .48, 1.72, .035, .035);
    // Instrument-edge task lighting gives every real console a visual
    // hierarchy while keeping its existing label, picking and state intact.
    block(group, station.id === 'tactical' ? amber : cyan, 0, 1.015, .515,
      1.5, .014, .018);
    const screen = rounded(group, dark, 0, 1.29, -.015, 1.6, .055, .83);
    screen.rotation.x = .405;
    const title = station.id === 'science' ? 'CIENCIA' : station.id === 'tactical' ? 'SEGURIDAD'
      : station.id === 'helm' ? 'NAVEGACIÓN' : 'COMUNICACIONES';
    decal(group, display(title, side < 0 ? '#e3af76' : '#8ed5cf', station.x),
      0, 1.33, -.002, 1.5, .71, -Math.PI / 2 + .405);
    for (const side of [-1, 1]) {
      block(group, dark, side * .86, .99, -.03, .025, .2, .69);
      block(group, bronze, side * .875, 1.02, -.03, .012, .018, .56);
    }
    for (let i = 0; i < 5; i++) block(group, i % 2 ? amber : cyan, -.55 + i * .27, .94, .49, .14, .025, .025);
    for (let i = 0; i < 7; i++) block(group, panel, -.57 + i * .19, .63, .405, .1, .07, .025);
    // Back monitor has enough height to read across the bridge.
    for (const x of [-.56, .56]) block(group, bronze, x, 1.37, -.43, .035, .27, .035);
    rounded(group, instrumentShell, 0, 1.54, -.43, 1.68, .52, .14);
    // Nameplate replaces only the rear duplicate schematic. Front controls
    // remain the original physical instrument, and the station stays playable.
    decal(group, makeNameplate(station.id, title), 0, 1.54, -.349, 1.5, .41);
    // One decorative focus trim per real post, using the current station ID.
    const stationFocus = makeStationFocus(station.id);
    for (const side of [-1, 1])
      block(group, stationFocus, side * .775, 1.54, -.335, .028, .41, .026);
    block(group, stationFocus, 0, 1.317, -.334, 1.57, .022, .027);
    chair(group, 0, .4);
    addSeatedOfficer(group, station.id);
    visibleOfficers++;
  }

  canvas.dataset.bridgeOfficers = String(visibleOfficers);

  // Include nested chair frames, while excluding the room envelope and the
  // flat screen/contact-shadow decals from the cached furniture shadow map.
  for (const child of scene.children) if (child instanceof THREE.Group && child.name) {
    child.traverse(item => {
      if (item instanceof THREE.Mesh && item.geometry !== plane) {
        // The toggled captain cannot leave a stale baked shadow when the
        // viewer changes between walking and seated command.
        item.castShadow = item.parent?.userData.commandAvatar !== true;
        item.receiveShadow = true;
      }
    });
  }

  scene.add(new THREE.HemisphereLight('#c1dae0', '#293331', 1.25));
  const key = new THREE.DirectionalLight('#f2ddbc', 2.7); key.position.set(-4, 7, 4); scene.add(key);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: .5, far: 25 });
  key.shadow.bias = -.0003; key.shadow.normalBias = .025;
  const fill = new THREE.DirectionalLight('#83c5e8', 2.4); fill.position.set(1, 3, -8); scene.add(fill);
  const aft = new THREE.PointLight('#e4bc88', 32, 15, 2); aft.position.set(0, 3.7, 4.5); scene.add(aft);

  // Static furnishings share a handful of geometry/material combinations.
  // Bake their world transforms into instances, retaining each shadow flag.
  // Station interaction is still exclusively owned by the spatial engine.
  scene.updateMatrixWorld(true);
  const repeated = new Map<string, THREE.Mesh[]>();
  scene.traverse(item => {
    // Keep the avatar out of static instancing: visibility must change on
    // seat/walking transitions without rebuilding the WebGL scene.
    if (!(item instanceof THREE.Mesh) || item.parent?.userData.commandAvatar ||
      Array.isArray(item.material) || item.material.transparent) return;
    const key = `${item.geometry.uuid}:${item.material.uuid}:${item.castShadow}:${item.receiveShadow}`;
    const group = repeated.get(key) ?? []; group.push(item); repeated.set(key, group);
  });
  for (const items of repeated.values()) {
    if (items.length < 2) continue;
    const first = items[0];
    const batch = new THREE.InstancedMesh(first.geometry, first.material, items.length);
    batch.castShadow = first.castShadow; batch.receiveShadow = first.receiveShadow;
    items.forEach((item, index) => { batch.setMatrixAt(index, item.matrixWorld); item.removeFromParent(); });
    batch.computeBoundingSphere(); scene.add(batch); batches.add(batch);
  }

  let lastPose: BridgePose | undefined;
  let lastAlert = false;
  const applyFocus = (focusedStation: string | null) => {
    const selected = focusedStation && stationFocusMaterials.has(focusedStation) ? focusedStation : null;
    for (const [id, material] of stationFocusMaterials)
      material.color.set(id === selected ? '#ffce83' : '#1d404a');
    canvas.dataset.bridgeFocusedStation = selected ?? 'none';
  };
  let rosterKey = '';
  let firstOfficerPost: string | null = null;
  let firstOfficerIsCaptain = false;
  const applyRoster = (roster: BridgeCrewRoster) => {
    const nextKey = (['captain', ...deckPosts] as BridgeCrewStation[])
      .map(post => `${post}:${roster[post].id}:${roster[post].name}`).join('|');
    if (nextKey === rosterKey) return;
    rosterKey = nextKey;
    firstOfficerIsCaptain = roster.captain.id === 'solan';
    firstOfficerPost = deckPosts.find(post => roster[post].id === 'solan') ?? null;
    const apply = (post: BridgeCrewStation, coat: THREE.MeshStandardMaterial,
      skin: THREE.MeshStandardMaterial, hair: THREE.MeshStandardMaterial) => {
      const officer = roster[post];
      const palette = appearances[officer.id];
      if (!palette) return;
      coat.color.set(palette[0]); skin.color.set(palette[1]); hair.color.set(palette[2]);
      canvas.dataset[`bridgeOfficer${post[0].toUpperCase() + post.slice(1)}`] = officer.id;
      nameplates.get(post)?.(officer.name);
    };
    for (const post of deckPosts) apply(post, coats[post], skinByPost[post], hairByPost[post]);
    apply('captain', captainCoat, captainSkin, captainHair);
  };
  const draw = () => {
    if (disposed || !lastPose) return;
    const rect = canvas.getBoundingClientRect();
    const aspect = Math.max(.2, rect.width / Math.max(1, rect.height));
    // Match the real viewport instead of cropping half the room on a phone.
    // Size to the real display, with bounded high-DPR supersampling. The
    // fullscreen view needs more detail than the previous small page card.
    const density = Math.min(1.5, window.devicePixelRatio || 1);
    const pixels = Math.min(1280 * 720, Math.max(1, rect.width * rect.height * density * density));
    const width = Math.max(1, Math.min(1280, Math.floor(Math.sqrt(pixels * aspect))));
    const height = Math.max(1, Math.floor(width / aspect));
    if (canvas.width !== width || canvas.height !== height) renderer.setSize(width, height, false);
    camera.aspect = aspect;
    camera.fov = Math.min(78, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(29)) * Math.max(1, 1.7 / aspect))));
    camera.updateProjectionMatrix();
    const seat = lastPose.seated ? map.objects.find(item => item.id === 'captain') : null;
    const p = point(seat?.x ?? lastPose.x, seat?.y ?? lastPose.y);
    // A composed command-deck view places the actual captain between
    // the viewer and the two forward consoles. Walking remains first person;
    // only the presentation camera moves, never the saved simulation cell.
    const crewWide = !!seat && aspect < .7;
    const retreat = seat
      ? Math.max(2.4, THREE.MathUtils.clamp((.85 - aspect) * 11, 0, 4.4)) : 0;
    camera.position.set(p.x, seat ? 1.8 : 1.72, p.z + retreat);
    captainAvatar.visible = !!seat;
    firstOfficerSeat.visible = !!seat && !firstOfficerIsCaptain;
    for (const [post, operator] of postOperators)
      operator.visible = !(firstOfficerSeat.visible && post === firstOfficerPost);
    canvas.dataset.bridgeFirstOfficerVisible = String(firstOfficerSeat.visible);
    canvas.dataset.bridgeCaptainVisible = String(!!seat);
    canvas.dataset.bridgeFraming = crewWide ? 'crew-wide' : seat ? 'command-wide' : 'exploration';
    canvas.dataset.bridgeMode = seat ? 'captain' : 'exploration';
    // The seated composition should frame the *working deck*, not a large
    // unused band of dark ceiling. A restrained downward pitch improves
    // legibility of the captain, officers and instruments. Phone views keep
    // more vertical room for the existing status and command controls.
    // Walking retains its own first-person eye line and unchanged grid pose.
    const cameraPitch = seat ? (crewWide ? -.070 : -.130) : -.025;
    camera.rotation.set(cameraPitch, ANGLES[lastPose.heading] ?? 0, 0, 'YXZ');
    canvas.dataset.bridgeCameraPitch = cameraPitch.toFixed(3);
    aft.color.set(lastAlert ? '#f39975' : '#e4bc88');
    renderer.render(scene, camera);
    canvas.dataset.bridgePose = `${lastPose.x}:${lastPose.y}:${lastPose.heading}`;
    canvas.dataset.bridgeRendered = 'true';
  };
  const resize = new ResizeObserver(draw); resize.observe(canvas);
  // The compact CC0 head is optional. Failure keeps the procedural fallback;
  // a late response never touches a disposed WebGL scene.
  const headAbort = new AbortController();
  canvas.dataset.bridgeHead = 'loading';
  fetch(`${import.meta.env.BASE_URL}art/bridge-head-v1.bin`, { signal: headAbort.signal })
    .then(response => { if (!response.ok) throw new Error('Head unavailable'); return response.arrayBuffer(); })
    .then(buffer => {
      if (disposed) return;
      if (buffer.byteLength < 8 || buffer.byteLength > 128_000) throw new Error('Invalid head size');
      const header = new DataView(buffer), vertices = header.getUint32(0, true), indices = header.getUint32(4, true);
      if (!vertices || vertices > 10_000 || !indices || indices % 3 || 8 + vertices * 24 + indices * 2 !== buffer.byteLength)
        throw new Error('Invalid head data');
      const positions = new Float32Array(buffer, 8, vertices * 3);
      const normals = new Float32Array(buffer, 8 + vertices * 12, vertices * 3);
      const faces = new Uint16Array(buffer, 8 + vertices * 24, indices);
      if (!positions.every(value => Number.isFinite(value) && Math.abs(value) <= 4) ||
          !normals.every(Number.isFinite) || !faces.every(index => index < vertices)) throw new Error('Invalid head geometry');
      // Follow the actual skull instead of layering a spherical cap over it.
      // The hairline is lower at the nape (positive Z faces the camera).
      const hairFaces: number[] = [];
      const inHair = (index: number) => {
        const y = positions[index * 3 + 1], z = positions[index * 3 + 2];
        const nape = THREE.MathUtils.clamp((z + .3) / .8, 0, 1);
        return y > .12 - nape * .62;
      };
      for (let i = 0; i < faces.length; i += 3) {
        if (inHair(faces[i]) && inHair(faces[i + 1]) && inHair(faces[i + 2]))
          hairFaces.push(faces[i], faces[i + 1], faces[i + 2]);
      }
      if (!hairFaces.length) throw new Error('Invalid scalp geometry');
      // Omit the imported flared base instead of deforming it into angular
      // folds. The separate neck overlaps the trimmed rear of the head.
      const commandFaces:number[] = [];
      for (let i=0; i<faces.length; i+=3) {
        if (positions[faces[i]*3+1] > -.55 && positions[faces[i+1]*3+1] > -.55 &&
            positions[faces[i+2]*3+1] > -.55)
          commandFaces.push(faces[i],faces[i+1],faces[i+2]);
      }
      if (!commandFaces.length) throw new Error('Invalid command head geometry');
      headGeometry.dispose(); headGeometry.deleteAttribute('uv');
      headGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      headGeometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
      headGeometry.setIndex(new THREE.BufferAttribute(faces, 1));
      headGeometry.computeBoundingBox(); headGeometry.computeBoundingSphere();
      commandHeadGeometry.dispose(); commandHeadGeometry.deleteAttribute('uv');
      commandHeadGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      commandHeadGeometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
      commandHeadGeometry.setIndex(commandFaces);
      commandHeadGeometry.computeBoundingBox(); commandHeadGeometry.computeBoundingSphere();
      scalpGeometry.dispose(); scalpGeometry.deleteAttribute('uv');
      scalpGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      scalpGeometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
      scalpGeometry.setIndex(hairFaces);
      scalpGeometry.computeBoundingBox(); scalpGeometry.computeBoundingSphere();
      commandScalpGeometry.dispose(); commandScalpGeometry.deleteAttribute('uv');
      commandScalpGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      commandScalpGeometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
      commandScalpGeometry.setIndex(hairFaces);
      shadeCommandScalp(commandScalpGeometry);
      commandScalpGeometry.computeBoundingBox(); commandScalpGeometry.computeBoundingSphere();
      batches.forEach(batch => { if (batch.geometry === headGeometry || batch.geometry === scalpGeometry) batch.computeBoundingSphere(); });
      renderer.shadowMap.needsUpdate = true;
      canvas.dataset.bridgeHead = 'loaded'; draw();
    }).catch(() => { if (!disposed) canvas.dataset.bridgeHead = 'fallback'; });

  return {
    render(pose: BridgePose, alert: boolean, roster: BridgeCrewRoster, focusedStation: string | null) {
      if (disposed) return;
      applyRoster(roster);
      applyFocus(pose.seated ? focusedStation : null);
      lastPose = pose; lastAlert = alert; draw();
    },
    dispose() {
      disposed = true;
      headAbort.abort();
      resize.disconnect();
      batches.forEach(item => item.dispose());
      geometries.forEach(item => item.dispose()); materials.forEach(item => item.dispose());
      textures.forEach(item => item.dispose()); scene.clear();
      environmentTarget.dispose();
      key.shadow.dispose();
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}
