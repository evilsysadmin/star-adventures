import { expect, test, type BrowserContext, type Route } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

const protectedOrigin = 'https://staging.staradvs.shadowops.dpdns.org';
const a = '123e4567-e89b-42d3-a456-426614174000';
const b = '123e4567-e89b-42d3-a456-426614174001';
const slot = (subject: string) =>
  `shadowops.star-adventures.account.v1.${subject}.shadowops.star-adventures.border-signal.v2`;

// This is the *actual* React app on the protected URL, with the Vite assets
// proxied from this test runner. Identity's response alone is synthetic;
// no live IdP credentials, Cloudflare Access or secrets are involved.
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
});

test('two live tabs: switching from A to B blocks stale A without mixing browser saves', async ({ context, page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 850 });
  let currentSubject: string | null = a;
  await proxyProtectedApp(context, () => currentSubject);

  await page.goto(protectedOrigin + '/');
  await expect(page.getByTestId('game-shell')).toBeVisible({ timeout: 25_000 });
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key) !== null, slot(a)))
    .toBe(true);
  const storedA = await page.evaluate(key => localStorage.getItem(key), slot(a));

  // The same browser's server-side identity changes while A remains open.
  currentSubject = b;
  const second = await context.newPage();
  await second.goto(protectedOrigin + '/');
  await expect(second.getByTestId('game-shell')).toBeVisible({ timeout: 25_000 });
  await expect.poll(() => second.evaluate(key => localStorage.getItem(key) !== null, slot(b)))
    .toBe(true);
  const storedB = await second.evaluate(key => localStorage.getItem(key), slot(b));
  expect(storedA).not.toBeNull();
  expect(storedB).not.toBeNull();

  await page.bringToFront();
  await expect(page.getByTestId('game-identity-blocked')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('game-shell')).toHaveCount(0);
  await expect(page.getByTestId('game-identity-rechecking')).toHaveCount(0);

  const values = await page.evaluate(([keyA, keyB]) => ({
    previous: localStorage.getItem(keyA), next: localStorage.getItem(keyB),
  }), [slot(a), slot(b)]);
  expect(values.previous).toBe(storedA);
  expect(values.next).toBe(storedB);
  // The new account can return to its own tab and revalidate normally.
  await second.bringToFront();
  await expect(second.getByTestId('game-shell')).toBeVisible();
  await expect(second.getByTestId('game-identity-rechecking')).toHaveCount(0);
});
