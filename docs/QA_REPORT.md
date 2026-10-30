# QA report

Separates automated software checks, fixture tests, live-model checks, source verification and
academic uncertainty. Nothing below is claimed until the command and result are recorded.

## Software checks

| Check | Command | Result | Date |
|---|---|---|---|
| Type check | `pnpm typecheck` | not run yet | – |
| Lint | `pnpm lint` | not run yet | – |
| Unit tests | `pnpm test` | not run yet | – |
| Integration tests | `pnpm test:integration` | not run yet | – |
| End-to-end journeys | `pnpm test:e2e` | not run yet | – |
| Production build | `pnpm build` | not run yet | – |

## Academic evaluations

`pnpm eval:academic` — not run yet. Cases live in `tests/academic-evals/cases/`.

## Live-model checks

None performed (no provider configured). Fixture runs are not live checks.

## Visual QA

Screenshots: none yet. Target viewports 1440×900 and 390×844.

## Deployment

Status: **not deployed** (Railway CLI not authenticated). See USER_ACTIONS.md.

## Remaining defects

None recorded yet.
