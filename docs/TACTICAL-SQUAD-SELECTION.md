# Squad selection and formation movement — experimental surface view

The selection rules are now connected to the real elevated planetary surface. The classic first-person exploration remains available for mission interactions and recovery; the elevated squad view still does **not** complete mission interactions or enter tactical combat.

- Clicking a visible officer selects that officer; clicking empty ground clears the selection. Shift-click toggles an officer in the current selection.
- Dragging beyond eight CSS pixels draws a selection rectangle. Releasing selects the visible officer centers inside it, including its edges; Shift-drag adds them. The rectangle works in every drag direction. Once crossed, the drag threshold stays active until release or cancellation, even if the pointer returns to its start. A drag never issues a movement order or selects a tile.
- Only the player's visible officers are eligible; additive selection removes officers that have since become hidden. Projection and visibility belong to the view; the selection rules consume screen-space centers in the same coordinate system as the pointer. Pointer cancellation discards the gesture.
- Touch and keyboard must have equivalent roster controls for individual and additive selection, with selected state announced. Touch scrolling must not accidentally create a selection rectangle. These controls and browser tests are required before the interaction is shipped.
- Selection changes do not move units. An explicit right-click, touch destination command or keyboard grid order is required. A selected subgroup (2–3 officers) can form around a leader cell; the planning pass tests ordinary individual routes against walls, objectives, and other units and commits the complete command journal only when all moves are legal. An impossible formation fails atomically. No free action or teleport is implied. Detection during group movement, encounters, animation and mission actions from this view remain separate work.

`src/tacticalSelection.mjs` implements only selection calculation and the drag threshold. It has no DOM, rendering, input-event, save or gameplay authority. It does not own the view or handle browser input. `src/groundSquadFormation.mjs` coordinates existing `groundSquadPositions.mjs` replayable commands without changing the `ground-squad.v1` save contract. A completed group command updates the sidecar officers only; it never fabricates a change to the first-person spatial/missions checkpoint. Existing undispersed all-squad movement retains the classic spatial route for backwards compatibility.

## First real tactical station interaction: science probe

The elevated surface view may **investigate the authored probe** without returning to the first-person ground camera:

- Select exactly one deployed officer and move to a cardinally adjacent walkable tile around the scientific probe. The accessible **Investigar sonda** control is disabled until these requirements hold.
- `groundStationUse` replays the versioned officer movement journal and derives that officer's actual tile/heading. It then reuses `applyExploration(..., {type: 'use'})` to verify the existing station contract. It never trusts a visual SVG hit, invents a movement step, or overwrites the first-person camera checkpoint.
- `investigateProbe` accepts an optional **explicit acting officer**. Classic first-person use continues choosing the best deployed scientist as before; the elevated view uses the skill of the selected adjacent officer (including genuine undertrained failures). The exact same away-team checkpoint, findings, attempt counter and classified observed-evidence reconciliation persist after F5.
- Mission actions remain tied to the real authored probe and role. The medical station, sensor archive, combat contact and teleporter have not been migrated to elevated interaction in this increment.
- Tests validate stale/invalid officer or station, wrong distance, replay after save, an undertrained tactical officer, successful scientific officer, duplicate prevention and browser F5 at 390/1280.

## Second authored station: medical rescue (elevated view)

The **Puesto de socorro** at `6:4` can be used by a single selected officer standing in a cardinally adjacent walkable cell. The dedicated **Atender civiles** action is gated by the saved operator position, then `groundStationUse` verifies the same canonical `applyExploration(use)` station event used by the classic camera. The selected officer's real medical skill, including level progression, is the sole medical competence checked; the traditional first-person action continues using `bestAwayMedic` unchanged.

An underqualified operator may attempt treatment but cannot write a successful evacuation or public incident. A qualified operator causes precisely the existing `EVACUATION_INCIDENT` record and `evacuate` official-order completion, which survive F5 in the mandate checkpoint; repeating a resolved rescue is rejected. No tactical command changes `spatial.v1`, moves the bridge camera or creates duplicate civilians.

Browser gates: Kael near `5:4` fails with Medicine 1/5; Isa near `6:5` succeeds with Medicine 4/5 and real public evidence, while other officers remain put. Verify duplicate rejection and both tactical/missions checkpoints after F5 at 390/1280. Sensor archive, perimeter combat contact and extraction remain future slices.

## Default planetary camera and classical fallback (2026-11-05)

The canonical planetary landing **opens the elevated, selectable squad board immediately**, rather than the legacy first-person canvas. A saved game reloaded on the surface also starts in the squad view. Bridge navigation stays first person.

The surface header's explicit **«Exploración clásica»** action switches to the legacy first-person camera, including the real movement/use and extraction controls that have not yet been implemented for individual officers. **«Volver al equipo»** returns to the elevated view without relocating or overwriting anyone. This is presentation state, not a new mission action or saved-game migration; normal saved spatial and independent squad journals continue to govern their respective rules. Re-entering the surface from the bridge starts in the elevated view even after a previous classical-camera visit.

The pinned mission transmission must remain **vertical-scroll only** in immersive mode. Its buttons and text wrap within the transmission bounds, including an old abandoned-rescue checkpoint; no horizontal scrollbars on 390/1280 px. Playwright covers arrival, F5, explicit rollback and restored abandonment at 360/390/430/1280 px; existing first-person campaign routes remain tested after deliberately selecting the fallback.

**Not yet complete:** sensor archive, hostile perimeter initiation and extraction still use classical controls. This default-camera change does not claim a fully isometric mission.


## Outpost scenery and walking sprites — incremental visual layer

The default 9×8 planetary landing now draws distinct, authored-location
silhouettes for the science probe, sensor archive, medical relief point,
perimeter uplink and extraction marker. These shapes and the planetary backdrop
are non-pickable SVG decoration. The camera frames the terrain more closely on
desktop; the phone follow/full-map switch and the canonical grid cells remain
unchanged. **This is not yet a larger playable map or a seamless 3D world.**
The independent 12×12 tactical sandbox in PR #196 must not be mistaken for a
replacement for the persistent surface campaign.

Single-officer **accepted** movement orders use the exact path returned by the
existing deterministic ground-position rules to animate the officer's rendered
position tile by tile. The 3×2 six-frame male/female walking WebPs come from
the same content-addressed R2 manifest as the tactical encounter renderer;
the image preload is independent of SVG hit geometry. The crew's saved
coordinates and mission events commit immediately and remain authoritative.
Reloading mid-animation restores the final saved position, never a transient
fractional tile. Reduced-motion users skip the animation. Failed CDN loads
keep the existing idle/vector fallback visible; all selection and movement
controls continue to work.

**Explicit limitations:** individual officer walking is the first slice;
formation and full-squad orders still snap to their canonical result. V1 atlas
art depicts only one authored view (mirroring is not genuine four-direction
art). Genuine directional walking needs vetted four-view sheets; bigger
playable surface maps require a separate save/route/mission migration and
browser gate. Do not claim those features shipped merely because animated
sprites or decorative scenery are visible.
