# ShadowOps · Star Adventures

An independent, narrative tactical space RPG under the ShadowOps label.

## Play locally

Node.js 22+ required. The React interface uses Vite 6 and TypeScript; no backend or deployment is required.

```sh
cd frontend
npm ci
npm run dev
```

Open the local URL printed by Vite. The current proof-of-play episode is **Ecos en la frontera**: play through science, diplomacy, or tactical intervention and see the decisions affect real domain state. Select orders with mouse/touch or press keys 1–3. Decisions are checkpointed locally, verified by replay on refresh, and recovered safely from corrupt saves. Restart via the button, or `R` after an ending.

Run the core and UI quality checks from the repository root:

```sh
npm run check
cd frontend && npm run build && npm run test:e2e
```

Note: Chrome must be installed for Playwright's `channel: chrome`. GitHub-hosted Ubuntu runners provide Chrome. The dependency lockfile is committed and CI installs it with `npm ci`.

### Ownership

- **Game rules and stories:** this repository, separate from Chess Studio and Chronicles.
- **Infrastructure, staging, deployments and observability:** [shadowops-infra](https://github.com/evilsysadmin/shadowops-infra), only after explicit handoff.
- **No server yet:** the browser UI talks directly to a deterministic domain engine, not mocked API calls.

After the source CI passes on a `main` push, the notification workflow requests Infra's protected bundle candidate. Infra independently verifies the exact game SHA and creates a seven-day artifact; this step does not publish the game. Protected staging publication uses Infra's reviewed `staradvs-protected-publish.yml` workflow. The game repository never deploys or accesses Cloudflare. If cross-repository notification is unavailable, Infra's scheduled candidate build is the fallback.

The game compares its embedded source SHA with the protected `/release.json` every minute and when the tab regains focus. A newly published SHA shows **Nueva versión disponible** without interrupting play; **Recargar** loads the new build while keeping the locally saved game. To rehearse the notice, leave an authenticated staging tab open while a newer admitted SHA is published through Infra's protected workflow.

Read `AGENTS.md`, `docs/PRODUCT.md`, `docs/ARCHITECTURE.md` and `docs/ROADMAP.md` before extending the game.

> This repository currently is **public**. Do not commit third-party Star Trek content or proprietary fan assets while it is public. The proof-of-play story uses original generic content, keeping later world changes inexpensive.
