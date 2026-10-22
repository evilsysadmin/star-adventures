# Product contract

## Vision
**Two missions. One starship. One increasingly compromised captain.**

Command the USS Meridian, publicly an ordinary Starfleet exploration and relief vessel but secretly operating under a compartmentalized Section 31 directive. Fulfill *real, meaningful* official missions while investigating deniable objectives for a clandestine handler. The captain can question or refuse orders; alliances, evidence, civilian lives, secrecy and trust can matter more than winning a firefight.

Explore the bridge and planetary surface in first person, assign persistent crew members, investigate, negotiate and fight only when necessary. Public reports and classified debriefs must reflect the same actual campaign history. See [Dual Mandate](DUAL-MANDATE.md) for campaign design; this is a planned pivot, not a shipped feature.

Inspired by the ethical exploration and crew dynamics of Star Trek: The Next Generation. This **public** repo's initial sample is entirely original; any private fan adaptation should remain separate until repository visibility and licensing are reviewed.

## New campaign identity (planned)
- Legitimate Starfleet orders are complete, consequential missions — not filler or fake buttons masking espionage.
- Section 31 is secret; the captain's **cover ship** is not openly branded as a Section 31 vessel.
- Named officers have differing knowledge, loyalties and reactions. Avoid a simplistic numerical morality meter.
- Official and clandestine choices affect each other, creating decisions with no painless universal answer.
- Initially prototype the franchise premise privately; the **public repository** remains free of third-party franchise assets, dialogue and models.

## Design pillars
1. **Choices have consequences.** Every mechanical choice produces an auditable domain event and changed state; descriptive choices are explicitly labelled.
2. **Nonviolent wins.** Diplomacy and scientific investigation must complete core missions without mandatory combat.
3. **A crew, not a collection of icons.** Skills, injuries, friendships and performance will matter across episodes.
4. **Readable tactical depth.** Command, sensors, engineering and away missions each offer interesting trade-offs; do not start with ten indistinguishable resource bars.
5. **Finite content first.** Ship one replayable episode before adding procedural sectors.

## Vertical slice target (not yet implemented)
- 20–40 minute first **dual-track** episode: *Signals Under Orders* (working title): rescue outpost evacuees under legitimate orders while an encrypted handler pressures the captain to recover a sensitive sensor core.
- Preserve *Echoes at the Boundary* / Border Signal as the earlier rules fixture and rollback; do not silently rewrite existing saves.
- 1 captain's vessel, 6 named officers, 1 disputed sector, 3 meaningful faction attitudes.
- Explore a distress signal, inspect evidence and a disabled craft; choose science, parley or tactical intervention.
- 1 small side objective; at least 3 independently achievable endings.
- A saved game survives refresh and schema changes.
- Contextual crew remarks tied to actual events, not invented past actions.

## Out of scope until that slice works
Multiplayer, giant galaxy generation, live economy, elaborate starship 3D, hosted authentication, production deploy, AI-generated quest scripts and microservices.

## The current foundation
The example episode contains verified branching nodes and measurable science, diplomacy and ship-damage state. This is a **rules proof**, not a playable UI or a full campaign.
