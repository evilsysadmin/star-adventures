import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STARADVS_PROTECTED_ORIGIN, isAccountSubject, resolveGameStorageScope,
  createAccountStorage,
} from '../src/identityStorage.ts';
import {
  GAME_PREFERENCES_KEY, readGamePreferences, saveGamePreferences,
} from '../src/gamePreferences.ts';

const alice = '123e4567-e89b-42d3-a456-426614174000';
const bob = '123e4567-e89b-42d3-a456-426614174001';

function nativeStorage() {
  const map = new Map();
  return {
    get length() { return map.size; },
    key(index) { return [...map.keys()][index] ?? null; },
    getItem(key) { return map.get(String(key)) ?? null; },
    setItem(key, value) { map.set(String(key), String(value)); },
    removeItem(key) { map.delete(String(key)); },
    clear() { map.clear(); },
    entries() { return [...map.entries()]; },
  };
}

function identityReply(subject, overrides = {}) {
  return new Response(JSON.stringify({
    identity: 'staradvs', subject,
    expires_at: Math.floor(Date.now() / 1000) + 75,
    ...overrides,
  }), { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

test('protected staging resolves only the exact fresh staradvs session before game starts', async () => {
  const requests = [];
  const scope = await resolveGameStorageScope(STARADVS_PROTECTED_ORIGIN, (url, init) => {
    requests.push({ url, init });
    return Promise.resolve(identityReply(alice));
  });
  assert.deepEqual(scope, { mode: 'account', subject: alice });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, '/api/staradvs/session');
  assert.equal(requests[0].init.method, 'GET');
  assert.equal(requests[0].init.credentials, 'same-origin');
  assert.equal(requests[0].init.cache, 'no-store');
  assert.equal(requests[0].init.redirect, 'error');
  assert.equal(requests[0].init.signal.aborted, false);
});

test('untrusted, expired, broken, and offline responses cannot adopt legacy saves', async () => {
  const responses = [
    identityReply(alice, { identity: 'snooker' }),
    identityReply(alice, { expires_at: 0 }),
    identityReply(alice, { expires_at: 'far future' }),
    identityReply('garbage'),
    identityReply('123e4567-e89b-12d3-a456-426614174000'),
    new Response('<html>SPA fallback</html>', { status: 200, headers: { 'Content-Type': 'text/html' } }),
    new Response('no session', { status: 401, headers: { 'Content-Type': 'application/json' } }),
    new Response('outage', { status: 503 }),
    new Response('{bad', { status: 200, headers: { 'Content-Type': 'application/json' } }),
  ];
  for (const response of responses) {
    assert.deepEqual(await resolveGameStorageScope(STARADVS_PROTECTED_ORIGIN, async () => response),
      { mode: 'blocked' });
  }
  assert.deepEqual(await resolveGameStorageScope(STARADVS_PROTECTED_ORIGIN, async () => {
    throw Error('network unavailable');
  }), { mode: 'blocked' });
  assert.equal(isAccountSubject(alice), true);
  assert.equal(isAccountSubject(alice.toUpperCase()), false);
});

test('legacy local development keeps its existing save keys; protected aliases never fall back', async () => {
  for (const origin of ['http://127.0.0.1:4173', 'http://localhost:5173', 'https://preview.example.invalid']) {
    assert.deepEqual(await resolveGameStorageScope(origin, () => {
      throw Error('local and public builds must not query Identity');
    }), { mode: 'local' });
  }
  for (const origin of [
    'http://staging.staradvs.shadowops.dpdns.org',
    'https://staging.staradvs.shadowops.dpdns.org:8443',
    'https://staradvs-staging.pages.dev',
    'https://deadbeef.staradvs-staging.pages.dev',
    'not a URL',
  ]) {
    assert.deepEqual(await resolveGameStorageScope(origin, () => {
      throw Error('a noncanonical origin must not request an SSO session');
    }), { mode: 'blocked' }, origin);
  }
});

test('account A -> logout -> B -> A restores only its own real checkpoint and preferences', async () => {
  const backing = nativeStorage();
  const legacy = 'shadowops.star-adventures.border-signal.v2';
  const sharedKeys = [
    legacy, 'shadowops.star-adventures.spatial.v1',
    'shadowops.star-adventures.away-team.v1',
    'shadowops.star-adventures.physical-perimeter.v1',
    'shadowops.star-adventures.ground-squad.v1',
    'shadowops.star-adventures.training.v1',
    'shadowops.star-adventures.tactical-view.v1',
    GAME_PREFERENCES_KEY,
  ];
  backing.setItem(legacy, 'legacy-unattributed-checkpoint');
  const modeA = await resolveGameStorageScope(STARADVS_PROTECTED_ORIGIN, async () => identityReply(alice));
  const a = createAccountStorage(backing, modeA.subject);
  for (const key of sharedKeys) assert.equal(a.getItem(key), null, 'SSO cannot inherit a legacy checkpoint');
  a.setItem(legacy, 'alice-mission');
  a.setItem(sharedKeys[1], 'alice-position');
  const alicePrefs = { version: 1, layout: 'journal', hints: false, muted: true, volume: .4 };
  assert.equal(saveGamePreferences(a, alicePrefs), true);

  const modeB = await resolveGameStorageScope(STARADVS_PROTECTED_ORIGIN, async () => identityReply(bob));
  const b = createAccountStorage(backing, modeB.subject);
  for (const key of sharedKeys) assert.equal(b.getItem(key), null, `Bob inherited ${key}`);
  assert.equal(readGamePreferences(b).layout, 'game');
  b.setItem(legacy, 'bob-mission');
  b.setItem(sharedKeys[2], 'bob-team');
  assert.equal(a.getItem(legacy), 'alice-mission');
  assert.equal(a.getItem(sharedKeys[2]), null);
  assert.equal(readGamePreferences(a).layout, 'journal');

  const reloggedA = createAccountStorage(backing, alice);
  assert.equal(reloggedA.getItem(legacy), 'alice-mission');
  assert.equal(reloggedA.getItem(sharedKeys[1]), 'alice-position');
  assert.equal(reloggedA.getItem(sharedKeys[2]), null);
  assert.deepEqual(readGamePreferences(reloggedA), alicePrefs);
  assert.equal(backing.getItem(legacy), 'legacy-unattributed-checkpoint');
  assert.ok(backing.entries().length >= 6);
});

test('remove, key(), length and clear never touch another account or legacy saves', () => {
  const backing = nativeStorage();
  backing.setItem('old-global-save', 'keep');
  const a = createAccountStorage(backing, alice);
  const b = createAccountStorage(backing, bob);
  a.setItem('crew', 'alice');
  a.setItem('position', '2,4');
  b.setItem('crew', 'bob');
  assert.equal(a.length, 2);
  assert.deepEqual(new Set([a.key(0), a.key(1)]), new Set(['crew', 'position']));
  assert.equal(a.key(2), null);
  assert.equal(a.key(-1), null);
  a.removeItem('crew');
  assert.equal(a.getItem('crew'), null);
  assert.equal(b.getItem('crew'), 'bob');
  a.clear();
  assert.equal(a.length, 0);
  assert.equal(b.length, 1);
  assert.equal(b.getItem('crew'), 'bob');
  assert.equal(backing.getItem('old-global-save'), 'keep');
  assert.throws(() => createAccountStorage(backing, 'fake-user'));
});
