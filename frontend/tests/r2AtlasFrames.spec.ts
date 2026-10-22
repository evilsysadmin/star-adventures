import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

type AtlasAsset = { url: string; sha256: string; key: string };
const { assets } = JSON.parse(readFileSync(
  new URL('../src/assets/r2-assets-manifest.json', import.meta.url), 'utf8',
)) as { assets: Record<string, AtlasAsset> };

const motions = Object.entries(assets).filter(([id]) =>
  /^starAdventures\.tactical\.officer(?:Female|Male)(?:Walk|Run|Jump|Crouch|Fire)V[1-9]\d*$/.test(id),
);

test('every motion atlas has both officer variants for visual regression checks', () => {
  expect(motions.length).toBeGreaterThanOrEqual(2);
  const keys = new Set(motions.map(([id]) => id));
  for (const [id] of motions) {
    const other = id.includes('Female')
      ? id.replace('officerFemale', 'officerMale')
      : id.replace('officerMale', 'officerFemale');
    expect(keys.has(other), `Motion atlas missing matching officer: ${id}`).toBe(true);
  }
});

for (const [id, asset] of motions) {
  test(`live R2 animation has six non-empty, changing frames: ${id}`, async ({ page }) => {
    test.setTimeout(55_000);
    await page.goto('/');
    const result = await page.evaluate(async (url: string) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('CDN atlas image failed browser decoding/CORS'));
        img.src = url;
      });
      const { naturalWidth: width, naturalHeight: height } = img;
      if (width <= 0 || height <= 0 || width % 3 !== 0 || height % 2 !== 0) {
        return { width, height, validDimensions: false, frames: [] };
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('No 2D context for WebP atlas visual QA');
      context.drawImage(img, 0, 0);
      const image = context.getImageData(0, 0, width, height).data;
      const cellWidth = width / 3;
      const cellHeight = height / 2;
      const frames: { index: number; painted: number; fraction: number; signature: string }[] = [];
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 3; col++) {
          let painted = 0;
          // FNV1a over every RGBA pixel detects duplicated frames, including
          // subtle color/silhouette differences. It is not a security hash:
          // SHA-256 integrity is validated independently in r2Atlases.spec.ts.
          let hash = 2166136261 >>> 0;
          for (let y = row * cellHeight; y < (row + 1) * cellHeight; y++) {
            for (let x = col * cellWidth; x < (col + 1) * cellWidth; x++) {
              const offset = (y * width + x) * 4;
              const alpha = image[offset + 3];
              if (alpha >= 24) painted++;
              for (let channel = 0; channel < 4; channel++) {
                hash = Math.imul(hash ^ image[offset + channel], 16777619) >>> 0;
              }
            }
          }
          frames.push({
            index: row * 3 + col,
            painted,
            fraction: painted / (cellWidth * cellHeight),
            signature: hash.toString(16).padStart(8, '0'),
          });
        }
      }
      return { width, height, validDimensions: true, frames };
    }, asset.url);

    expect(result.validDimensions, `${id} must be a 3×2 motion atlas`).toBe(true);
    expect(result.frames).toHaveLength(6);
    for (const frame of result.frames) {
      // A correct SHA/HTTP 200 does not guarantee anyone is actually drawn.
      // 0.2% is intentionally generous: a tiny silhouette still qualifies.
      expect(frame.painted, `${id} frame ${frame.index} is blank`).toBeGreaterThan(64);
      expect(frame.fraction, `${id} frame ${frame.index} has no meaningful drawing`).toBeGreaterThan(0.002);
    }
    const distinctFrames = new Set(result.frames.map(f => f.signature)).size;
    expect(distinctFrames, `${id} is six copies of one static frame`).toBeGreaterThan(1);

    // Keep evidence in CI logs when authored art changes in the future.
    console.log(`R2_FRAME_QA ${id} ${result.width}x${result.height}: ` +
      result.frames.map(f => `${f.index}=${(f.fraction * 100).toFixed(2)}%`).join(', ') +
      ` distinct=${distinctFrames}/6`);
  });
}
