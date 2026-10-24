# Star Adventures — dual mandate / Section 31 narrative direction

**Status:** approved creative direction, **not yet implemented**. This describes a *private Star Trek fan-prototype* and is not a claim of official affiliation or rights to distribute the franchise's content. The source repository is public: don't commit unlicensed artwork, models, scripts or copied game assets. Keep all faction/universe data external to the reusable rules engine so it can be replaced if publication becomes a goal.

## The hook: the Meridian has two captains' logs

The player commands the USS Meridian, a publicly ordinary Starfleet exploration/assistance ship. It has real orders, a real duty of care, a visible logbook and Starfleet personnel with beliefs and careers.

Secretly, **the captain is an asset of Section 31** and receives clandestine directives hidden behind legitimate assignments. The vessel's designation, ordinary mission schedule and public reports serve as cover, not an excuse for fake gameplay.

This is not a publicly declared Section 31 warship. The secret chain of command is compartmentalized: initially only the captain and one designated contact know the whole truth; some officers may suspect anomalies or be selectively read in. Crew reactions must be grounded in what each person could actually have learned.

**Core dramatic question:** *What would you sacrifice to protect the Federation — and when does protecting it mean refusing an order?*

## Two simultaneous, consequential mission tracks

| Open orders — the Starfleet cover | Hidden orders — Section 31 |
| --- | --- |
| Answer distress calls, survey worlds, perform diplomacy, resolve disputes, protect civilian life, deliver medical or engineering aid | Recover sensitive intelligence, investigate compromise inside the Federation, infiltrate factions, conduct deniable surveillance, conceal an operation or expose a corrupt handler |
| Public reports, crew duty and service record matter | Operational secrecy, evidence trails, leaks and the handler's trust matter |
| Can be completed with science/diplomacy/engineering rather than combat | Offers discretion, stealth, negotiation, science, sacrifice or refusal; **not automatically mandatory violence** |
| Legitimate work can materially help civilians and allies | Covert decisions can compromise an otherwise successful public mission, and vice versa |

The two tracks are **coupled**. A civilian rescued during a normal assignment might later become a valuable witness; using their trust for an operation can destroy the relationship and expose the cover. Routine scientific work can yield evidence for a covert investigation. Classified directives may arrive during a legitimate crisis, creating time, risk and resource conflicts.

## Consequences — not a simplistic 'good/evil meter'

Suggested tracked campaign concepts (design proposals, not shipped schema):

- **Public standing:** credibility of the ship's official reports, fleet readiness and Starfleet confidence.
- **Cover exposure:** *grounded suspicion and evidence* held by named factions/officers, not an omniscient global stealth bar. Distinguish a rumor from a provable leak.
- **Crew trust and compartmentalization:** who knows what, who doubts the captain, what they personally witnessed, and whether they are willing to act.
- **Federation ideals and actual harm:** civilians protected/harmed, promises kept/broken, collateral damage and people abandoned; maintain concrete incident history rather than one scalar morality score.
- **Section 31 pressure:** a handler can threaten the captain's cover, withdraw support or feed unreliable information. The handler is not necessarily truthful or the ultimate moral authority.
- **Faction memory:** diplomatic ties, favors, evidence and betrayals persist across both tracks.

Consequences must originate from observable decisions/events, be saveable and replayable, and alter later gameplay. Never fabricate crew knowledge or incident history.

## Example first full episode: 'Signals Under Orders' (working title)

1. **Open briefing:** Meridian is sent to evacuate a damaged research outpost. This is a real relief mission with civilians, medical pressure and a possible peaceful resolution.
2. **Secret briefing:** an encrypted Section 31 message orders retrieval of an outpost sensor core before a Starfleet investigator gets it; its contents may implicate Federation officials.
3. **Spatial play:** walk the bridge in first person; use appropriate helm, comms and science stations. Choose an actual three-person away team and explore the outpost in first person (Chronicles-style).
4. **Conflicting decisions:** prioritize evacuees or evidence, inform a skeptical officer or keep them uninformed, falsify/withhold a report or reveal uncomfortable facts. Give truthful, risky nonviolent alternatives; tactical encounters happen only when the situation warrants them.
5. **Multiple endings:** rescue completed but cover compromised; covert objective met but crew trust damaged; evidence exposed to lawful scrutiny despite a Section 31 threat; partial evacuation with long-term consequences. Each ending must be reachable and materially distinct.

