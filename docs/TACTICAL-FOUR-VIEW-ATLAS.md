# 4-view walking atlas: content contract and safe rollout

**Status:** support for officers is opt-in. The existing R2 V1 WebPs have SIX
frames of ONE view and cannot show an authentic back-facing character.
No V2 assets are yet published or claimed to have passed artistic QA.

Create original transparent WebP atlases with exactly 6 columns x 4 rows.
Each column contains a different phase of the walk cycle; rows from the
TOP are world `north (-z)`, `east (+x)`, `south (+z)`, `west (-x)`.
The fixed camera looks down from (+x,+z), so the four rows must depict
genuinely different three-quarter views of the same character and costume.
No horizontal-mirrored front art is acceptable as a substitute for backs.

Recommended cell size 256x384, overall 1536x1536. Keep feet at the same
anchor, silhouette and scale across all 24 transparent frames.

Upload the reviewed, immutable content-hashed WebPs to Cloudflare R2 and
add verified manifest entries to `frontend/src/assets/r2-assets-manifest.json`:
- `starAdventures.tactical.officerFemaleWalk4V1`
- `starAdventures.tactical.officerMaleWalk4V1`

The runtime only loads an optional V2 asset when its manifest entry exists.
It checks atlas dimensions, keeps independent UVs for each officer and
falls back to V1 on missing or invalid assets/CDN errors. Changing walking
direction never downloads another asset.

Firing, taking damage, hostile actors and other actions still need their
own consistent directional authored artwork; see issue #154. Avoid fake
images, speculative R2 links or overwriting the existing good V1 sheets.
