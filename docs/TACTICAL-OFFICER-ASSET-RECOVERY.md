# Tactical officer visibility when R2 is unavailable

**Status:** implemented as reusable renderer utility and isolated browser tests;
**not yet wired into the current Codex-owned TacticalProbe runtime**.

Star Adventures' first tactical WebP assets are hosted in Cloudflare R2, using immutable
URLs from `frontend/src/assets/r2-assets-manifest.json`. PR #30 verifies their
bytes/SHA-256/WebP decode, and PR #32 verifies that the actual tactical view
requests the live animation atlases while remaining selectable during HTTP 503.

## New component

`frontend/src/tacticalOfficerFallback.ts` provides `mountResilientOfficer`:
- The officer has a named scene root anchored on ground y=0; position is
  independent of remote image loading and of grid selection.
- Immediately renders a **simple three-part low-poly proxy** (boots/torso/head
  silhouette), so failure/slow CDN never means an invisible officer.
- Once Three.js reports a successfully decoded texture, switches to the
  original sprite and hides the proxy. Atlas row/column UV repeat is initialized.
- If loading fails or throws, keeps the low-poly unit visible and reports a
  distinct `failed` state. No misleading silent success.
- Cleanup removes the scene node, geometry, materials and texture and ignores
  late successful callbacks. No mutation of game state, crew stats or combat
  rules.

## Evidence and limits

`frontend/tests/r2OfficerFallback.spec.ts` checks visible-on-first-frame,
503 error, recovery after successful load, proper UV grid, scene cleanup and
an isolated WebGL render capture at 390px, without making any R2 requests.
The proxy is deliberately a **failure-state fallback**, not a proposed final
officer design and not part of the premium character art direction.

**Next separate integration PR:** after active Codex animation PRs stop modifying
`TacticalProbe.tsx`, replace its direct `new THREE.TextureLoader().load(...)`
calls with `mountResilientOfficer`, and add an actual gameplay E2E that
intercepts R2 with 503 and sees two *rendered* proxies on the tactical board.
Also verify failed images recover on a future mount and that selection stays
64/64. Do not claim users can see the fallback in the normal game until this
integration passes real screenshots and mobile/browser QA.

No licensed Star Trek art or new CDN objects are included.
