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
Only the **3..6 × 4..6** part of the landing court is compiled into modular
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
