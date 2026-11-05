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
