# Delivery roadmap — PR by PR

Status below is a **plan**, not a claim of implemented features.

## Immediate priority — tactical camera, then canonical officer (2026-10-22)

**Baseline when this plan was agreed:** `main` at `3cb4449` (PR #17, tactical-camera skill/gates). No tactical-camera implementation had landed after that commit. The active implementation work is being carried out separately in the Codex CLI session; this entry is **roadmap only**.

### Next PR: tactical camera and deterministic picking — [#18](https://github.com/evilsysadmin/star-adventures/issues/18)

- Build a minimal **Three.js 8×8 tactical board** with a fixed `OrthographicCamera` and stable tile IDs. Ground/away exploration remains first-person, Chronicles-style; the elevated view is for turn-based combat only.
- Prove that actual raycast pointer selection returns the correct tile for **64/64 cell centers** at mobile and desktop widths (360, 390, 430 and 1280 px). Also validate canvas offsets, resizing, device-pixel ratios, touch and a keyboard-accessible alternative.
- Keep simulation coordinates independent of graphics. Do not add combat units, polished art, camera orbit/free rotation or effects until the picking gate passes.
- Follow `.agents/skills/tactical-camera/SKILL.md` and `docs/TACTICAL-CAMERA-GATE.md`; Playwright/browser evidence and reviewed captures are required before merge.
- **Acceptance:** deterministic zero-mismatch tile picking, no clipped board or horizontal overflow, and a green CI on the PR head. A pretty screenshot without correct click-to-cell behavior is not sufficient.

### Local *Star Trek: Away Team* research — [#19](https://github.com/evilsysadmin/star-adventures/issues/19)

Findings reported from the **local game resources** (not a REA binary-analysis run):

- Character resources include **`.mdl16` 3D models** for bodies, heads and characters: `Federation Generic Body`, `Generic Male/Female Body`, Data, Worf, Klingons and Romulans. Portraits and icons use **`.frm16`**.
- This points to **3D character models rendered through a DirectDraw-era pipeline**, *not* a character system of pre-rendered 2D sprite atlases to imitate. Do not confuse historically pre-rendered environments with pre-rendered *characters*.
- Resources are packaged in `DATA.dat`: an archive with ZIP-like structures and slightly altered headers, already enumerable using **7-Zip**. Next investigation can focus on model format/structure and local behavior files **without running the game**.
- **REA is not needed yet.** Consider deeper reverse engineering only if ordinary read-only inspection cannot answer a concrete technical question. Never import original proprietary models, portraits or game assets into this public repository.

### Following PR: one original canonical Starfleet officer

- Once the tactical board/camera is proven, create **one original, readable low-complexity 3D officer model**, aligned to the camera's scale, stance, facing, tile center, lighting and occlusion. Use portraits separately for dialogues.
- Verify it **inside the real tactical scene**, across mobile and desktop, with reliable facing, animation, footing, picking and depth order. Keep visual fidelity consistent with the game, not the limitations of a 2001 renderer.
- Expand to the three-officer away squad only when the canonical officer passes its visual and interaction gates. The combat turn engine/encounters then advance in additional focused PRs.
- Do not build a sprite-atlas pipeline by default; the local *Away Team* findings favor testing simple 3D models first.

**Sequence:** 64/64 tactical picking → one canonical original 3D officer → three consistent officers → actual turn-based encounter. Keep implementation PR-by-PR in the Codex CLI session. No changes to `shadowops-infra` or deployment are part of this roadmap update.

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
