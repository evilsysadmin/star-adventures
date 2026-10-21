# Product contract

## Vision
Captain your own exploration vessel with a persistent ensemble cast. Explore unusual worlds, command stations and engineering teams, investigate anomalies, negotiate with factions and only fight when necessary. Tactical decisions and relationship changes persist between missions.

Inspired by the ethical exploration and crew dynamics of Star Trek: The Next Generation. This **public** repo's initial sample is entirely original; any private fan adaptation should remain separate until repository visibility and licensing are reviewed.

## Design pillars
1. **Choices have consequences.** Every mechanical choice produces an auditable domain event and changed state; descriptive choices are explicitly labelled.
2. **Nonviolent wins.** Diplomacy and scientific investigation must complete core missions without mandatory combat.
3. **A crew, not a collection of icons.** Skills, injuries, friendships and performance will matter across episodes.
4. **Readable tactical depth.** Command, sensors, engineering and away missions each offer interesting trade-offs; do not start with ten indistinguishable resource bars.
5. **Finite content first.** Ship one replayable episode before adding procedural sectors.

## Vertical slice target (not yet implemented)
- 20–40 minute episode: *Echoes at the Boundary*.
- 1 captain's vessel, 6 named officers, 1 disputed sector, 3 meaningful faction attitudes.
- Explore a distress signal, inspect evidence and a disabled craft; choose science, parley or tactical intervention.
- 1 small side objective; at least 3 independently achievable endings.
- A saved game survives refresh and schema changes.
- Contextual crew remarks tied to actual events, not invented past actions.

## Out of scope until that slice works
Multiplayer, giant galaxy generation, live economy, elaborate starship 3D, hosted authentication, production deploy, AI-generated quest scripts and microservices.

## The current foundation
The example episode contains verified branching nodes and measurable science, diplomacy and ship-damage state. This is a **rules proof**, not a playable UI or a full campaign.
