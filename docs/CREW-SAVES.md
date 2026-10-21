# Crew checkpoint v2

This release adds a **domain API** for crew persistence, but intentionally does not switch React storage yet.

- `startCrewSession(episode)`: initializes a crew and a campaign episode.
- `applyCrewAction(episode, session, action)`: accepts `assign`, `order`, `restart` and migration-only `legacy-order`.
- `serializeCrewCheckpoint` stores **only** version, episode ID and bounded actions. Load is deterministic replay; stored XP/stats are never trusted.
- `migrateLegacyCheckpoint(episode, oldRaw)`: imports a validated v1 decision log as `legacy-order` actions without changing the original outcome or inventing retroactive XP/skills. Future `order` actions use crew rules.
- `restart` starts a new mission while retaining acquired XP and station assignments.

No third-party lore/assets, no backend, no network calls and no changes to frontend UI or v1 storage in this PR.

**Next PR** must wire v2 persistence to React with correct migration precedence: v2 if valid, otherwise first v1 migration only when no v2 exists; corrupt v2 should safely reset instead of accidentally reverting an older v1 snapshot. Include real F5 migration/restore tests, station reassignments and actual UI screenshot inspection before merging.
