# Orthographic Three.js tactical picking proof (isolated)

Access locally at `/?tactical=probe`. The normal bridge and away-team gameplay is unchanged.

## Reconciliation with current main

This PR originally introduced Three.js 0.180.0, but current `main` already uses Three.js **0.186.1** with `@types/three` and its own tactical view. This isolated diagnostic route **reuses the existing pinned dependency and lockfile**; it does not downgrade or replace the active tactical experience. The legacy camera experiment remains separate from the current gameplay scene.

## Design

- `src/tacticalGrid.mjs`: canonical col:row IDs, x/z positions, obstruction and canvas-local pointer-to-NDC conversion.
- `frontend/src/tactical/threeCamera.mjs`: a fixed `OrthographicCamera`, with board extents fitted to the canvas aspect.
- One invisible physical picking mesh at y=0. **Only this plane** is raycast. Floating cylinders and the blocked tile are test fixtures, never authority for tile identity.
- React owns mount/unmount and provides 64 accessible keyboard buttons. Pointer motion beyond six CSS pixels counts as a drag; `pointercancel` clears an incomplete gesture.
- Camera projections are exposed only at the diagnostic URL through `window.__shadowopsTacticalProbe`. Playwright samples actual projected CSS coordinates, dispatches **real browser pointer/touch input**, and asserts React's selected tile ID.
- The scene cleans up event listeners, geometry, materials and its WebGL renderer when unmounted.

## Required validation

- At 360/390/430/1280 px, **64/64** actual pointer clicks at cell centers return the correct tile ID.
- Verify canvas offsets, scrolling, resizing, near-border picks, DPR2, touch and keyboard parity.
- Floating visual props must not steal selection. A blocked tile remains inspectable, not walkable.
- Inspect real desktop and mobile screenshots from the exact-head CI artifact **before marking this visual PR ready**. Passing browser tests is not equivalent to visual QA or measured GPU performance.

## Scope intentionally excluded

No infantry models, movement/AP, initiative, cover, combat phases, new world state, scene transitions or production deployment. The probe proves **camera/picking only**. It must not be mistaken for a playable tactical combat engine.
