import * as THREE from 'three';

/**
 * Reusable, asset-independent officer representation for a tactical tile.
 * It intentionally does not import TacticalProbe: Codex owns that renderer.
 *
 * The fallback is visible *from the first frame*. A remote WebP is only shown
 * after Three.js has successfully decoded it. A 503/timeout cannot erase the
 * officer or break tile selection, because visuals never own tactical state.
 */
export type OfficerTextureStatus = 'loading' | 'loaded' | 'failed' | 'disposed';
export type OfficerLoadTexture = (
  url: string,
  onLoad: (texture: THREE.Texture) => void,
  onError: (error: unknown) => void,
) => THREE.Texture;

export interface OfficerVisualOptions {
  scene: THREE.Scene;
  id: string;
  assetUrl: string;
  at: { x: number; z: number };
  accent?: number;
  columns?: number;
  rows?: number;
  loadTexture?: OfficerLoadTexture;
  onStatus?: (status: OfficerTextureStatus) => void;
}

export interface OfficerVisualHandle {
  readonly root: THREE.Group;
  readonly placeholder: THREE.Group;
  readonly sprite: THREE.Sprite;
  status(): OfficerTextureStatus;
  setTile(x: number, z: number): void;
  /** Update atlas frame without recreating scene objects or network requests. */
  setFrame(frame: number): void;
  /** Retry after an atlas failure; returns false when already loaded/loading/disposed. */
  retryTexture(): boolean;
  dispose(): void;
}

const normalLoader: OfficerLoadTexture = (url, onLoad, onError) =>
  new THREE.TextureLoader().load(url, onLoad, undefined, onError);

export function mountResilientOfficer(options: OfficerVisualOptions): OfficerVisualHandle {
  const { scene, id, assetUrl, at, onStatus } = options;
  const columns = options.columns ?? 3;
  const rows = options.rows ?? 2;
  if (!id || !assetUrl || !Number.isFinite(at.x) || !Number.isFinite(at.z) ||
      !Number.isSafeInteger(columns) || columns <= 0 || columns > 16 ||
      !Number.isSafeInteger(rows) || rows <= 0 || rows > 16) {
    throw new Error('Invalid officer visual identity, tile, or atlas grid');
  }
  const root = new THREE.Group();
  root.name = `officer-${id}`;
  root.position.set(at.x, 0, at.z);
  const placeholder = new THREE.Group();
  placeholder.name = `officer-${id}-no-atlas`;
  const outfit = new THREE.MeshBasicMaterial({ color: options.accent ?? 0x66b6b4 });
  const skin = new THREE.MeshBasicMaterial({ color: 0xd3bd9e });
  const trim = new THREE.MeshBasicMaterial({ color: 0x162f42 });
  const pieces = [
    { geo: new THREE.CylinderGeometry(.23, .27, .63, 8), mat: outfit, y: .74 },
    { geo: new THREE.SphereGeometry(.17, 8, 6), mat: skin, y: 1.25 },
    { geo: new THREE.CylinderGeometry(.16, .17, .28, 8), mat: trim, y: .2 },
  ];
  const geometries: THREE.BufferGeometry[] = [];
  for (const item of pieces) {
    geometries.push(item.geo);
    const mesh = new THREE.Mesh(item.geo, item.mat);
    mesh.position.y = item.y;
    placeholder.add(mesh);
  }
  root.add(placeholder);

  const material = new THREE.SpriteMaterial({
    transparent: true, depthWrite: false, color: 0xffffff,
  });
  const sprite = new THREE.Sprite(material);
  sprite.name = `officer-${id}-atlas`;
  sprite.scale.set(1.55, 2.4, 1);
  sprite.position.y = 1.2;  // sprite lower edge is on the y=0 ground plane
  sprite.visible = false;
  root.add(sprite);
  scene.add(root);

  let state: OfficerTextureStatus = 'loading';
  let disposed = false;
  let attempt = 0;
  let pendingTexture: THREE.Texture | null = null;
  const textures = new Set<THREE.Texture>();
  const frameCount = columns * rows;
  let currentFrame = 0;
  const applyFrame = (texture: THREE.Texture) => {
    const column = currentFrame % columns;
    const row = Math.floor(currentFrame / columns);
    texture.repeat.set(1 / columns, 1 / rows);
    // WebP atlas rows are laid out top-to-bottom; Three's UV V grows upward.
    texture.offset.set(column / columns, 1 - (row + 1) / rows);
  };
  const report = (next: OfficerTextureStatus) => {
    if (disposed && next !== 'disposed') return;
    state = next;
    onStatus?.(next);
  };
  const loadTexture = (retry: boolean) => {
    const currentAttempt = ++attempt;
    if (retry) {
      // Once a previous request has failed it no longer owns a live map.
      // Release its pending placeholder texture before allocating the next.
      if (pendingTexture && pendingTexture !== material.map) {
        pendingTexture.dispose();
        textures.delete(pendingTexture);
      }
      pendingTexture = null;
      sprite.visible = false;
      placeholder.visible = true;
      report('loading');
    }
    const fail = () => {
      if (disposed || currentAttempt !== attempt) return;
      sprite.visible = false;
      placeholder.visible = true;
      report('failed');
    };
    try {
      const load = options.loadTexture ?? normalLoader;
      const pending = load(assetUrl, loaded => {
        if (disposed || currentAttempt !== attempt) {
          // Ignore an old response after a new retry, or after unmount.
          if (!textures.has(loaded)) loaded.dispose();
          return;
        }
        loaded.colorSpace = THREE.SRGBColorSpace;
        applyFrame(loaded);
        if (material.map && material.map !== loaded) {
          textures.delete(material.map);
          material.map.dispose();
        }
        material.map = loaded;
        material.needsUpdate = true;
        textures.add(loaded);
        sprite.visible = true;
        placeholder.visible = false;
        report('loaded');
      }, fail);
      pendingTexture = pending;
      textures.add(pending);
    } catch {
      fail();
    }
  };
  loadTexture(false);
  return {
    root, placeholder, sprite,
    status: () => state,
    setTile(x, z) {
      if (disposed || !Number.isFinite(x) || !Number.isFinite(z)) return;
      root.position.set(x, 0, z);
    },
    setFrame(frame) {
      if (disposed) return;
      if (!Number.isSafeInteger(frame)) throw new Error('Invalid officer atlas frame');
      currentFrame = ((frame % frameCount) + frameCount) % frameCount;
      if (material.map) applyFrame(material.map);
    },
    retryTexture() {
      if (disposed || state !== 'failed') return false;
      loadTexture(true);
      return true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      report('disposed');
      scene.remove(root);
      geometries.forEach(geometry => geometry.dispose());
      outfit.dispose();
      skin.dispose();
      trim.dispose();
      material.dispose();
      textures.forEach(texture => texture.dispose());
      textures.clear();
      sprite.visible = false;
      placeholder.visible = false;
    },
  };
}
