# Star Adventures · per-account browser saves before ShadowOps ID cutover

The game is **offline-first**, but its old browser checkpoints were written
under global, unprefixed `shadowops.star-adventures.*` keys. Those keys do not
identify a human owner. A session switch on the same browser must not cause
account B to receive account A's crew, campaign, position, training or
preferences.

## Current source behavior

- `frontend/src/main.tsx` resolves the storage owner **before any React
  component can restore or persist a checkpoint**. The verified identity is
  obtained only by calling the already protected Worker's same-origin
  `GET /api/staradvs/session`; neither a query string nor a localStorage
  username can select the owner. The session must have `identity=staradvs`,
  an exact UUIDv4 subject, a future integer expiration and an HTTP 200 JSON
  response. This endpoint is enforced by the Worker with live Identity
  freshness; a frontend check does not replace the Worker.
- On `https://staging.staradvs.shadowops.dpdns.org`, a missing, malformed,
  expired, wrong-audience or unreachable session **fails closed**: React does
  not mount App, so no campaign is read or written. Re-entrance requires an
  IdP login and a new page bootstrap. Wrong scheme/port is also rejected.
- The historical `staradvs-staging.pages.dev` host and its immutable
  deployment subdomains do not fall back to local save mode. **This does not
  remove or protect old public Pages deployments**; live quarantine is still
  a separate Cloudflare Access operator action.
- On the offline/local development origins, the original unprefixed keys
  remain in use, so existing local play and F5 persistence continue working
  without Identity availability.
- Authenticated storage is namespaced by
  `shadowops.star-adventures.account.v1.<canonical-subject>.`. All game
  checkpoint adapters use `localStorageOrNull()` and automatically receive
  that view; `getItem`, `setItem`, `removeItem`, `key`, `length` and
  `clear` are restricted to the current subject's namespace.
- The tactical-view selector and tactical audio preference fallback are also
  wired through the shared adapter; neither may access raw `localStorage`
  directly or inherit another user's layout/audio choices.
- The binding is one-shot per browser page load. A session switch must
  navigate through the existing IdP logout confirmation and bootstrap a
  fresh page. **Do not swap identity ownership in a mounted React tree**.
- Authenticated save handles now hold a short **45-second local lease**,
  bounded by the actual signed token expiration. Even a cached Storage
  handle fails closed when the lease is paused, expired or revoked; failures
  never grant an unprefixed legacy key. A successful, live same-subject Worker
  recheck extends the lease; a different subject cannot reactivate the page.
  Late responses after a pause/revocation are ignored by a generation check.
- When the tab is hidden or the window loses focus, the game is masked and
  all authenticated storage operations are suspended synchronously. On
  return the tab must recheck live ShadowOps ID before it exposes the saved
  game. A continuously foreground tab checks every 25 seconds. A session
  change, revocation, network error or expired token unmounts the game,
  preserving all stored bytes. A failed recheck requires a fresh bootstrap;
  it cannot silently repoint a mounted campaign at another account.

The 25-second poll and 45-second lease limit stale background/foreground
access windows; they cannot provide instantaneous cross-device session
revocation or protect against malicious JavaScript with direct access to the
same-origin native localStorage. The Worker must enforce current identity on
all protected asset/API access. The short-lived Worker game cookie currently
requires re-bootstrap when its token expires, so transparent long-lived login
renewal remains a separate UX/cutover task.

## Legacy ownership and preservation

**Do not automatically copy** any existing unprefixed checkpoint into an
authenticated account. There is no reliable proof whether an older save
belonged to account A or B. The source leaves every old key intact,
unmodified, even if no account was previously known. The first protected
login starts with a fresh per-user save, while local/offline development
continues to see its old unscoped save. A later explicit manual import would
require trustworthy user consent/ownership verification and independent
migration tests. We do not delete old saves or claim such an importer exists.

These are **local namespacing semantics**, not encryption or server-backed
confidentiality against arbitrary JavaScript running on the same origin.
Avoid advertising browser storage as a hardened multitenant security
boundary. Cross-tab session changes should be additionally covered by
foreground revalidation and browser E2E before production acceptance.

## Tests / cutover contract

`npm run test:grid --prefix frontend` includes
`frontend/tests/identityStorage.test.mjs`. It checks correct SSO issuer
audience binding through the Worker response, fail-closed errors, local
offline compatibility, two independent accounts with overlapping keys,
legacy preservation and namespace-scoped deletion/iteration.

`frontend/tests/identityScopedSaves.spec.ts` exercises the same adapter with
actual Chromium localStorage and simulated distinct Worker responses, proving
that account A, account B and the original legacy save do not overwrite one
another. `identityForeground.spec.ts` mounts the real React app under the
canonical protected URL with proxied local Vite assets and simulated Worker
responses, then checks initial deny and A→B cross-tab focus revocation.
Because Chromium's headless window manager does not reliably fire native
focus on `bringToFront()`, this browser test explicitly dispatches focus and
blur events after switching real tabs. It verifies the installed handlers,
but **does not prove OS-native focus delivery on every browser/platform**.
The visual evidence includes the denied mobile and revoked desktop screens.
The fail-closed interstitial uses a responsive, keyboard-accessible ShadowOps
panel rather than unstyled browser links; its 390px and 1280px screenshots
must be visually inspected on the PR before it is marked ready.
These fixtures are **browser-storage / synthetic-Worker tests**, not
authenticated live login/logout tests.

Before enabling the protected site in Cloudflare, additionally run real
browser E2E across **account A → close central session → sign in B → F5 →
sign back in A** with real Identity/Worker/Mongo and assert no cross-account
restore or stale replay. Never interpret mock-Identity tests or a green build
as proof that those live steps have passed. The public static publisher
remains frozen until the independent Cloudflare Access/Identity cutover.
