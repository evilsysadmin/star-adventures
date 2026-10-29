# Bridge interior — second visual pass

This pass develops the navigable interior in `bridgeInterior.ts`. It remains an
original, code-authored 3D room. The orbital image and its provenance remain as
documented in [BRIDGE-VISUALS.md](BRIDGE-VISUALS.md).

## Visual direction

- Raised coffered ceiling, elliptical command-area light well and longitudinal
  light rails give the room a stronger architectural silhouette.
- Satin metal, restrained brass, dark green upholstery and carpet establish a
  consistent palette. Small deterministic canvas-authored bump maps provide
  brushed metal, fabric and deck grain without binary texture downloads.
- Manufactured console wedges, split pedestals, framed displays and low-backed
  operator seating replace the repeated block-shaped desks. The command chair
  keeps its taller silhouette.
- Instrument graphics distinguish navigation/security orbital diagrams, science
  traces and communications waveforms. They are decorative station schematics;
  objectives, observations and outcomes still come from actual game state in HTML.
- Recessed wall vents, deck panel fasteners, window mullions and original Meridian
  signage provide scale. The light well and floor trim introduce no physical step.

## Responsive rendering

The camera now projects for the actual canvas dimensions, including phone and
landscape layouts. It uses a wider vertical field of view at narrow aspect ratios
to retain a useful view of the room rather than cutting off the peripheral desks.
A `ResizeObserver` redraws the current pose when the viewport changes. It is
removed on disposal. There is no animation loop, bloom or postprocessing.

Backing dimensions preserve the visible aspect ratio and remain within **460,800
pixels** (the previous 960×480 budget), with a maximum width of 960. A phone canvas
may consequently have more than 480 backing rows; the total pixel budget remains
the same. This supersedes the fixed 960×480 dimensions in BRIDGE-VISUALS.md.

The renderer still uses one cached 1024px furniture shadow map and a small
authored light probe. Repeated opaque furniture and architecture are batched by
geometry, material and shadow flags into static instances. Their transforms
include their original station/seat groups. All instance buffers, procedural
textures and geometries are disposed on exit. No physical-device frame-rate
claim is made.

## Gameplay and verification

The spatial engine still owns station cells, movement, targeting and access.
This is a presentation change: no new collision, save schema, encounter, reward
or narrative outcome is introduced. The surface renderer remains separate.
WebGL denial and context loss retain the existing navigable 2D fallback.

`bridgeArchitecture.spec.ts` exercises the actual rendered room on 360, 390, 430
and 1280px layouts, walking to the helm and restoring after refresh. It now also
asserts backing aspect/pixel budget and resizes an active science-station visit
through phone, landscape and desktop layouts without changing the station or
position. These captures require actual inspection before the visual PR is ready.
Existing bridge and mobile exploration tests cover interaction and transport.

This is a further art-direction pass, not a claim of final production art, a
populated bridge or a complete campaign. No licensed franchise media, new large
binary assets, hosting or deployment is included.
