# Bridge consoles as gameplay authority

Mission commands may only be executed while the captain is physically facing a compatible station in the walkable **bridge** map. The pure domain facade `src/consoleOrders.mjs` exposes `facedConsole`, `availableConsoleOrders` and `issueConsoleOrder`, which enforce this independently of React. Crew XP and outcomes continue using `applyCrewAction` and its deterministic replay log.

| Station | Orders |
| --- | --- |
| Science | scan, broadcast |
| Communications | hail, mediate |
| Tactical | intercept, disable |
| Helm | withdraw, disengage |
| Captain's chair | ultimatum |

The surface probe is **not** a mission console; it is exploratory content pending a proper science/away-team mechanic. No synthetic outcomes.

Next UI slice: a station-specific orders window that closes on movement, a compact status panel when away from a console, and removal of omnipresent numbered orders. Transporter confirmation freezes console interaction. The existing saved crew actions retain their meaning and can replay; scene position persistence comes later through an explicit migration, not by sneaking position into v2 mission checkpoints.

No shared runtime imports from Chronicles. Infrastructure remains in shadowops-infra.
