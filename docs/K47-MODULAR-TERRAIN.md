# K-47 modular 3D terrain — pilot contract (PR 1)

## Architectural decision
The current 18×12 authored map remains authoritative. A **pure visual compiler**
receives its actual blocked walls, stations and explored cell IDs and emits
a deterministic **tile/edge/prefab placement plan**. It never writes state,
adds collision, defines a route, creates a medical objective or exposes fog.

The pilot uses the already shipped `GroundLandingCourt3D` Three.js renderer
and fixed `makeGroundArchiveCamera`, so there is **no second WebGL canvas,
camera, picking plane, animation loop, React Three Fiber dependency or CSS
projection compensation**. The independently owned SVG tiles/picking/mission
objects and fog continue to work and remain the rollback if WebGL fails.

## Catalog and scene composition
- `frontend/src/groundVisual/tileCatalog.ts`: six terrain materials,
  two edge materials, original and modestly varied for industrial surfaces.
- `prefabCatalog.ts`: a 2×1 recessed service trench prototype, **flush with
  an existing traversable floor**. It is not a new path or an open doorway.
- `compileGroundVisualScene.ts`: deterministic selection (stable per-cell
  hash) and safe edge autotiling. An edge appears **only** when the adjacent
  physically blocked wall or station is also explored. Invalid regions fail
  closed; a prefab requires *all* its cells to be walkable and explored.
- `GroundVisualScene3D.ts`: Three.js scene construction from compiled data
  in the one shared environment canvas. Flat instanced geometry and
  per-material batching avoid one cube/renderer per grid square. A multi-cell
  prefab renders as one small group. All GPU resources are disposed on
  remount/route change.

## Scoped pilot and rollback
The first pilot covered only **3..6 × 4..6** of the landing court with modular
3D terrain. The unknown, occupied or out-of-region squares are excluded.
Just the revealed pilot floor fragment is removed from the older continuous
court mesh to avoid Z-fighting and double-painting. Other tiles, structures,
the south industrial hangar and medical station remain unchanged.

The existing `GroundLandingCourt3D` foreignObject publishes diagnostic
`data-modular-*` counters on the actual game screen. Browser tests at
390/1280 check canonical 216 pick targets, real uncovered cell IDs,
present 3D renderer, exact fog ownership, right-click movement, F5 and the
original SVG fallback when WebGL is denied. The pure placement tests cover
blocked/unknown boundaries, deterministic variants, prefab footprint,
invalid geometry and no world mutation.

## Next steps after visual approval
1. Review actual 390/1280 captures for coherent material scale and a clean
   transition into the untouched court; do not merge a visible checkerboard.
2. Expand semantic terrain families: natural stone, slopes, rocky edges,
   pathways and shared world-space textures; maintain consistent silhouette.
3. Upgrade large architectural prefabs (hangar, clinic) and terrain cliffs
   with original Blender → GLB assets and content-hashed R2 publication.
4. Once a sector is visually complete and E2E validated, remove only the
   superseded SVG/Three layers, keeping a simple rollback gate.
5. Reuse catalogs for different planet scenes, with authored biome palettes
   rather than arbitrarily mixing industrial and cave tiles.

**This is a playable foundation, not a claim that K-47 matches the cinematic
mock yet.** No purchased/licensed art, published R2 objects or binary files.


## Industrial architecture prefab experiment (Draft — visual gate pending)

The next focused candidate builds each **fully visible** southern blocked-wall
run as **one connected 3D hangar** inside the existing Three scene. Shared roof,
recessed service bays, long fascia, roof machinery, shadow-casting structure
and a bounded palette replace the corresponding SVG facade **only after** that
exact scene has rendered. Remembered and undiscovered runs retain the original
SVG; WebGL-denied clients retain every SVG span. The run geometry occupies only
the verified canonical blocked row. No new cell, fictional entrance, gameplay
path, camera, mission, CDN or collision is introduced.

This is **not an approved art release**. The PR must remain Draft until exact-
head CI passes and real Chromium screenshots at 390px and 1280px are inspected
against the agreed K-47 cinematic reference. If the coherent 3D hangar still
looks like disconnected boxes or visually fights surrounding SVG, reject it,
keep main unchanged and iterate the authored modular architecture rather than
merging just because code/tests are green.

## Shared semantic micro-surfaces (follow-up pilot)

The six existing floor material variants now resolve to **four semantic surface
families** (concrete, steel, mineral and dust). Original deterministic 64×64
RGBA pixels are generated at runtime in one pure helper; Three.js creates at
most one small DataTexture per actually used family. Both metal variants share
the same texture, as do both concrete variants, preserving the six existing
InstancedMesh batches and all canonical cell/fog/camera/interaction contracts.

The textures add low-contrast grain, brushing and mineral variation. They do
**not** generate new physical tiles, cracks, walls, doors, height levels or
navigation, and do not fetch assets or copy any licensed image. Texture memory
and material geometries are disposed when the pilot scene is torn down.
The pure and Three scene lifecycle tests verify deterministic bytes, opacity,
asset-family reuse and cleanup. Evaluate the actual Chromium screenshots at
390 and 1280px before accepting: subtle material texture is not proof that
the K-47 world now meets the cinematic art reference.


