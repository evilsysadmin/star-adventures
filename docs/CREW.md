# Crew rules — first deterministic slice

This first iteration establishes **mechanics**, not the final character interface or persistence.

- Six fictional officers have stable IDs, names, ranks and separate skills at six stations: command, science, diplomacy, tactical, engineering and medicine.
- Every station has exactly one occupant. Assigning an officer to a different station swaps both occupants; duplicate assignments are forbidden.
- Mission orders route to the assigned station. Ordinary science/diplomacy orders benefit from a skilled officer; tactical competence reduces received damage. All bonuses appear in the domain event log.
- A pivotal science broadcast, diplomatic mediation or tactical engine-disable order requires skill **3** or higher. A weaker officer fails, and the mission resolves as withdrawal rather than the planned peaceful/tactical success. These outcomes are **not random**.
- Acting awards 25 XP, plus 25 XP for passing a pivotal skill check; level = min(5, 1 + floor(XP / 100)). Every second promotion improves a station skill by one, capped at five.
- Event log records officer ID, station, effective skill and check result; the caller can present grounded crew commentary without inventing actions.

## Explicit limits

- The current React application still uses the original episode reducer; it **does not yet invoke** these crew rules. This PR intentionally avoids touching UI and save format.
- The next PR must integrate selection and a **versioned save/replay migration** before the user can benefit from crew XP across reloads. Never serialize a modified crew episode through legacy save v1: legacy save rejects modified stats/log, correctly.
- Shipboard engineering and medicine currently exist as roster/station capabilities, not mission choices. They need dedicated mission content before we claim tactical value.
- The opening scenario is a two-step rules test, not a real 20–40-minute campaign.

## Code

- `src/crew.mjs`: original roster, state factory, validation, assignment and mission-order resolution. Depends solely on `src/episode.mjs`.
- `tests/crew.test.mjs`: station uniqueness, nonmutation, skilled/weak branch outcomes, damage, XP/level boundaries and invalid-input rejection.

All crew IDs and rules stay independent of any licensed sci-fi franchise.
