# Spatial exploration — bridge + away team (decision)

**Product intent:** the bridge is a walkable first-person location, not a permanent dashboard. Away-team missions also use first-person Chronicles/MM3-style movement and interaction. Sharing the navigation and map-validation **rules** does not mean sharing camera/art or combat presentation.

## Engines and boundaries

1. Pure spatial simulation (`src/spatial.mjs` + versioned authored maps): heading, forward/back, turning, collision, interactables, transition prompt/confirm/decline.
2. Bridge interior scene renderer (React + future physically reviewed premium Three.js): visible officers, stations and main viewer. Using consoles opens a **real context** rather than pretending to run mission actions.
3. Away-team scene renderer: first-person team exploration; later tactical ground encounters pause world movement and resolve initiative/turns through distinct ground combat rules.
4. Space operations engine: comms, sensors, helm and space combat with damageable subsystems. It owns space operations but is not the camera or renderer.
5. Campaign domain: persistent crew/squad, flags, quests, relations and save/replay contract shared across all scene types.

## Current step implemented (PR #9)

A **rules-only** first iteration: two authored scene maps, safe movement, facing interactables, explicit transporter offer. Cancelling transport leaves the captain at the same tile; pressing Use offers it again. No characters, 3D geometry, renderer or scene-switching UI are claimed.

The first interactive bridge viewport PR will integrate this pure engine with a *real* rendered first-person view. A transition into an away scene must not be advertised as playable until that renderer exists. Do **not** graft exploratory location state into the existing crew v2 save without a versioned tested migration.

## Controls (planned UI)

Arrow up/down or W/S forward/back, left/right or A/D turn, E/Enter interact. Mobile on-screen movement controls and accessible names. While transition confirmation is open, movement is paused; decline does not move. Existing 1–3 choices remain for contextual console commands, not when free walking.

## Quality gates

- Actions are accepted only at adjacent, faced objects; no remote interactions.
- A real station returns a grounded action ID and **does not** automatically update mission resources.
- Visual PR stays draft until actual 360/390/430/1280 captures including console and transporter prompt are inspected; no merge solely because CI is green.
- Authored maps are small and coherent; don't build huge empty floors or procedural galaxies in the first slice.
- `shadowops-infra` alone owns eventual deployment; existing React dashboard is the functional rollback while 3D interaction is being built.
