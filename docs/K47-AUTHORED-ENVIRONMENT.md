# K-47 — authored environment kit, not more procedural scenery

## Why this contract exists

The supplied K-47 reference is a dense, cinematic industrial colony, with large
connected buildings, weathered metal, rock cuttings, believable silhouettes,
warm practical lights, and a playable yard filling the scene. Real Chromium
1280/390 screenshots demonstrated that several iterations of SVG boxes and
procedural Three.js cliff ribbons still looked like a small schematic diorama
(#245, #250, #251, **#255 rejected unmerged after green CI**).

**Do not call this loader an art overhaul.** It only makes it possible to
replace the current placeholder geometry with *real original authored models*
without throwing away the existing squad and mission systems. Its three slots
are deliberately `unpublished` until qualifying binary assets exist.

## Canonical frame

- One world tile is one Three.js unit, `x` for column and `z` for row,
  `y` up; the origin and iso projection belong to
  `frontend/src/groundArchiveCamera.ts`.
- Do **not** shift the camera, pickable SVG polygons, 18×12 terrain, officer
  positions, pathfinding, unknown fog or mission objective coordinates.
- Use world-relative geometry: model meshes are exported around their local
  `[0,0,0]`; the loader adds each slot's declared `anchor` world position.
- Three initial locked, **non-walkable** slots live in
  `content/scenes/k47-environment-art.json`:

| Art slot | Real blocked footprint | Initial anchor |
| --- | --- | --- |
| `south-industrial-shell` | `3,7` through `7,7` | `[5,0,7]` |
| `west-archive-shell` | `0,3`, `0,4`, `0,5` | `[0,0,4]` |
| `east-utilities-shell` | `8,1`, `8,2`, `8,3` | `[8,0,2]` |

Assets must fit the bounding rectangle of their footprint (maximum 6cm
slack), project above rather than through the actual floor, and have
world-space `y` within `[-0.4, 5]`. A roof or catwalk is *decoration only*;
do not depict an accessible new exit, doorway or elevation in a blocked cell.
For buildings with real interactions, mission targets and HUD labels remain
separate SVG/DOM objects.

## Authoring recipe

1. Create the **whole south industrial frontage as one authored industrial
   structure** in Blender or another proper DCC: varied large warehouse
   masses, parapets, industrial windows, railings, conduits and substantial
   supporting details rather than repeated generic cubes. Sculpt/texture
   rocky containment below/behind the actual footprint where permitted.
2. Unwrap UVs; use physically based baked materials (metal/roughness),
   photographic-quality rough surfaces, normals and AO. All images must be
   embedded into a **single self-contained glTF 2.0 GLB**; PNG/JPEG textures
   are preferred for compatibility. No external `uri`, video, Draco,
   meshopt, runtime scripts or new extension dependency.
3. Keep one GLB at **4 MiB or less** and the total environment budget within
   twelve slots. Choose useful texture resolution and reduce geometry/atlases
   before exceeding the budget. Avoid baking interface, officer sprites,
   target labels or objectives into the art.
4. Record attribution/provenance in the manifest. The public GitHub repository
   accepts only **original work** or properly verified **CC0**. Potential
   material sources include
   [Poly Haven](https://polyhaven.com/license) and
   [ambientCG](https://ambientcg.com/), but source/license must be checked
   for each chosen asset. Never include franchise models or ripped game art.
5. Run a **same-camera screenshot** at 390 and 1280 px, with the full
   functioning away team. If the result remains a sparse diorama or hides
   the squad, reject the art *regardless of CI status*. Match scene coverage,
   depth, detailed industrial material, warm/blue lighting and silhouette
   rather than copying the reference screen pixels.

## Content-addressed delivery — infrastructure owns R2

The GLB is uploaded by the infrastructure owner to R2 using a name of the form
`star-adventures/environment/<logical-id>-<first-16-hex-sha256>.glb`.

For a local **original/licensed** file:
```sh
sha256sum your-asset.glb
wc -c < your-asset.glb
```

Set the matching slot to `status: "published"`, with an `asset` object
containing:

```json
{
  "url": "https://assets.chess-studio.shadowops.dpdns.org/star-adventures/environment/<logical-id>-<sha16>.glb",
  "sha256": "<real full SHA-256>",
  "bytes": 123456,
  "license": "original",
  "source": "Authored by <actual creator / source reference>"
}
```

The placeholders above are **documentation only**, not working URLs. Publish
a real immutable object through `shadowops-infra` and verify its existence,
CORS, content type and checksum **before** editing the manifest in the game.
Never commit big GLB binaries or R2 credentials to this public repo.

## Runtime and failure behavior

- **Zero network calls** for unpublished placeholders.
- Only load once all required real blocked cells are in
  `explored`. The scene's actual fog is still drawn **above** WebGL.
- Require HTTPS on the pinned R2 host, matching SHA-256 prefix in the URL,
  actual byte length, actual full checksum, valid GLB 2.0, no external
  references, no unapproved extensions, and a live model fully inside
  its declared footprint. Every failure leaves the previous
  procedural/SVG environment available and selectable.
- Render approved models inside the existing single landing-court WebGL
  canvas and the canonical orthographic camera. Do not add an additional
  renderer or input plane.
- The `south-industrial-shell` loading gate suppresses the **five matching
  SVG wall modules only after the verified mesh has been placed**. Build an
  equivalent carefully layered replacement for other slots before publishing
  them, especially the archive mission label.
- Validate in browser: real movement, F5, fog and no WebGL, at 390/1280;
  run the GLB unit security tests in the CI mandatory `test:grid` gate.

This is a **prerequisite**, not the actual visual finish line. The first
published, author-reviewed GLB is the next material deliverable.


## Local visual acceptance before R2 promotion

The development Vite server supports a **test-only** `window.__k47ArtPreviewManifest`
injected **before page load** (for example through Playwright
`page.addInitScript`). Production builds completely ignore this hook.
The injected manifest must satisfy the same real blocked-cell footprint, pinned
HTTPS R2 URL, SHA-256, provenance, byte budget and embedded GLB checks as the
published manifest. In a browser test, intercept that exact immutable candidate
URL using `page.route` and fulfil it with the **actual local candidate GLB
bytes**, not a fabricated cloud response. This is a local preview, not proof
that the asset is live on R2.

The real `GroundLandingCourt3D` renderer then puts the preview model **inside
the actual running game**, with the original camera, selectable officers,
mission elements, movement, fog and SVG fallback. A model does not load until
the player has discovered every cell of its footprint; use real orders to
explore it, not a fog bypass. Capture the entire scene at **390 and 1280 px**,
inspect the resulting PNGs, and reject visually poor assets even when WebGL
tests pass. Reload after movement to verify there is no model or save mismatch.
Use `frontend/tests/k47AuthoredGlbRuntime.spec.ts` as the working reference.

An invalid preview is ignored; a missing, corrupt or out-of-bounds GLB retains
the original playable scenery. The shipped manifest remains `unpublished`
until Infra proves an actual immutable, authorized R2 upload. This preview
hook is **not** a new asset source, bypass or network publishing mechanism.

## West archive exterior envelope — visual candidate, not a shipped asset
A continuous original 3D Archive may occupy the **non-world space west of x=0**
while its blocked frontage remains EXACTLY (0,3), (0,4), (0,5).
Bounds: x=-3.3..0.56, z=2.5..5.5, y=-0.4..5. No spill into
walkable x>=1. Its existing 3D presentation stays as fallback until
the candidate passes real checksum/GLB/fog gates and renders successfully.
The original deterministic PBR source is reviewed in Chromium at 390/1280;
no staging, production manifest or R2 publication occurs in this PR.

## Unified 3-building K-47 environment candidate — strict visual gate

The three existing original R2-ready asset slots now have deterministic
**source** candidates built from one pinned material vocabulary: southern
industrial frontage, large west Archive envelope and east science utilities.
All three GLBs must pass self-contained glTF 2.0, license, checksum, exact
blocked-footprint and size validation. No model may add a door, walkable tile
or mission objective.

The candidate comparison is in the ACTUAL game, with normal squad clicks
discovering all real wall cells. Chromium captures the full sector and follow
camera at 390px and 1280px, compares against the same real mission without
art, and checks F5, mission markers, 216 pick targets and SVG rollback. This
does NOT publish assets to R2 or staging; it is a visual acceptance experiment.
The work only passes when the entire colony demonstrably improves toward the
approved environment-led reference, not from passing binary validation alone.

## Science wing: original parabolic observatory receiver
The next visual candidate replaces the previous science rooftop mast with an
actual concave, multi-ring 32-segment triangulated dish, radial braces, a
feed, and a separate rear beacon. It uses only original geometry and shared
authored PBR materials; CI inspects the emitted GLB rooftop triangles and
footprint. The dish is NOT a mission object, scanner interaction, doorway,
or new navigable space. Publish only if actual 390px/1280px game screenshots
materially improve without blocking the officers.


## Approved-asset handoff (still NOT a publication)

The original three-building source already produces **visible real-game
A/B** screenshots; the public runtime manifest remains deliberately
`unpublished` until the CDN objects exist and are independently verified.
The `K-47 unified architecture · full-sector visual gate` workflow now
runs on source PRs and on matching main pushes. After completing authentic
Chromium walking/fog/F5 at **390 and 1280 px**, it stages a bounded immutable
`k47-art-candidate/` bundle, with:

- `assets/<logical-id>-<sha16>.glb`: exactly 3 actual original self-contained
  GLB 2.0 binaries built from pinned generator and material dependencies.
- `manifest.candidate.json`: the three correct real blocker footprints,
  original provenance, byte length, full SHA-256 and planned immutable R2
  URLs. The `published` fields here are **candidate data only**.
- `receipt.json`: exact source SHA and a second byte/hash index. The receipt
  says `published: false` and is not an R2 authorization by itself.
- `k47-full-sector-*.png`: genuine before/after follow and overview
  screenshots, never mock images or unverified public deployment claims.

The independent preflight rejects missing, renamed, oversized, external-URI,
bad-checksum, badly sourced or out-of-footprint models **before writing** the
bundle. It never uses network credentials or mutates the production manifest.
The source artifact is retained for 30 days. Infra must pin a completed
successful **main** source workflow run, independently verify the artifact
and both viewport captures, publish only immutable content-addressed keys,
verify real HTTPS/CORS/bytes, and obtain a separate source PR to enable
the published manifest only after the public CDN proves the exact bytes.

**No green CI result means the human approves the artwork.** This artifact
is a safe delivery candidate; visually reject it if the approved mock,
crew readability or wide landing yard are not met.


## Release liveness: produce a complete handoff for EVERY main SHA

ShadowOps Infra's immutable art publisher intentionally refuses a source
art artifact whose `sourceSha` is not **current** Star Adventures `main`,
even if the three GLB binary hashes are unchanged. A narrow
`push.paths` filter on the original-art workflow made ordinary UI or
mission improvements silently invalidate the last valid publication
candidate: source CI was green but the newly current source SHA had no
art artifact and could never pass Infra's independent discovery gate.

The source **PR trigger remains narrowly filtered** to K-47 art,
tests and workflow changes. The **push-to-main trigger runs for every
main commit**, producing the 3 verified original binaries, checksum-pinned
same-SHA candidate/receipt and the genuine 390/1280 Chromium screenshots
needed by Infra. It does not publish R2 or mark assets active. Original
GLBs have content-addressed names, so an unchanged model legitimately
retains its stable immutable URL even when the source receipt's SHA
changes. Infra still independently requires BOTH completed green source
CI and completed green K-47 art workflow for the EXACT current main SHA,
plus reviewed artwork and manual protected R2 publication.

This intentionally trades one bounded art validation job per main merge
for eliminating stale-artifact release deadlocks and manual source
rebuilds. A missing/failed art job must block publication, not allow
fallback to an older source's receipt.
