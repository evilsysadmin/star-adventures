import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { findBrowserSpecs, planBrowserShards, testFileFilter } from '../scripts/run-browser-shard.mjs';

const repoRoot = resolve(import.meta.dirname, '..');

test('every existing browser spec appears exactly once across five shards', () => {
  const specs = findBrowserSpecs(join(repoRoot, 'frontend', 'tests'));
  const timings = JSON.parse(readFileSync(join(repoRoot, 'scripts/browser-shard-timings.json'), 'utf8'));
  const shards = planBrowserShards(specs, timings.specSeconds, 5, timings._fallbackSeconds);
  const all = shards.flatMap((shard) => shard.files);
  assert.ok(specs.length > 0);
  assert.deepEqual(all.slice().sort(), specs.slice().sort());
  assert.equal(new Set(all).size, specs.length);
  assert.ok(shards.every((shard) => shard.files.length > 0));
  assert.ok(shards.every((shard) => shard.seconds > 0));
});

test('balances measured duration without changing file order or coverage', () => {
  const times = { 'slow.spec.ts': 100, 'medium.spec.ts': 55, 'small.spec.ts': 10 };
  const files = ['small.spec.ts', 'slow.spec.ts', 'new.spec.ts', 'medium.spec.ts'];
  const plan = planBrowserShards(files, times, 2, 40);
  assert.deepEqual(plan.map((group) => group.seconds), [110, 95]);
  assert.deepEqual(planBrowserShards(files.slice().reverse(), times, 2, 40), plan);
});

test('new browser specs receive fallback weight and cannot be silently skipped', () => {
  const plan = planBrowserShards(['existing.spec.ts', 'new.spec.ts'], { 'existing.spec.ts': 5 }, 2, 35);
  assert.equal(plan.flatMap((shard) => shard.files).length, 2);
  assert.equal(plan.reduce((sum, shard) => sum + shard.seconds, 0), 40);
});

test('rejects duplicate files, invalid shard counts and invalid weights', () => {
  assert.throws(() => planBrowserShards(['a.spec.ts', 'a.spec.ts'], {}, 2), /Duplicate/);
  assert.throws(() => planBrowserShards(['a.spec.ts'], {}, 0), /Invalid/);
  assert.throws(() => planBrowserShards(['a.spec.ts'], {}, 1, 0), /Invalid/);
});

test('Playwright filename filters cannot overlap on similarly named specs', () => {
  const filter = new RegExp(testFileFilter('iso.test.spec.ts'));
  assert.match('/tmp/frontend/tests/iso.test.spec.ts', filter);
  assert.doesNotMatch('/tmp/frontend/tests/isoXtest.spec.ts', filter);
  assert.doesNotMatch('/tmp/frontend/tests/iso.test.spec.ts.bak', filter);
});
