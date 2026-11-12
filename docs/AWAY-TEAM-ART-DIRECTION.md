# Planetary Away Team — approved art direction (November 2026)

The user-approved reference is an **isometric, environment-led tactical
away-team game**: extensive lived-in sci-fi colony, realistic mission spaces,
small but distinct moving officers, and a purposeful squad-command interface.
This is a *direction*, not a licensed asset to import or a flat image to put
under the UI. All public-repo art and labels must remain original.

## Experience target

- The **environment** is the hero: believable multi-building research colony,
  industrial plaza, pads, pipes, paved paths, cargo, railings, doorways, lamps,
  terrain boundaries and distant landscape. Facilities must visually correspond
  to real authored objects with accessible actions.
- **Three officers** have persistent identity, actual grid positions, working
  selection/formation/path orders and genuine existing R2 walk frames.
- **Real fog of war:** current sight is limited by terrain/structures; unknown
  areas do not disclose props, hostile occupants or interaction markers;
  explored memory is dimmed and survives F5 from authoritative command replay.
  No global reveal for having opened the full-map camera.
- **Tactical HUD:** compact left-side squad presentation on desktop, radio or
  briefing content anchored to actual mission state, objectives from real
  events and a command strip with only real implemented actions. Never invent
  health, ammunition, item counts, threats or mission progress to match the mock.
- **Legibility:** the map must remain large and the officers selectable. HUD
  components never block cell picking in the tested golden path. On phones,
  use progressive disclosure and a follow camera rather than miniature desktop
  controls. Keyboard/touch/mouse and reduced motion must remain supported.

## Visual language

Original worn metal and masonry, deep graphite/teal shadows, warm amber utility
lighting, restrained cyan screens, tiny red service lights, varied tile
materials, readable silhouettes, and layered environmental depth. Exterior
distance can be scenic. **Game-relevant geometry cannot be cosmetic-only:**
all blocking props must line up with canonical `scene.walls`/`scene.objects`.
Conversely flat decals, cables, wear marks and lights are explicitly passable.

## Implementation boundaries and progression

1. **Delivered separately:** 13×10 canonical playable east sector (PR #213)
   and LOS-based fog with movement-history memory (PR #214).
2. **First environment slice:** authored SVG colony paving, service cabling,
   lit bollards, crates only on blocked tiles, perimeter guard rails and wild
   outskirts. Drawn behind selectable officer sprites and the fog mask; no
   copyrighted art or new binary assets.
3. **Next visual slice:** differentiated archive/habitat architecture,
   science building, medical shelter, extraction landing pad and vertical
   scenery, potentially as separately authored original R2 atlases once the
   source assets have been reviewed. Must be actual game objects, not a
   screenshot of the mock.
4. **Next interaction slice:** desktop crew rail and contextual real-action
   command HUD, with a verified mobile alternative and no fake player stats.
5. **Future:** multi-height bridges, doors/cover, true material atlases, weather,
   dynamic encounters and hostile LOS require explicit domain rules, objective
   handling and tests before they become traversable/interactive.

Do not mistake a prettier grid, a full-screen poster or CSS-only shading for
completion of this target. Review actual Chrome screenshots and click-to-tile
tests at 390 and 1280 px on the exact PR SHA before merging.

## Portrait inspection defaults to the already-mapped western sector

On narrow screens, the previously uncropped whole-map preview shrank the real
away team into a narrow strip. The existing `Examinar mapa` camera control now
opens the real western base sector (the only known region on landing) at an
inspectable scale, while the visible `Todo el mapa` picker option preserves
the precise 18×12 full frame and all fog/picking. This is pure camera framing:
no terrain, objects, mission state, discovery, officer sprites or save schema
change. Desktop continues to open the whole map as before. E2E at 390/430
checks the default sector, explicit full-map escape hatch, touch commands,
fog and F5, plus existing close-follow controls.
