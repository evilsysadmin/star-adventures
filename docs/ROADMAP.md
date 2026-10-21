# Delivery roadmap — PR by PR

Status below is a **plan**, not a claim of implemented features.

1. **Repository contract + deterministic episode foundation**: documentation, simple engine, episode data, Node tests and CI. Acceptance: three distinct outcomes reachable; invalid data rejected; public repo safe from third-party asset uploads.
2. **UI shell**: accessible React/TypeScript bridge and compact command interface. Acceptance: entire example episode playable by keyboard/mouse/touch; tested at 360/390/430 px, no horizontal overflow.
3. **Save/resume**: versioned local snapshots, validated migration, corruption recovery. Acceptance: refresh at any decision preserves progress; repeatable recovery test.
4. **Crew and skills**: named persistent officers, roles, skill checks and actionable consequences. Acceptance: different officer assignments produce different outcomes from the same scenario.
5. **Space operations**: navigation, scanning, energy distribution and damageable subsystems. Acceptance: same encounter can conclude through research, retreat, negotiation or battle.
6. **Ground missions**: small tactical away team with cover, hazards and turn order.
7. **Faction reputation and sidequests**: choices affect later dialogue and encounters; one sidequest has an observable campaign effect.
8. **Random encounters**: seed-based generation without replacing handcrafted narrative.
9. **Audiovisual polish**: diegetic bridge, crew portraits and measured graphics budgets; validated physical screenshots.
10. **Backend decision**: add Go API only for confirmed account, multiplayer or server-owned save requirements.
11. **Staging adoption**: a separate PR in shadowops-infra, with immutable artifacts, health checks and rollback, once the app contract is proven.

Each PR must link to its test evidence. Infrastructure modifications must never be smuggled into application PRs.
