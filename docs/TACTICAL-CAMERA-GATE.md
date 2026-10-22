# Tactical battle camera: proof before production

## Decision
Exploration (bridge and away team) remains first person, Chronicles/MM3-style. Ground combat pauses exploration and changes to an **elevated, fixed-angle tactical board**, with a separate rules domain. An authentic isometric projection is a possibility, **not** a requirement to adopt a new isometric engine or ChessCom renderer.

We explicitly avoid another failed isometric attempt: no new art or game-size maps until exact picking works.

## First experiment / acceptance

1. Add the smallest possible production-pinned Three.js dependency in a separate focused PR; use React rendering ownership explicitly. Avoid large imported frameworks or an unreviewed community code installer.
2. Draw an 8×8 board on x/z with y-up; cells have immutable IDs. Place three plain unit markers, one obstacle, one elevated tile; no shadows or special effects.
3. Use one `OrthographicCamera` oriented to fit all tiles at mobile and desktop aspect ratios. Camera parameters live in a single testable module, not scattered among components.
4. Center click round-trip: world center -> NDC -> canvas client coordinate -> ray to grid -> exact same ID for **64/64 cells** at 360, 390, 430 and 1280 px. Show one deterministic screenshot for each width, but don't use image matching as a substitute for ID assertions.
5. Test canvas offset within the surrounding React page, and one resize after initial render; clicking the same logical cell must still work.
6. Test a visual unit floating over a cell, walls and occlusion via a dedicated picking plane/layer. The cell below must remain selectable as designed. Test non-walkable cells remain selected for information but commands cannot move there.
7. Verify pointer, touch, keyboard and Playwright; dispose event listeners/geometry/materials on remount. For accessibility provide HTML equivalent cell controls when 3D input isn't available.
8. After this proof passes, add *real* ground-turn order, initiative, path, LOS and cover as pure mechanics. Transition back to the same first-person position only when combat ends. Preserve save schema and rollback.

## Hard gates
- **0 mismatches** in center-of-cell picking across all tested viewports.
- Click on UI outside the canvas must not select any tile.
- Works with DPR 1 and 2, scrolled page / nonzero viewport bounds.
- Fixed camera first; zoom/pan/rotation must not be shipped until their corresponding selection tests are green.
- Do not add camera orbit by default. It makes tactical UX and debugging harder.
- No dependence on GPU hardware in unit math tests; browser screenshots are supplementary evidence.
- **No cosmetic-only PR merge** while selected coordinates or keyboard parity regress.

## Skills assessed (2026-10-22)
- [cesartevisual/threejs-skills](https://github.com/cesartevisual/threejs-skills) (MIT): narrowly useful `threejs-interaction`, `threejs-testing`, `threejs-scene`, `threejs-r3f`. Community instructions, not a validated game engine.
- [0xheycat/isometric-game-skills](https://github.com/0xheycat/isometric-game-skills) (MIT): excellent targeted reference for grid coordinate inverses, canvas picking and depth order; demo is Canvas2D, so a 3D picking system still needs its own tests.
- [majidmanzarpour/threejs-game-skills](https://github.com/majidmanzarpour/threejs-game-skills) (MIT): broad game direction, deterministic test hooks and Playwright ideas, but larger than necessary for this proof.

These are documentation links. **No third-party skill, npm dependency, installer, runnable template or binary was imported in this PR.** Inspect licences and current code before ever vendoring components.

## Iterations
- [x] Curate a project-local specialized skill and measurable acceptance gate.
- [ ] Small Three.js camera-grid probe with 64/64 center selection tests and browser screenshots.
- [ ] A 3-officer vs 2-hostile practice fight with actual turn state, simple initiative, covers and return to exploration.
- [ ] Premium tactical assets and visual polish only after all above.

Track progress in issue #8, one PR at a time, maintaining existing first-person playable rollback.
