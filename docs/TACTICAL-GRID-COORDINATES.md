# Tactical coordinates — renderer-independent foundation

**Status: pure rules only.** A passing 64/64 *world-center* test in this PR is **not** the required Three.js camera/raycast/browser 64/64 test (issue #18). Do not close #18 or claim tactical 3D is working.

- Board coordinate: `(col,row)`, integers, zero-based, row grows toward +Z.
- World plane: `(x, y=0, z)`, Y up, centered around the board origin, default 8×8 with tiles of one world unit.
- Cell `(col,row)` center: `((col+.5-columns/2)*tileSize, 0, (row+.5-rows/2)*tileSize)`.
- Picking from world hit: half-open ranges via `floor(x/tileSize + columns/2)`. Do **not** round rendered screen pixels or compensate with guessed CSS offsets.
- Stable IDs are `col:row`. A blocked tile still has an ID so players can inspect it; move commands must separately enforce walkability.
- Pointer client positions use `canvas.getBoundingClientRect()` to derive NDC, independent of sidebar offsets, scroll position and backing-buffer DPR.
- The camera must aim at the board center, with `OrthographicCamera` fitted to actual canvas aspect ratio, and use an explicit plane/layer for pick targets.
- Every actual browser click will project a cell center through `Vector3.project(camera)`, click the resulting CSS pixel, raycast and compare the resulting logical ID. At least four viewport sizes, DPR 1/2 and reflow are needed before declaring a working camera.

**Next separate PR:** pin Three.js dependencies, create first isolated React tactical-camera probe and Playwright 64/64 round-trip. Test the production code path, not helpers alone. Keep all 3D unit art and combat gameplay out until #18 is proven.
