# Orthographic Three.js tactical picking proof (isolated)

Access locally at `/?tactical=probe`. The normal bridge and away-team gameplay is unchanged.

### Design
- `src/tacticalGrid.mjs`: canonical col:row IDs, x/z positions, obstruction and canvas-local pointer-to-NDC conversion.
- `frontend/src/tactical/threeCamera.mjs`: pinned Three.js v0.180.0, one fixed `OrthographicCamera`, all board extents fitted to the actual canvas aspect.
- One invisible physical picking mesh at y=0. **Only this plane** is raycast. Floating cylinders and the wall-colored blocked tile are merely test fixtures, never authority for tile identity.
- The React component controls mount/unmount and a 64-button accessible keyboard alternative. Pointer moves beyond six CSS pixels are drags, not clicks; `pointercancel` clears an incomplete gesture.
- Camera projections are exposed only on the explicit diagnostic URL through a narrow handle (`window.__shadowopsTacticalProbe`). This allows Playwright to obtain actual projected CSS coordinates, dispatch **real browser mouse/touch input**, and assert the selected tile ID from React. It is not a synthetic replacement for picking.
- WebGL GPU context and geometry/material lifecycle are isolated from persistent game state. Responsive `ResizeObserver` refits the camera.

### Required CI
- For each 360/390/430/1280 viewport, **64/64** clicking real canvas cell centers must return the correct tile ID.
- The canvas is centered within a padded page: verify its nonzero offset, scroll, resize, DPR2, touch and keyboard.
- Visual props floating over cells do not intercept picking. A blocked tile remains inspectable, not walkable.
- Screenshots at mobile and desktop are reviewed manually before merging this *visual PR*. A successful browser test alone is not a claim of premium art or physical GPU performance.

### Scope intentionally excluded
No infantry models, movement/AP, initiative, cover, combat phases, new world state, scene transitions or production deployment. The spike proves *camera/picking only*. Do not call it a tactical game engine until the turn simulation and away-team encounter actually work. A future PR must move from this isolated diagnostic route to gameplay **after** keeping these tests green.
