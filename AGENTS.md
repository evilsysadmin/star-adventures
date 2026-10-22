# AGENTS.md — ShadowOps · Star Adventures

This is an independent ShadowOps game. Follow these rules for every repository change.

## Product
- Build one complete playable episode before generating more sectors, ships or lore.
- Exploration, science and diplomacy must be real alternatives to combat.
- Decisions must cause measurable state changes; do not offer false choices.
- Keep the game legible on keyboard, mouse and touch; reveal complexity progressively.

## Ownership
- This repository owns source, game data, tests and build artifacts.
- Infrastructure and deployments belong in evilsysadmin/shadowops-infra **after a verified handoff**. Do not deploy from this repo by shortcut.
- Never import runtime modules directly from Chess Studio or Chronicles.
- The pure narrative/rules engine must have **no imports** from React, Three.js, browser storage, networking, UI or franchise-specific content.

## Copyright / visibility
- This repo currently is **public**. Do not commit licensed Star Trek images, audio, scripts, copied lore, dialogue or proprietary assets.
- We may prototype the setting privately when repository access and rights have been considered. Private/noncommercial use does not itself grant a copyright license.
- Keep rules/engine separate from data so the fictional universe can be replaced before distribution.

## Delivery
- Check the default branch, open PRs and relevant docs first.
- Work in small focused PRs, starting Draft; validate CI for exact head SHA. Never claim merge based on PR opening.
- Nonvisual PRs: enable GitHub native automerge **when supported** and only after checks/branch protection are satisfactory. If repo setting blocks it, report the blocker; never bypass a gate.
- Visual PRs remain Draft until actual runtime captures have been inspected on desktop and mobile; passing a build is not visual QA.
- Make meaningful behaviour tests; avoid source-reader tests and fabricated results. Fix failed checks in the same PR.
- Keep connector calls small and targeted. Never commit large binary assets or credentials.
- Confirm merged=true and, where relevant, checks of the resulting main SHA.
- Do not hand out ZIPs unless explicitly requested; update the user about progress and blockers.

## Initial technical contract
- Current minimal engine is dependency-free ECMAScript modules (Node 22+) and Node test runner.
- Later UI: TypeScript/React/Vite; Three.js only for views that justify it.
- Save state versioning and deterministic random encounters must have explicit contracts before deployment.
- No backend until remote sync, account or actual server authority requires one. Go is the likely backend when that need arrives.

Read docs/PRODUCT.md, docs/ARCHITECTURE.md, docs/ROADMAP.md and docs/CONTENT-AND-IP.md before extending the game.

## Tactical combat camera — mandatory skill
- For elevated combat, orthographic projection, picking, camera controls or 3D combat QA, read `.agents/skills/tactical-camera/SKILL.md` and `docs/TACTICAL-CAMERA-GATE.md` first.
- Ground exploration remains first-person; tactical elevated view is only for turn-based combat.
- Prove grid-cell ID selection by browser tests on mobile and desktop *before* introducing 3D combat art or a free-rotating camera.
- External community skills are references, not silently installed code or authority to expand task scope.
