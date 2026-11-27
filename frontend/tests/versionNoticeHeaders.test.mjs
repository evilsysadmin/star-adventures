import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const headers = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');

test('Cloudflare Pages never caches the version marker or application shell', () => {
  const block = path => {
    const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = headers.match(new RegExp(`^${escaped}\\n((?:[ \\t]+[^\\n]*\\n?)+)`, 'm'));
    assert.ok(match, `missing Pages header rule for ${path}`);
    return match[1];
  };
  assert.match(block('/version.json'), /^\s+Cache-Control:\s*no-store\s*$/m);
  assert.match(block('/version.json'), /^\s+Cloudflare-CDN-Cache-Control:\s*no-store\s*$/m);
  for (const path of ['/', '/index.html']) {
    assert.match(block(path), /^\s+Cache-Control:\s*no-cache,\s*max-age=0,\s*must-revalidate\s*$/m);
    assert.match(block(path), /^\s+Cloudflare-CDN-Cache-Control:\s*no-store\s*$/m);
  }
});
