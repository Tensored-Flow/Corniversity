# QA report

Separates automated software checks, fixture tests, live-model checks, source verification and
academic uncertainty. Nothing below is claimed until the command and result are recorded.

## Software checks

All runs on 30–31 October 2026, Windows 11, local embedded PostgreSQL, fixture AI provider.

| Check | Command | Result |
|---|---|---|
| Type check (7 packages) | `pnpm typecheck` | pass |
| Core unit tests (grounding, deterministic checks, locators, scheduler) | `pnpm --filter @corniversity/core test` | 29 passed (12 scheduler: overlaps, availability, dependencies, daily cap, DST, determinism, stable UIDs) |
| AI unit tests (budget, pricing) | `pnpm --filter @corniversity/ai test` | 8 passed |
| db integration tests on a throw-away embedded cluster (evidence rules; library boundary: validation, deduplication, permissions default unknown, denial before a job, local-only registration, pairing, request export) | `pnpm --filter @corniversity/db test` | 21 passed |
| Worker handler tests on a throw-away cluster (real PDF with page labels → pages, printed labels, passages, search, permitted evidence; corrupt PDF rejected without retry; permission revoked after queueing; never-granted permission) | `pnpm --filter @corniversity/worker test` | 6 passed |
| Companion unit tests (file selection, path reporting, dedupe plan, back-off, stability, hashing, summary) | `pnpm --filter @corniversity/companion test` | 10 passed |
| Content validation (referential integrity, readiness ladder, check examples) | `pnpm content:validate` | 0 errors, 0 warnings; 74 courses (12 launch, all teaching_ready), 125 units (31 prepared), 93 exercises, 27 sources, 894 verified locators, 11 personas |
| Seed | `pnpm db:seed` | 11 course versions created, 63 unchanged, 113 units, 81 exercises, 116 instructor artifacts (MAT-230 unchanged) |
| Journey 1: arrival, bootstrap, closed sign-up, resumable onboarding, unauthenticated refusal | `pnpm exec playwright test tests/e2e/01-arrival-and-onboarding.spec.ts` | 4 passed on desktop and on mobile |
| Journey 2: enrol, attempt, feedback, revision, persistence, tutor turn | `pnpm exec playwright test tests/e2e/02-functional-analysis-loop.spec.ts` | 2 passed on desktop and on mobile |
| Journey 3 (and 7's catch-up surface): onboarding 2–12, welcome, timetable, campus, ICS, token refusal | `pnpm exec playwright test tests/e2e/03-onboarding-to-timetable.spec.ts` | 2 passed on desktop and on mobile |
| Journeys 5 and 6 plus Milestone 4 acceptance: pair the real companion CLI, dry run, register with deduplication, reference-only item (item page, reading room and passage endpoint refuse; tutor turn carries the university's note), grant storage → companion uploads → confirm → extraction permitted → processed with printed labels → search → passage question cited to p. 1 (PDF page 3) → note; fake PDF refused; corrupt PDF rejected with reason and no retry; unauthenticated file, ask, companion and page access refused | `pnpm exec playwright test tests/e2e/04-library.spec.ts` | 5 passed on desktop; mobile run recorded in Milestone 5 |
| Lint | `pnpm lint` | 744 formatting diagnostics, 10 warnings; not yet fixed (Milestone 7) |
| Production build | `pnpm build` | not run yet |

Defects found and fixed by these checks: a Turbopack import-resolution failure; the over-generalisation
check matching a *mention* of the finite-dimensional theorem; double-escaped regex patterns in exercise
JSON (now guarded by per-exercise sample texts the validator runs); enrolments orphaned by a course
version change (now resolved by course, with a visible notice); the test PDF generator placing text
beyond the page edge, which pdf.js drops as a real viewer would; pnpm forwarding a literal `--` to
the companion so its command was not recognised; a one-shot `sync` heartbeat being shown as "paused"
(paused now means a running watcher that was paused); the Next dev server serving a stale module
after a service patch (restart; no code defect).

## Academic evaluations

`pnpm eval:academic` — not run yet. Cases will live in `tests/academic-evals/cases/` (Milestone 5).

## Source verification

All 27 source records were opened by the authoring agents on 30 October 2026 with the pages and
PDFs listed in each record's `componentsSeen` and the gaps in `limitations`. Notable findings:
OpenStax Chemistry 2e states CC BY-NC-SA 4.0 with an AI-ingestion restriction (reference-only,
never passed to a model); author-hosted notes without a licence (Gudmundsson, Hitchin, Tao, Tong,
Carroll, probmods.org) are reference-only; Taylor & Wheeler's *Spacetime Physics* is CC BY 4.0 by
the authors' statement. See docs/SOURCE_REGISTRY.md.

## Live-model checks

None performed (no provider configured). Fixture runs are not live checks.

## Visual QA

Screenshots captured by the journeys at 1440×900 and 390×844 are in `docs/qa/screenshots/`
(arrival, onboarding, course foyer, unit page, feedback, My Studies, tutor turn, timetable,
welcome, campus; library shelf, pairing code, registered items, local-only item, tutor
local-only note, ready item, reading room, reading-room answer, jobs, rejected corrupt file).
Desktop library screenshots were inspected during Milestone 4; the full inspection and repair
pass at both viewports is Milestone 7.

## Deployment

Status: **not deployed** (Railway CLI not authenticated). See USER_ACTIONS.md.

## Remaining defects

- Biome formatting diagnostics (744) across the repository; no runtime effect.
- The passage-question answer with the fixture provider is a scripted placeholder that says so;
  a real explanation needs a configured provider.
