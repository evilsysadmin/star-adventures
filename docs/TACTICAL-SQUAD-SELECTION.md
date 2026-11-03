# Squad selection for future tactical free movement

This specifies an interaction and a pure selection helper; it is not yet a playable UI. The existing combat board and first-person exploration remain unchanged.

- Clicking a visible officer selects that officer; clicking empty ground clears the selection. Shift-click toggles an officer in the current selection.
- Dragging beyond eight CSS pixels draws a selection rectangle. Releasing selects the visible officer centers inside it, including its edges; Shift-drag adds them. The rectangle works in every drag direction. A drag never issues a movement order or selects a tile.
- Only the player's visible officers are eligible. Projection and visibility belong to the view; the selection rules consume screen-space centers in the same coordinate system as the pointer. Pointer cancellation discards the gesture.
- Touch and keyboard must have equivalent roster controls for individual and additive selection, with selected state announced. Touch scrolling must not accidentally create a selection rectangle. These controls and browser tests are required before the interaction is shipped.
- Selection changes do not move units. Group destination, formation, collision handling, detection during movement, and partial completion must be specified and tested separately before accepting group movement orders. No free action or teleport is implied.

`src/tacticalSelection.mjs` implements only selection calculation and the drag threshold. It has no DOM, rendering, input-event, save or gameplay authority. It does not connect to a view and cannot itself provide keyboard, touch, cancellation or visibility guarantees.
