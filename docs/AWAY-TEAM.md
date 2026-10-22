# Away team — first genuine surface interaction

This slice introduces a fixed three-officer away team selected **aboard the bridge**, independently of their station assignments. The default squad comprises scientist Nara Venn, tactical officer Kael Dorn and doctor Isa Mira. All six rostered officers can be selected, but duplicates are forbidden and selection cannot be changed after transport.

At the planetary probe, the team must physically stand adjacent and face it. The best scientific skill among the *selected* officers is checked against a threshold of 3. On success, the domain records a persistent discovery (`probe-mineral-signature`) exactly once. On failure, it reports insufficient scientific expertise without manufacturing evidence. This first sample does **not** award crew XP or alter shipboard science statistics, since those are derived from the separate crew/mission command-replay history; integrating campaign consequences requires a properly unified save contract.

The offline away-team snapshot has a strict version/schema and corruption fallback. It is not tamper proof, and location, squad and mission are currently separate storage keys. In a later slice, consolidate them into one campaign transaction.

Not yet included: enemies, tactical turn-based combat, visible three-character 3D models, medical hazards or meaningful sidequests. These remain on exploration epic #8.
