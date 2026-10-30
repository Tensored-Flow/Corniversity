# QA report

Separates automated software checks, fixture tests, live-model checks, source verification and
academic uncertainty. Nothing below is claimed until the command and result are recorded.

## Software checks

All runs on 30 October 2026, Windows 11, local embedded PostgreSQL, fixture AI provider.

| Check | Command | Result |
|---|---|---|
| Type check (7 packages) | `pnpm typecheck` | pass |
| Core unit tests (grounding, deterministic checks, locators) | `pnpm --filter @corniversity/core test` | 17 passed |
| AI unit tests (budget, pricing) | `pnpm --filter @corniversity/ai test` | 8 passed |
| db tests on a throw-away embedded cluster (evidence rules) | `pnpm test:integration` | 5 passed |
| Content validation (referential integrity, readiness ladder, check examples) | `pnpm content:validate` | 0 errors, 0 warnings; 74 courses, 12 units (4 prepared), 12 exercises, 62 verified locators |
| Journey 1: arrival, bootstrap, closed sign-up, resumable onboarding, unauthenticated refusal | `pnpm exec playwright test tests/e2e/01-arrival-and-onboarding.spec.ts` | 4 passed on desktop and on mobile |
| Journey 2: enrol, attempt, feedback, revision, persistence, tutor turn | `pnpm exec playwright test tests/e2e/02-functional-analysis-loop.spec.ts` | 2 passed on desktop (mobile recorded below) |
| Lint | `pnpm lint` | not run yet |
| Production build | `pnpm build` | not run yet |

Defects found and fixed by these checks: a Turbopack import-resolution failure; the over-generalisation
check matching a *mention* of the finite-dimensional theorem; double-escaped regex patterns in exercise
JSON (now guarded by per-exercise sample texts the validator runs); enrolments orphaned by a course
version change (now resolved by course, with a visible notice).

## Academic evaluations

`pnpm eval:academic` — not run yet. Cases live in `tests/academic-evals/cases/`.

## Live-model checks

None performed (no provider configured). Fixture runs are not live checks.

## Visual QA

Screenshots captured by the journeys at 1440×900 and 390×844 are in `docs/qa/screenshots/`
(arrival, onboarding step 1, course foyer, unit page, feedback revision requested, feedback accepted,
My Studies evidence, tutor turn). Inspection and repair pass is scheduled for Milestone 7.

## Deployment

Status: **not deployed** (Railway CLI not authenticated). See USER_ACTIONS.md.

## Remaining defects

None recorded yet.