The already shipped 'Border Signal' tutorial remains a valid mechanics/rollback fixture; don't overwrite existing saves or pretend it already contains this campaign.

## Presentation and game architecture

- Exploration of ship and away team stays first-person. Ground encounters pause exploration into an independently tested elevated tactical mode; **Codex CLI owns the camera/picking POC**. Do not change it in this narrative slice.
- Official orders appear through ship command briefings and the captain's regular log. Covert contact is diegetic: encrypted transmission, secure briefing terminal or a trusted intermediary, never a giant permanent 'EVIL MISSIONS' dashboard.
- After an episode, show **two compatible records**: the sanitized public service report and the captain's true classified log; both derive from the same events but expose different information.
- The narrative layer is declarative content and campaign rules separate from renderer, deterministic episode engine, crew and save schema. Use explicit migrations and browser tests when implementing consequences.
- Starting rollout: one fully replayable dual-track episode, then expand. No giant procedural galaxy or always-on backends until there's a real reason.

## First implemented domain foundation (PR #39)

The generic `src/dualMandate.mjs` module and `tests/dualMandate.test.mjs` establish **real, replay-validated events** for official and covert orders. They track witnesses and intentional information transfers, accept refusal grounded in an incident, and derive public and classified reports from **one** chronological record. A covert order never appears in the public orders list; deliberate publication of evidence strips its covert order association.

This is a domain-only capability, not yet a mission UI, a full episode, a server security/authorization system or a final morality mechanic. The local player's classified report is in-universe fiction, not secrecy against someone inspecting browser storage. It uses a separate version-1 replay checkpoint, leaving crew v2, spatial and away-team persistence untouched.

Next steps require contextual bridge briefings, actual choices bound to the current crew and a complete authored mission with meaningful outcomes. Do not claim that public/secret roles have gameplay consequences until those integrations are tested.

## First real physical-action bridge (PR #41)

The separate captain's archive now records the **real scientific finding** already obtainable by the away team when the player travels physically to the surface, faces the probe and successfully passes its skill check. The event is reconciled into a third **official scientific survey** order with the actual reporting officer as the named witness, and it survives F5 via replay-only checkpointing. Failed investigations earn no credit. Repeated events and a story-lab reset cannot mint or erase the verified achievement.

This does **not** imply that the evacuation or covert-core retrieval has a real 3D interaction yet. Those still belong to the explicitly labelled narrative simulation. Do not silently map the generic probe finding onto a nonexistent civilian rescue or an extracted sensor core. The new reconciliation module remains pure, with no React, Three.js or network imports.

## Next narrative PRs (separate from the tactical camera POC)

1. [ ] Domain contracts and event tests for official orders, hidden directives, scoped knowledge and incident consequences. No UI.
2. [ ] Dual briefing + two logbooks implemented with progressive disclosure on the current React bridge. No real 'top secret' content in frontend assets: classified is **in-universe fiction**, not security against the player.
3. [ ] One original fully playable dual-track episode reusing the existing exploration/crew/saving contracts; migration + reload/branch outcome tests.
4. [ ] Character-specific suspicion, trust and debrief consequences driven by incidents.
5. [ ] Expand only after the first full episode works and has undergone real browser QA.

## Deployment boundary

- Game source stays in `evilsysadmin/star-adventures`; **all** DNS, environments, routing and deploys in `evilsysadmin/shadowops-infra`, only after explicit adoption.
- **Staging first** (proposed `staging.staradvs.shadowops.dpdns.org`), then separately approved production (`staradvs.shadowops.dpdns.org`). Neither hostname nor deployment is yet confirmed to be operational.
- See the corresponding infrastructure-onboarding issue for scoped environment isolation, route ownership, SHA/digest promotion and rollback requirements.
