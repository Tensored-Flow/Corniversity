# Status

Last updated: 31 October 2026 (Milestones 0–4 complete; launch content for all twelve courses
validated and seeded; Milestone 5 in progress).

## Implemented / tested / blocked

| Area | Implemented | Tested | Notes |
|---|---|---|---|
| Planning documents | yes | n/a | docs/ |
| Monorepo, type checks, Biome, Vitest, Playwright | yes | typecheck green for 7 packages | pnpm 12, TS 5.9, Next 16.4; Biome reports formatting errors (Milestone 7) |
| Embedded PostgreSQL dev cluster | yes | migrations applied | `pnpm db:local`; pgvector absent locally (expected) |
| Drizzle schema (65 tables, 3 migrations) | yes | applied; db and worker tests on throw-away clusters | pgvector table only when the extension exists |
| better-auth email+password, owner bootstrap, closed sign-up | yes | e2e journey 1 (desktop + mobile) | rate limits on; bootstrap needs owner email + one-time code |
| Design tokens, fonts, Markdown + KaTeX (MathML) + mhchem | yes | renders; visual QA pass in Milestone 7 | light + dark roles |
| Arrival, sign-in, join, tour, campus shell | yes | e2e journey 1 | |
| Onboarding steps 1–12, welcome, meet the college | yes | e2e journeys 1 and 3 (desktop + mobile) | every answer stored; editable baseline |
| Catalogue (74 courses, honest readiness), departments, course foyer, unit page | yes | e2e journey 2; validator | readiness ladder enforced by the validator |
| Content package: loader, validator (referential + readiness + check examples), versioned seeder | yes | validator green | `pnpm content:validate`, `pnpm db:seed` |
| Twelve launch courses | yes | validator: 0 errors, 0 warnings | 12 teaching_ready; 125 units (31 prepared: MAT-230 4, CHE-101 5, NEU-220 4, the other nine 2 each); 93 original exercises; 27 verified sources; 894 verified locators |
| Learning loop: session, drafts, hint ladder, immutable submissions, worker assessment, structured feedback, appeals, reference reveal | yes | e2e journey 2 (desktop + mobile) | fixture provider; deterministic checks run first |
| Tutor conversation with streaming and validated `[E#]` citations; library passages as evidence; local-only disclosure | yes | e2e journeys 2 and 6 | fixture provider; budget check wired for live runs |
| Evidence states and My Studies | yes | 5 unit tests + journey 2 | |
| AI package: providers, role contracts, prompts (tutor, assessor, director, reading room), pricing, budget | yes | 8 unit tests | Anthropic provider compiles; no live run performed |
| Worker: pg-boss queues; assessment, ingestion and maintenance handlers; non-retryable failures | yes | 6 handler tests on a throw-away cluster; journeys 2 and 5 | heartbeats, dead-letter queues, nightly schedules |
| Scheduling engine (deterministic, tz-aware, caps, dependencies, daily cap, pinning, diff, ICS) | yes | 12 unit tests; journey 3 | |
| Timetable, proposals, catch-up, director conversation, calendar export and tokenised subscription | yes | journey 3 (desktop + mobile) | |
| Library: shelf, source registry, books to obtain (+ md/json export), upload with quarantine, item page with six separate permissions, extraction and indexing, reading room (TOC, page jump, search, printed labels, annotations, passage questions), open-resource import, jobs UI | yes | 16 db tests; 6 worker tests; e2e journeys 5 and 6 (desktop) | OpenStax recorded as reference-only after licence check |
| Desktop companion (pair, sync, watch, status, pause, unpair) with hashed device tokens and online/paused/offline state | yes | 10 unit tests; journeys 5a/5b/6 run the CLI as a child process | `apps/companion/README.md` |
| Laboratory mathematics (norms, sphere metric, kinetics, gradient descent, number game, tuning fit, data leakage) | yes (`packages/core/src/labs`) | 20 unit tests | UI wiring into lab sessions is Milestone 5 |
| Notebook, records, common room, settings | interim pages | – | Milestones 5–6 |

## Environment facts (verified 31 Oct 2026)

- Windows 11, Node v24.19.0, pnpm 12.16.1, Python 3.11.9. Docker and psql absent.
- GitHub CLI authenticated (account Tensored-Flow); creating the private repository was blocked by approval controls, see USER_ACTIONS.md.
- Railway CLI 5.66.0 installed but not logged in. No provider key; fixture provider only.
- The Bash tool on this machine halves backslashes in command text; files are written with the Write tool.
- `pnpm lint` (Biome) reports 744 formatting diagnostics across the repository; they are formatting, not type or logic errors, and are scheduled for the Milestone 7 hardening pass.

## Blocked (owner action required)

See [USER_ACTIONS.md](USER_ACTIONS.md): Railway login for deployment, provider key for live AI,
optional SMTP, optional GitHub publish.

## Resume checkpoint

Local stack: `pnpm db:local` (window 1), `pnpm dev` (window 2). Owner account on the local
database was created by the e2e tests with the test password in `tests/e2e/helpers.ts`; run
`pnpm owner:reset-password` to choose your own. The companion configuration used by the tests
lives in a temporary folder; your own pairing goes to `%APPDATA%\Corniversity`.

Next action: Milestone 5. Wire `LabPanel` into lab sessions (`apps/web/src/app/(app)/sessions/[id]`),
add the norm-comparison and sphere-metric activities to MAT-230 unit 1 and MAT-262 unit 1, build
the notebook (entries, search, tags, questions shelf, backlinks) and records (portfolio,
informal transcript, end-of-term review, exports), revision items bounded by workload, and the
academic evaluation set under `tests/academic-evals`; run journeys 3 and 4 and `pnpm eval:academic`;
then update this file.