## Coherent landing-court expansion (Draft — visual gate pending)

The next visual iteration expands modular coverage to **x=2..7, row=3..6**,
comprising **21 genuinely walkable cells** of the authored 6×4 court.
The three blocked mission/transition cells remain owned by the authoritative
world, with no false doors or new routes. Only explored modular squares replace
their matching legacy floor polygons. Their PBR variants now use subtle 2×2
wear clusters and quarter-turn orientation of existing texture maps (industrial
brushed steel keeps one direction), so repetition is reduced **without** new
textures, draw-call families or a second WebGL renderer. Under unexplored fog,
the original court and original SVG fallback remain available.

This is **not** approval of a complete cinematic K-47 environment. A 6×4
paving expansion alone cannot match the full reference; the 18×12 colony still
needs properly authored architectural/terrain prefabs and real reviewed GLBs.
Keep the PR Draft until the actual Playwright 390/1280 captures have been
reviewed for seams, legibility, visual density and correct layering, and the
exact-head CI is green. Preserve the previous modular slice as a rollback.

## Authored industrial GLB source — November 2026 candidate

The visual target is still the approved cinematic K-47 mock, not a passing
CI check. We now have an **actual modeled PBR asset source**:
scripts/author_k47_south.py. It generates the whole 5-cell south industrial
frontage as a coherent model: multiple profiled roof masses, weathered
self-contained material images, 4 service bays, braces, piping, machine
clusters, exhausts, lights and a signal mast. No external licensed artwork.

The dedicated workflow k47-art-candidate.yml builds the self-contained GLB
in ephemeral CI with pinned dependencies. It checks actual GLB 2.0 structure,
embedded images, hash, 4 MiB budget, and footprint, and serves the exact
candidate in the **existing real game canvas** using the test-only manifest
plus a Playwright intercepted immutable URL. Screenshots at 390px/1280px,
the binary and SHA provenance are retained as reviewable artifacts.

**No GLB binaries in Git, no fake published manifest, no R2 upload.** Keep the
SVG/PBR fallback until a human-inspected side-by-side of actual live-game
screenshots shows meaningful progress. The final source asset should be
published in content-addressed R2 by infrastructure, never by this game repo.


## Four-cell landing transfer platform — actual viewport A/B

Prior science superstructure experiment #287 passed browser tests but was
**rejected without merge**: the 3-cell tower was mostly outside the actual
phone follow camera, behind the command/mission overlays. The rejected
256px world-aligned microtexture experiment #286 also failed perceptual
review. Adding asset complexity without an obvious visible game improvement
is NOT progress.

The next candidate replaces **the existing 2x2 central transfer hatch**, a
truly visible object under the playable crew, with a continuous industrial
fabrication: cast-steel bevel, large shared panel geometry, a recessed
machinery hub, substantial safety markings and large weathered plate details.
It uses no image download, extra GLB, fake station, synthetic collision or
second canvas, and never changes the four authoritative original walkable
cells. No doorway or access through a blocked wall is implied.

A local development-only `__k47LegacyLandingPlatform` flag switches just
the decoration back to its pre-change drawing, without changing fog, game
state, camera or input. The exact-route Chromium A/B spec records old/new
**default follow views** at 390 and 1280, plus real full-map views, checks all
216 real hit targets and genuine movement/F5. Production always uses the
candidate style. The dedicated visual workflow keeps these screenshots as
review artifacts. Inspect at actual mobile display size; if visually weak,
visually noisy or masking crew feet/waypoints, reject without merging.


## Tiered south industrial hall — visible 3D candidate

After the 4-cell foreground transfer platform shipped via #288, the next
meaningful architecture target is the **existing south factory/hangar** in the
normal follow camera. Its low original 3D roof is still indistinct at typical
play zoom. On any fully visible connected run of 2+ real blocked south wall
cells, the shared WebGL renderer now proposes one **two-storey factory** with
a broad glazed engineering gallery, structural mullions, overhanging weathered
roof, continuous bronze service rail, an asymmetric exhaust stack and a
roof-mounted cooling unit. The geometry is a reusable run-based prefab.
Every vertex stays over the existing blocked cells; no fabricated passable
canopy, controls, walls, doors, NPCs, pathing or mission interactions.

The original lower hangar persists as a fallback. Only a complete
visibility-safe span enters the WebGL renderer, and the original SVG art is
hidden only after the first successful frame. WebGL-disabled devices retain
their SVG as before. The DEV-only `window.__k47LegacyIndustrialHangar`
flag switches only the extra roof/gallery off for same-route Chromium A/B;
production always uses the tiered style. The new visual gate captures
immediate landing **and** a genuine move to 5,6 in **390/1280px** follow
views, verifies 216 original tile pick targets and saved officer state after
F5. A green build does not prove quality: visually inspect both widths and
decline to merge if the factory blocks officers, reduces usable viewport or
the difference remains trivial.
