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

After **both** source CI jobs pass on a `main` push, the optional notification job requests Infra's existing `staradvs-pages-staging.yml` workflow. The game repository **never deploys** or accesses Cloudflare. To enable immediate cross-repository handoff, configure the `SHADOWOPS_INFRA_ACTIONS_TOKEN` **repository secret in Star Adventures**, using a GitHub fine-grained token restricted to `evilsysadmin/shadowops-infra` with **Actions: read/write** permission. Without it, or if dispatch temporarily fails, source CI remains green and Infra's scheduled staging reconciliation remains the fallback. Infra independently verifies exact source `main` SHA and finished, successful core/browser CI before any publication.
- **No server yet:** the browser UI talks directly to a deterministic domain engine, not mocked API calls.

Read `AGENTS.md`, `docs/PRODUCT.md`, `docs/ARCHITECTURE.md` and `docs/ROADMAP.md` before extending the game.

> This repository currently is **public**. Do not commit third-party Star Trek content or proprietary fan assets while it is public. The proof-of-play story uses original generic content, keeping later world changes inexpensive.
