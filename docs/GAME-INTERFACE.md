# Fullscreen bridge and game menu

New players enter the bridge from the captain’s seat, facing the forward
viewscreen. The camera uses the authored command-chair position and a seated
eye height. Bridge arrow/WASD input does not move the captain. The command panel
selects Science, Communications, Tactical, Helm or Command; it opens the journal
with that station’s actual available orders. Crew skill, XP, damage and episode
consequences still use the existing pure engine. `src/captainOrders.mjs` explicitly
authorizes seated orders only aboard the bridge with no transport pending; it
does not fabricate a walk or change saved spatial coordinates.

**Desembarcar** offers the authored surface transport, with explicit confirmation
or cancellation. Surface movement remains first person. Returning to the bridge
restores the seated presentation. The optional **Exploración del puente y diario**
layout retains physical console authorization and grid movement for diagnostics
and existing exploration saves. Saves retain their current schema.

## Menu and return contract

**Menú** or Escape opens a native modal dialog. Exploration buttons and keyboard
movement/console shortcuts pause. The browser makes background content inert and
traps focus in the dialog; closing it restores focus. Escape first closes a journal
or submenu. An unconfirmed transporter retains its existing Escape-to-decline.

- **Volver al juego** resumes the same mounted session.
- **Opciones** controls the actual navigation guide, selects fullscreen game or
  the optional bridge-and-journal interface, and requests native browser fullscreen
  from a real user click. An unsupported or rejected fullscreen request is reported.
- **Audio** controls master effects volume and mute, with a preview using the same
  original synthesized effects as an accepted tactical shot. Muted/zero-volume
  fire remains a valid domain command and schedules no sound. No music is advertised.
- **Salir al menú principal** opens a title menu with **Continuar partida**, and
  leaves native browser fullscreen if active. It does not reset, reload or close
  the game. Continuing retains bridge position, crew and mission state. Gameplay
  save/recovery contracts remain owned by the existing session adapters.

The interface pauses command input; a previously accepted tactical command may
finish its visual playback. Tactical simulation remains turn-based. No new timer
or background encounter is introduced.

## Preferences

`shadowops.star-adventures.presentation.v1` holds a separate bounded version-1
record: layout (`game` or `journal`), hints, mute and volume (0–1). Missing,
corrupt, unsupported or oversized preferences fall back to the full game.
Readback verifies option writes. Denied/discarded writes remain session-only and
are reported in the menu; preferences never overwrite a campaign save. The audio
controller also retains live settings when storage is denied.

The browser diagnostics fixture explicitly selects the real `journal` option and
its existing tactical preference. This preserves dedicated comparison/legacy QA.
New default-game tests use empty storage and exercise the fullscreen interface.

## Tactical POC

**Combate táctico · POC** opens the existing playable mission board as a separate
view, with Fire, turn orders and its existing checkpoints. **Volver a explorar**
returns to the same bridge/surface position. Entering this independent proof does
not resolve the rescue or claim a perimeter result. It does not change the stored
legacy diagnostics-view preference.

In the fullscreen interface, contact selectors and Fire/End-turn controls occupy
HTML rows outside the canvas. They cannot intercept tile centers. Picking still
uses the canonical camera and actual canvas rectangle. The canvas reports ready
only after listeners are attached and its first resize/sync/render completes.

`gameShell.spec.ts` checks all 100 projected cell centers on the actual POC at
360/390/430/1280px, return to the original bridge and unchanged rescue history.
It also exercises pause/input isolation, options/F5, title-menu return, real Web
Audio scheduling/volume, a muted legal damaging shot, and native fullscreen via
an actual click. `bridgeArchitecture.spec.ts` covers physical station access,
responsive rendering and WebGL denial/loss in the optional walking interface.

Runtime captures of desktop and mobile must be inspected before this visual PR
is ready; the exact final head must pass CI. This interface adds no sector,
backend, licensed media or deployment.

## Seated-command validation (local, 2026-10-29)

- Pure captain authorization: science ending with crew XP, unchanged position,
  invalid station/area rejection and transport confirm/decline pass. Core suite passes.
- Full captain rescue journeys pass at 390/1280px: evacuation, return to the seated
  bridge, F5 recovery and the actual public evacuation incident in the log.
- Chrome seated journeys pass at 390/1280px: initial render, scientific peaceful
  ending, no walking controls, transport cancellation and surface entry.
- All 100 cell centers pass at 360/390/430/1280px, with unchanged rescue history and
  return to the same bridge. Pointer-down now focuses the keyboard board with
  `preventScroll`; native focus must not move the grid between down/up.
- Menu/options/F5/title return at 390/1280px, native fullscreen and real audio/muted
  damaging-shot journeys pass. TypeScript/Vite production build passes.
- Actual captures inspected: `/tmp/bridge-v2-preview-1280.png` and
  `/tmp/bridge-v2-preview-390.png` (local review artifacts, not committed media).
- These are local results, not CI or hardware performance claims. The PR remains
  Draft pending the remaining regression suite and exact-head CI verification.

## Scientific debrief from command

A real surface probe discovery can be shared with the first officer by selecting
**Mando** in the seated bridge and opening the orders archive. Science selection,
being on the bridge alone, a pending transport or a fabricated discovery do not
permit that briefing. Walking mode retains the physical chair requirement.
Both modes append the same single `inform` action to the versioned mandate save;
F5 must preserve officer knowledge without repeating the action. The engine uses
an explicit `walking`/`seated` command mode and never fabricates spatial movement.
