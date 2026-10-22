---
name: tactical-camera
description: Use when implementing or changing Star Adventures elevated tactical combat camera, grid picking, raycasting, pointer controls, or 3D battle-scene validation. Prove screen-to-grid correctness before adding decorative art.
---

# Star Adventures tactical-camera skill

Purpose: avoid the camera/picking/interaction regressions seen in earlier ShadowOps isometric experiments. This skill is original project guidance informed by external MIT-licensed agent-skill references; **it does not install or execute any third-party code**.

## Read before work
1. `AGENTS.md` and `docs/TACTICAL-CAMERA-GATE.md`.
2. `src/spatial.mjs` and `src/awayTeam.mjs` for map and officer identities, but do not couple tactical renderer to first-person render functions.
3. For accurate API and QA patterns, consult:
   - [threejs-interaction](https://github.com/cesartevisual/threejs-skills/blob/main/skills/threejs-interaction/SKILL.md) — pointer-rectangle NDC, click vs drag, selection IDs, cleanup.
   - [threejs-testing](https://github.com/cesartevisual/threejs-skills/blob/main/skills/threejs-testing/SKILL.md) — projection tests, deterministic visual fixtures, browser evidence.
   - [threejs-scene](https://github.com/cesartevisual/threejs-skills/blob/main/skills/threejs-scene/SKILL.md) and [threejs-r3f](https://github.com/cesartevisual/threejs-skills/blob/main/skills/threejs-r3f/SKILL.md) — scene / React renderer ownership.
   - [isometric-game-skills](https://github.com/0xheycat/isometric-game-skills) — grid/screen transform and tile-picking maths for reference; its demo is **Canvas2D**, not a drop-in Three.js camera.

## Required order — do not skip
1. Define one canonical board coordinate system: integer col/row, world tile size, x/z plane, world-y up, origin, walkability and elevation rules. World/grid logic must be pure and deterministic.
2. Implement a fixed `OrthographicCamera` angled at a small, readable board. Do not add orbit, animated camera, 3D character art or postprocessing yet. Keep camera center on the whole board with consistent near/far.
3. Use `Vector3.project(camera)` for center positions and `Raycaster.setFromCamera()` against a dedicated grid plane/picking layer. Calculate pointer NDC from the **actual canvas rectangle**, not window dimensions. Work with CSS scaling and device pixel ratio.
4. Test every grid center round-trip: grid cell -> world center -> projected point -> browser pointer -> same stable cell ID. Include borders, corners, non-square boards, rotated camera, viewport changes, and CSS offset canvas. Never infer selection from decorative mesh index.
5. Prove occlusion is correct: a character/particle/terrain overlay must not intercept tile selection, unless intentionally selected. Separate pick collision layers from visuals. For elevated floors use a declared height-level contract.
6. Prove input: pointer and touch pick; drag does not trigger click; keyboard grid navigation and focus-visible HTML counterpart; touchcancel, pointercancel, resizing, cleanup and repeated mount/unmount.
7. Prove performance: deterministic screenshot after one rendered frame, production build, Playwright at 360/390/430/1280, SwiftShader-safe fallback, actual hardware check for GPU claims. Measure, do not infer FPS from headless CI.
8. Only after the proof passes can we add tactical units, cover, LOS, movement visualization, turn logic and premium Blender assets, each in a separate PR.

## Mandatory test contract
- When selecting 100% of cell centers at each tested width, reported grid ID must match the command's intended ID.
- At least a few near-edge and border hit tests should be explicitly specified, avoiding ambiguous exact boundaries.
- No horizontal overflow; camera/frustum not cropped at 360 px or 1280 px.
- Picking must be driven by canvas-local coordinates; HTML page offsets and side panel widths do not change selected cells.
- User may pan/zoom only after correctness with fixed camera is proved; after addition, center/picking round-trips must still hold.
- Screenshot review with no wrong-unit, wrong-tile, hidden cursor or overlay collisions.
- The actual gameplay state determines selected tile and resulting action. Rendering is never authoritative.

## Red flags — stop the PR
- Hard-coded screen offsets or compensating for wrong camera math with CSS.
- A canvas screenshot presented as proof that the correct logical tile was clicked.
- Tests only on a square board or only at one desktop viewport.
- A successful software-renderer build presented as measured GPU performance.
- Relying on a raycaster hit against a decorative mesh whose position may animate.
- Introducing complex isometric environments before passing the empty-board interaction gate.

## Deliverables and evidence
Every combat-camera PR must record the exact commit SHA tested, projection/picking unit tests, real Chrome interaction results, screenshot artifact locations, any unsupported hardware, and precise limits. Keep the first playable tactical engagement grid-first. A prettier view is not completion unless the tactical rules also work.
