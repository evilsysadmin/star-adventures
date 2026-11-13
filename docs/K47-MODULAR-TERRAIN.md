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


## Single-canvas depth compositing experiment (after rejected art studies)

Real 390/1280 Chromium captures rejected #289, #290 and #291. #289's
three-dimensional hangar was buried under the later SVG floor dressing;
#290 raised an SVG roof that then visually overlapped officers; #291 covered
the ground in distracting painted arcs instead of solving depth. A superior
architecture starts with correct layer ownership and a real before/after
test—not more procedural geometry.

This candidate preserves the **same** WebGL renderer and physical 18x12
world, but places the single environment canvas **after** the existing
`GroundColonyFloor` visual foundation. `GroundRescueBayDeck` separates
into an underlay (existing verified free floor cells, wall skirting and
material definitions) and an overlay (the approved four-cell transport
machinery from #288) with exactly one instance of each. The court goes
between them, and fog, mission stations and squad remain above all of them.
This prevents the 3D hangar being flattened by SVG ground paint without
introducing another canvas or making the 3D geometry a picking surface.

A DEV-only `__k47LegacyDepthOrder` switch renders the exact old
composition for real gameplay screenshots. The dedicated Chromium workflow
captures arrival and an authentic move to 5,6, in 390/1280 follow views,
and validates the actual sibling order, original 216 pick targets, fog,
F5 continuity and WebGL-denied floor/platform fallback. **Visual acceptance
is mandatory**: if the PBR floor overpaints important corridors, the
hangar hides squad silhouettes, or the composition is not closer to the
approved mock, close the PR without merge. The source art slots remain
unpublished until independently reviewed.

### Actual-pass correction: SVG owns floor; WebGL owns architecture

The first depth-order A/B exposed an opaque three-dimensional court surface
overpainting important SVG floor/route details and darkening the squad's
foreground. The candidate therefore uses **architecture-only WebGL** when
the canvas is in its elevated layer: the same renderer still paints the
existing south hangar, fallback PBR wall blocks and verified authored GLBs
when published, but skips rendering the old 3D floor and modular pilot.
The SVG remains the only visual ground surface and can keep its approved
transfer machine and corridor art. The legacy comparison path preserves the
old 3D floor as-is. Expose `data-floor-visual-source='svg'` and zero rendered
PBR floor cells in the modern composition; do not falsely report previously
compiled tiles as painted. An explicit 3D floor pass can be reconsidered
only with a proper dual-depth rendering/compositing contract.
