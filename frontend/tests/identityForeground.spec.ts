import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

const protectedOrigin = 'https://staging.staradvs.shadowops.dpdns.org';
const a = '123e4567-e89b-42d3-a456-426614174000';
const b = '123e4567-e89b-42d3-a456-426614174001';
const probe = 'shadowops.star-adventures.focus-probe.v1';
const slot = (subject: string) =>
  `shadowops.star-adventures.account.v1.${subject}.${probe}`;

// Actual React under the protected host with local Vite assets, but a
// synthetic same-origin Worker response; no live IdP/Cloudflare is exercised.
async function proxyProtectedApp(context: BrowserContext, getSubject: () => string | null) {
  await context.route(`${protectedOrigin}/**`, async (route: Route) => {
    const incoming = new URL(route.request().url());
    if (incoming.pathname === '/api/staradvs/session') {
      const subject = getSubject();
      if (!subject) {
        await route.fulfill({
          status: 401, contentType: 'application/json',
          body: JSON.stringify({ error: 'authentication_required' }),
        });
        return;
      }
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          identity: 'staradvs', subject,
          expires_at: Math.floor(Date.now() / 1000) + 110,
        }),
      });
      return;
    }
    const source = await route.fetch({
      url: 'http://127.0.0.1:4173' + incoming.pathname + incoming.search,
    });
    await route.fulfill({ response: source });
  });
}

// Headless window managers do not consistently dispatch focus on
// bringToFront(). Exercise the same real installed listener explicitly.
async function foreground(page: Page) {
  await page.bringToFront();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(async () => page.evaluate(async () => {
    const { gameStorageOrNull } = await import('/src/identityStorage.ts');
    return gameStorageOrNull() !== null;
  }), { timeout: 15_000 }).toBe(true);
  await expect(page.getByTestId('game-identity-rechecking')).toHaveCount(0);
}

async function writeProbe(page: Page, value: string) {
  await foreground(page);
  await page.evaluate(async ([key, raw]) => {
    const { gameStorageOrNull } = await import('/src/identityStorage.ts');
    const storage = gameStorageOrNull();
    if (!storage) throw Error('cannot write without a verified session');
    storage.setItem(key, raw);
  }, [probe, value]);
}

test('protected bootstrap never reads a saved game without a verified account', async ({ context, page }) => {
  await page.setViewportSize({ width: 390, height: 850 });
  await context.addInitScript((oldSlot: string) => {
    localStorage.setItem(oldSlot, 'unattributed-legacy-checkpoint');
  }, 'shadowops.star-adventures.border-signal.v2');
  await proxyProtectedApp(context, () => null);
  await page.goto(protectedOrigin + '/');
  await expect(page.getByTestId('game-identity-blocked')).toBeVisible();
  await expect(page.getByTestId('game-shell')).toHaveCount(0);
  await expect(page.getByTestId('game-identity-rechecking')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('shadowops.star-adventures.border-signal.v2')))
    .toBe('unattributed-legacy-checkpoint');
  await page.screenshot({ path: 'test-results/identity-denied-390.png' });
});

test('two browser tabs: A is denied after B signs in; cached saves retain their owners', async ({ context, page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 850 });
  let currentSubject: string | null = a;
  await proxyProtectedApp(context, () => currentSubject);

  await page.goto(protectedOrigin + '/');
  await expect(page.getByTestId('game-shell')).toBeVisible({ timeout: 25_000 });
  await writeProbe(page, 'alice-progress');
  expect(await page.evaluate(key => localStorage.getItem(key), slot(a))).toBe('alice-progress');

  currentSubject = b;
  const second = await context.newPage();
  await second.goto(protectedOrigin + '/');
  await expect(second.getByTestId('game-shell')).toBeVisible({ timeout: 25_000 });
  await writeProbe(second, 'bob-progress');
  expect(await second.evaluate(key => localStorage.getItem(key), slot(b))).toBe('bob-progress');

  await page.bringToFront();
  await page.evaluate(() => {
    window.dispatchEvent(new Event('blur'));
    window.dispatchEvent(new Event('focus'));
  });
  await expect(page.getByTestId('game-identity-blocked')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('game-shell')).toHaveCount(0);
  await expect(page.getByTestId('game-identity-rechecking')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/identity-revoked-1280.png' });

  const values = await page.evaluate(([keyA, keyB]) => ({
    previous: localStorage.getItem(keyA), next: localStorage.getItem(keyB),
  }), [slot(a), slot(b)]);
  expect(values).toEqual({ previous: 'alice-progress', next: 'bob-progress' });

  await foreground(second);
  await expect(second.getByTestId('game-shell')).toBeVisible();
});
