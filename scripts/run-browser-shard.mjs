// Keep each Playwright spec on exactly one runner, preserving in-file sequencing.
// Historical timings come from a real green GitHub Actions run, not test counts.
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const timingsFile = join(repoRoot, 'scripts', 'browser-shard-timings.json');

export function findBrowserSpecs(root, dir = root) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...findBrowserSpecs(root, absolute));
    else if (entry.isFile() && entry.name.endsWith('.spec.ts')) {
      found.push(relative(root, absolute).split(sep).join('/'));
    }
  }
  return found.sort();
}

export function planBrowserShards(files, secondsBySpec, shardCount, fallbackSeconds = 40) {
  if (!Number.isInteger(shardCount) || shardCount < 1 || !Number.isFinite(fallbackSeconds) || fallbackSeconds <= 0)
    throw new Error('Invalid shard configuration');
  if (new Set(files).size !== files.length) throw new Error('Duplicate browser spec path');
  const cost = (file) => {
    const measured = secondsBySpec[file];
    return typeof measured === 'number' && Number.isFinite(measured) && measured > 0 ? measured : fallbackSeconds;
  };
  const buckets = Array.from({ length: shardCount }, () => ({ files: [], seconds: 0 }));
  for (const file of [...files].sort((a, b) => cost(b) - cost(a) || a.localeCompare(b))) {
    let index = 0;
    for (let i = 1; i < buckets.length; i++)
      if (buckets[i].seconds < buckets[index].seconds) index = i;
    buckets[index].files.push(file);
    buckets[index].seconds += cost(file);
  }
  return buckets.map((bucket) => ({ ...bucket, files: bucket.files.sort() }));
}

export function testFileFilter(specPath) {
  // Positional Playwright arguments are regexes matched against absolute file paths.
  // Escape metacharacters and anchor the filename to avoid overlapping shards.
  return 'tests/' + specPath.replace(/[.*+?^$|()[\]{}\\]/g, '\\$&') + '$';
}

function main() {
  const match = /^([1-9]\d*)\/([1-9]\d*)$/.exec(process.argv[2] ?? '');
  if (!match || Number(match[1]) > Number(match[2]))
    throw new Error('Expected shard argument N/TOTAL, e.g. 2/5');
  const [index, total] = [Number(match[1]) - 1, Number(match[2])];
  const source = JSON.parse(readFileSync(timingsFile, 'utf8'));
  const files = findBrowserSpecs(join(repoRoot, 'frontend', 'tests'));
  if (!files.length) throw new Error('No browser specs discovered');
  const all = planBrowserShards(files, source.specSeconds, total, source._fallbackSeconds);
  const selected = all[index];
  if (!selected.files.length) throw new Error('Empty browser shard ' + process.argv[2]);
  console.log('Playwright ' + process.argv[2] + ': ' + selected.files.length +
    ' spec files, ' + Math.round(selected.seconds) + ' seconds historic workload');
  console.log(selected.files.join('\n'));
  const args = ['run', 'test:e2e', '--prefix', 'frontend', '--',
    ...selected.files.map(testFileFilter)];
  const result = spawnSync('npm', args, { cwd: repoRoot, stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
