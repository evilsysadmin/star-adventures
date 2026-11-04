# Spatial exploration — first-person bridge, isometric away team (updated 2026-11-04)

**Product intent:** the bridge remains a walkable first-person location, not a permanent dashboard. After beam-down, the player sees their **three actual deployed officers on a fixed elevated/isometric map**, selects one or more with the pointer and orders them around the surface. This supersedes the earlier first-person away-team decision; see [issue #202](https://github.com/evilsysadmin/star-adventures/issues/202). The existing first-person surface implementation stays available as a safe rollback until the new experience passes tests and visual review. Share pure navigation and map-validation **rules**, not camera or rendering ownership.

## Engines and boundaries

1. Pure spatial simulation (`src/spatial.mjs` + versioned authored maps): heading, forward/back, turning, collision, interactables, transition prompt/confirm/decline.
2. Bridge interior scene renderer (React + future physically reviewed premium Three.js): visible officers, stations and main viewer. Using consoles opens a **real context** rather than pretending to run mission actions.
3. Away-team scene renderer: fixed elevated/isometric terrain with three visible officers, individual and additive/group selection, path orders, formation and contextual interactions. Exploration is not turn based; hostile contact pauses it and activates the distinct turn-based ground-combat rules. The tactical camera may be reused but the mode/rules are explicit.
4. Space operations engine: comms, sensors, helm and space combat with damageable subsystems. It owns space operations but is not the camera or renderer.
5. Campaign domain: persistent crew/squad, flags, quests, relations and save/replay contract shared across all scene types.

## Current step implemented (PR #9)

A **rules-only** first iteration: two authored scene maps, safe movement, facing interactables, explicit transporter offer. Cancelling transport leaves the captain at the same tile; pressing Use offers it again. No characters, 3D geometry, renderer or scene-switching UI are claimed.

The first interactive bridge viewport PR will integrate this pure engine with a *real* rendered first-person view. A transition into an away scene must not be advertised as playable until that renderer exists. Do **not** graft exploratory location state into the existing crew v2 save without a versioned tested migration.

## Controls (planned UI)

**Bridge:** arrow up/down or W/S forward/back, left/right or A/D turn, E/Enter interact. **Planet:** left-click officer to select, Shift+click additive, drag a selection marquee; right-click accessible ground to move the selection, with deterministic routes, obstacles and non-overlapping formation. Target/role interactions require a real nearby officer. Touch and keyboard must offer equivalent selection and movement without requiring a right button. While transition confirmation is open, movement is paused; decline does not move. Existing 1–3 choices remain for contextual console commands, not when freely exploring.

## Quality gates

- Actions are accepted only at adjacent, faced objects; no remote interactions.
- A real station returns a grounded action ID and **does not** automatically update mission resources.
- Surface actors and selectable terrain must share stable canonical cell IDs; selection alone never issues a move.
- Test squad selection, individual/group movement, obstacles, touch and keyboard on real canvas at 360/390/430/1280 px. A camera swap without real officer control is insufficient.
- Preserve historic spatial, away-team and campaign snapshots through explicit migrations or a tested rollback; complete beam-down → mission → extraction → bridge and F5 journeys before replacing the playable surface.
- Visual PR stays draft until actual 360/390/430/1280 captures including console and transporter prompt are inspected; no merge solely because CI is green.
- Authored maps are small and coherent; don't build huge empty floors or procedural galaxies in the first slice.
- `shadowops-infra` alone owns eventual deployment; existing React dashboard is the functional rollback while 3D interaction is being built.
