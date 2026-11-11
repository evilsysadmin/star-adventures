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


## PR 2 — wide terrain and grounded rock rims

The second increment expands the original limited 4×3 pilot to a 12×10
**visual candidate region**, bounded by the existing 18×12 game map. All
drawn cells remain strictly gated by `explored` and authoritative
`walls / objects`. The 120-cell region is **not** an expansion of
movement, LOS, camera or saved map data.

- The compiler maps connected industrial apron and outer geology into
  semantic material families. Avoid alternating checkerboard palettes.
- A deterministic 1536×1024 *original* world-space texture spans all
  revealed floor tiles: irregular fine aggregate, large weather deposits,
  sparse cracks and structural joints. Tiles share world UVs even when
  batched into different material groups.
- Original faceted rock outcrops stand **only** on discovered canonical
  blocked wall coordinates that directly border a discovered walkable cell.
  Unseen walls, walkable cells, mission stations and arbitrary off-map areas
  never receive rock meshes.
- A low service lip uses actual discovered neighboring cell topology, not
  assumed cliff elevation. These rims are scenery, not obstacles.
- The generic SVG wall/roof proxy hides only after the existing WebGL court
  reports a successful frame, and automatically returns if WebGL fails.
- The old 3D court drops only floor fragments replaced by known modular
  placements, preserving its original lighting/meshes and the SVG fallback.

No Blender, R2 upload, licensed image, new renderer or engine-schema change.
Acceptance requires Chrome at 390/1280, canonical 216 pick cells, complete
fog and F5 journeys, and an actual screenshot comparison demonstrating
meaningful visual improvement. If the scene still reads like disconnected
panels or introduces false cliffs, **keep Draft and iterate**.


## Visual review finding and exterior-landscape follow-up
The early Chrome capture of the expanded floor still looked too close to
the old scene (~4–5% changed pixels in the default follow-camera view).
That *candidate was rejected*: bigger material coverage alone did not
achieve the approved cinematic terrain goal.

The follow-up therefore adds three original broad continuous terrain bands
as **real Three.js geology**, not repeated 1×1 rock blocks: west wall,
north ridge and southern exposed edge. This decorative geological frame
exists strictly OUTSIDE map x=0..17/z=0..11, cannot reveal an unknown
game-cell, and shares the current orthographic renderer and physically
lit industrial/rock palette. The rocks generated from the compiler remain
restricted to actual known blocked in-map walls. The terrain-band geometry
is deterministic, reusable and has tests proving every vertex lies outside
the map; it is disposed on renderer cleanup.

Visual acceptance still requires actual 390/1280 screenshots after this
addition, including whether the geological frame is visible, correctly
behind the squad, non-blocking and not a new wall of beige cuboids.


## Second visual correction: useful foreground architecture, not giant cliffs
The first terrace screenshots passed CI but showed three visually poor,
over-sized green mountains dominating the complete-map and follow camera.
This candidate was **rejected** despite 6/6 passing jobs.

The revised terrace shapes are much lower, narrower and darker (resembling
eroded ground shoulders rather than walls). Most importantly, the first
landing court now uses a **reusable 3×2 original steel service apron prefab**
on x=2..4, y=4..5: one physically continuous low assembly with a recessed
trench, 11 grating ribs, long structural rails, segmented service panels,
inlaid safety strips and integrated low lights. It can appear only after
all six canonical traversable cells have been discovered, and remains under
the officers/mission overlays. The old 2×1 prefab remains in the catalog.
There is no new path, false entrance, collision or gameplay schema.
Tests validate both the prefab footprint and its low clearance ceiling.

Visual gate remains exact-head Chrome 390/1280 before Ready/merge, including
normal follow and full-map camera. The first 6/6 on the bad terrace version
does NOT approve this corrected candidate.

 
## Architectural visual slice after terrain comparison

The corrected geology and 3×2 service apron alone still yield a modest
change in real gameplay screenshots; the remaining visual bottleneck is the
legacy SVG science wing and large block silhouettes. This iteration adds
an original modular **science-campus-3x1** prefab covering precisely the
authoritative blockers (sensor-vault 2,2; wall 3,2; probe 4,2).

The reusable compiler now accepts a list of requested prefabs, with a
`clearance` contract: `flush-floor` pieces require every cell to be free
and known, while `blocked-building` pieces require every cell to be a
genuine existing obstacle and known. Both require their entire footprint
inside the visual region. Neither changes the map, objectives or camera.

The 3D science prefabrication includes one shared plinth/canopy, recessed
laboratory glazing, structural ribs, rooftop optical receiver, utility
machinery and restrained embedded lighting. The old SVG science wing is
hidden **only** when the new prefab is discovered and the existing WebGL
renderer has drawn successfully. It automatically reappears on GPU failure.
Archive/Sonda mission terminals, waypoint labels and actions stay in the
separate station layer above fog and the new art.

The PR remains Draft until exact-head 6/6 CI and *actual follow/overview*
390/1280 visual comparisons. This is the first real modular-architecture
migration, not proof of complete mock parity.
