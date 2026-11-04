# Tactical contact prototype

This is a pure rules experiment, not a playable mode or a change to the current first-person and combat-camera contracts. It establishes a deterministic boundary for a later implementation; no current save or UI uses it.

A scenario supplies a rectangular grid, blocked cells, one to six officers, hostiles, their positive health and facing, and an integer contact radius. Each submitted move belongs to one officer and contains an explicit sequence of orthogonally adjacent cells. The complete route is validated before execution, including the part after a possible contact. Walls, living units and map boundaries block movement. Each step is recorded; there is no AP cost in this free-movement prototype.

After each step, every officer/hostile pair at or inside the Manhattan radius is reported in stable ID order. Contact also occurs immediately if the starting deployment is already within that radius. Contact stops the route at the triggering cell, retains every unit's exact position, health and facing, and enters the `combat` phase. Later movement commands are rejected. The rules do not yet assign initiative, combat budgets, a retreat or a return to free movement. No action is silently performed at contact.

The contact rule is intentionally a simple proximity trigger: it ignores walls, facing, line of sight and hearing. It must not be presented as stealth or guard perception. Enemy movement, group orders, asynchronous cancellation and tactical-to-first-person handoff are future work. A move command resolves synchronously, so reissuing an order means submitting another command after the previous one has finished; there is no queued route to cancel.

`replayTacticalContact(scenario, commands)` reconstructs version 1 state and events from authored scenario data and validated commands. Consumers must persist the scenario identity/version and original command list, not trust serialized derived state. The caller owns save storage and migration. An interrupted route remains in its original command; replay deterministically stops at the same contact cell. No migration of existing saves is included.
