# Physical perimeter checkpoint v1

The optional encounter at the outpost security uplink belongs to the current
physical rescue. Laboratory combat, training records and extraction ledgers do
not establish its outcome.

## Payload and replay

- Adapter: `frontend/src/perimeterSession.ts`.
- Key: `shadowops.star-adventures.physical-perimeter.v1`.
- Strict envelope: `version: 1`, integer `rescueRun`, boolean `active`, and
  `combat: { version: 4, scenarioId: 'evacuation', actions: [...] }`.
- The nested v4 command replay validates movement, range, cover, AP, enemy turns,
  damage, ceasefire and victory. No stored health, outcome flags or extra keys
  are accepted. The v4 command/byte caps also bound the physical checkpoint.
- `active` restores panel visibility only. It cannot award any achievement.
  The panel reopens only if the validated spatial save is on the surface,
  facing the actual authored security uplink, without a pending transition.

The same replay drives the live board, the surface perimeter message and the
bridge return report. Refresh never creates a new enemy turn, replays hit/shot
presentation, or grants the separate medical evacuation. Leaving the board saves
`active: false`; reopening an unresolved uplink resumes the same encounter.
A resolved perimeter cannot be restarted from the successful result panel; a new
rescue is the explicit way to start again. A failed encounter still offers retry.

## Rescue boundary and compatibility

`rescueRun` is the number of `restart` commands in the validated crew v2 history
(maximum 512). The controller starts a new, empty perimeter when the shared
mission restart button is used. A checkpoint from a different run is ignored,
including when a new-run reset write failed but the crew restart was saved.

The controller restores this slot only after a valid crew v2 restoration. A
fresh, incompatible or legacy-migrated crew campaign starts with an empty field
slot and writes that before its new crew checkpoint. No retroactive physical
result is inferred from a laboratory save or from old, unsaved UI flags.

Read-only restoration preserves corrupt/future field bytes and reports a
recoverable warning. A subsequent physical interaction or explicit mission
restart can replace that slot with new valid progress. Missing, corrupt or
unavailable field storage does not reset crew, spatial, away-team or mandate data.
Writes verify readback; denied, quota-limited or silently discarded writes report
temporary progress instead of claiming a save.

The crew, field, spatial and mandate keys are **not an atomic transaction**. This
is a single-player local checkpoint, not anti-cheat, multi-tab arbitration or
remote authority. A crash between independent writes or selective storage
failure can leave those domains out of sync; a future unified campaign checkpoint
must address that before claiming transactional persistence. The run boundary
protects normal restart/reload journeys, not arbitrary edits to browser storage.

## Verification

- `perimeterSession.test.mjs`: actual command replay, injuries, truce vs victory,
  rejected forged/future payloads, run changes, laboratory isolation, storage
  failures and physical station gating.
- `fieldPerimeterEncounter.spec.ts`: real bridge travel, live orders, refresh
  during contact, pause/resume, negotiated rescue and bridge debrief after F5,
  fresh replay, plus a real firefight whose damage/victory survives refresh.
- Inspect real desktop/mobile captures; retain the existing tactical camera,
  picking, keyboard and encounter checks. No camera or art changes are required.
