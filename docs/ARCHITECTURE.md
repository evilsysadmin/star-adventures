# Architecture contract

## Boundaries

- `src/episode.mjs`: pure rules for schema validation, starting an episode and applying choices.
- `content/episodes/*.json`: declarative authored episodes, no executable JavaScript in content.
- `tests/*.test.mjs`: behaviour-focused tests running on Node.js 22+ without dependencies.
- Future `frontend/`: TypeScript + React/Vite and selectively 2D/3D display.
- Future `api/`: Go service **only** if an actual server-owned feature is justified.
- `shadowops-infra` will own deployments after an explicit acceptance of a documented contract.

The engine cannot depend on the UI, browser APIs, HTTP, asset files or any specific fictional franchise. It accepts content objects through its public interface.

## State and events (v1)
Episode state: schemaVersion, episodeId, nodeId, stats and chronological event log. Choices have stable IDs, target nodes and bounded additive effects on allowed numeric stats.

No random source exists in the initial engine. Future random encounters must accept an explicit seed and must be reproducible for identical initial state and commands. Future save snapshots must have validated schema versions and upgrade tests. Do not directly mutate input state.

## Data rules
- Every node is reachable from the start and has a path to a terminal outcome.
- Nonterminal nodes have at least one unique, valid choice. Terminal nodes have no outgoing choices.
- Every choice has a valid target node; effects use only allowed stats.
- Invalid data or commands produce explicit errors, not silent fallthrough.

## Security/performance
No arbitrary content-script execution, credentials or external networking in the engine. Prefer lazy scene rendering and reusable geometry where needed; benchmark genuine hardware before making GPU claims.

## Integration note
Current foundation is deliberately dependency-free JS so its rules can be exercised immediately. A future TypeScript migration must preserve the same observable behaviour and tests rather than adding framework dependencies to the core.
