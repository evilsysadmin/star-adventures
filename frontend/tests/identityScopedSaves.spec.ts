import { expect, test } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test('a real browser keeps account A/B checkpoints distinct and preserves legacy local play', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('game-shell')).toBeVisible();
  const result = await page.evaluate(async () => {
    // Load the same module that the game bootstrap uses, but simulate the
    // signed-in Worker responses: this test needs no real Identity secret.
    const { createAccountStorage, resolveGameStorageScope } = await import('/src/identityStorage.ts');
    const endpoint = 'https://staging.staradvs.shadowops.dpdns.org';
    const key = 'shadowops.star-adventures.border-signal.v2';
    const first = '123e4567-e89b-42d3-a456-426614174000';
    const second = '123e4567-e89b-42d3-a456-426614174001';
    const reply = (subject: string) => new Response(JSON.stringify({
      identity: 'staradvs', subject, expires_at: Math.floor(Date.now() / 1000) + 70,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const storage = localStorage;
    const previousLegacy = storage.getItem(key);
    try {
      storage.setItem(key, 'unattributed-old-save');
      const scopeA = await resolveGameStorageScope(endpoint, async () => reply(first));
      if (scopeA.mode !== 'account') throw Error('account A was not confirmed');
      const a = createAccountStorage(storage, scopeA.subject);
      const initialA = a.getItem(key);
      a.setItem(key, 'alice-progress');

      // Account A logs out; the next independently confirmed identity owns a
      // fresh namespace. No call copies legacy or another account's bytes.
      const scopeB = await resolveGameStorageScope(endpoint, async () => reply(second));
      if (scopeB.mode !== 'account') throw Error('account B was not confirmed');
      const b = createAccountStorage(storage, scopeB.subject);
      const initialB = b.getItem(key);
      b.setItem(key, 'bob-progress');
      const aliceAfterB = createAccountStorage(storage, first).getItem(key);
      const legacyAfterB = storage.getItem(key);
      b.clear(); // Clearing B's entire storage must not destroy A or legacy.
      const bobAfterClear = b.getItem(key);
      const aliceAfterClear = a.getItem(key);
      return { initialA, initialB, aliceAfterB, legacyAfterB, bobAfterClear, aliceAfterClear };
    } finally {
      if (previousLegacy === null) storage.removeItem(key);
      else storage.setItem(key, previousLegacy);
      createAccountStorage(storage, first).clear();
      createAccountStorage(storage, second).clear();
    }
  });
  expect(result).toEqual({
    initialA: null,
    initialB: null,
    aliceAfterB: 'alice-progress',
    legacyAfterB: 'unattributed-old-save',
    bobAfterClear: null,
    aliceAfterClear: 'alice-progress',
  });
  await expect(page.getByTestId('game-shell')).toBeVisible();
});
