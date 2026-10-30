# Status

Last updated: 30 October 2026 (Milestone 2 complete; Milestone 3 and launch-content authoring in progress).

## Implemented / tested / blocked

| Area | Implemented | Tested | Notes |
|---|---|---|---|
| Planning documents | yes | n/a | docs/ |
| Monorepo, type checks, Biome, Vitest, Playwright | yes | typecheck green for 7 packages | pnpm 12, TS 5.9, Next 16.4 |
| Embedded PostgreSQL dev cluster | yes | migrations applied | `pnpm db:local`; pgvector absent locally (expected) |
| Drizzle schema (64 tables, 2 migrations) | yes | applied; db tests on throw-away cluster | pgvector table only when the extension exists |
| better-auth email+password, owner bootstrap, closed sign-up | yes | e2e journey 1 (desktop + mobile) | rate limits on; bootstrap needs owner email + one-time code |
| Design tokens, fonts, Markdown + KaTeX (MathML) + mhchem | yes | renders; visual QA pending | light + dark roles |
| Arrival, sign-in, join, tour, campus shell, onboarding step 1 | yes | e2e journey 1 | steps 2–12 are Milestone 3 |
| Catalogue (74 courses, honest readiness), departments, course foyer, unit page | yes | e2e journey 2 | readiness ladder enforced by the validator |
| Content package: loader, validator (referential + readiness + check examples), versioned seeder | yes | validator green | `pnpm content:validate` |
| MAT-230 Functional Analysis I | yes | validator; journey 2 | teaching_ready: 4 prepared units of 12 (5–12 outlined with verified locators), 12 exercises, 14 instructor artifacts, 62 verified locators |
| Learning loop: session, drafts, hint ladder, immutable submissions, worker assessment, structured feedback, appeals, reference reveal | yes | e2e journey 2 (desktop + mobile) | fixture provider; deterministic checks run first |
| Tutor conversation with streaming and validated `[E#]` citations | yes | e2e journey 2 | fixture provider; budget check wired for live runs |
| Evidence states and My Studies | yes | 5 unit tests + journey 2 | |
| AI package: providers, role contracts, prompts, pricing, budget | yes | 8 unit tests | Anthropic provider compiles; no live run performed |
| Worker: pg-boss queues, assessment + maintenance handlers | yes | journey 2 exercises the queue | ingestion/prepare-unit handlers are Milestone 4/5 |
| Scheduling engine (deterministic, tz-aware, caps, dependencies, pinning, diff, ICS) | yes | 11 unit tests | wiring into onboarding/timetable is Milestone 3 |
| Other 11 launch courses | in progress | – | five content agents authoring from verified sources |
| Timetable, onboarding 2–12, director, library, notebook, common room, records, settings | interim pages | – | Milestones 3–6 |

## Environment facts (verified 30 Oct 2026)

- Windows 11, Node v24.19.0, pnpm 12.16.1, Python 3.11.9. Docker and psql absent.
- GitHub CLI authenticated (account Tensored-Flow); creating the private repository was blocked by approval controls, see USER_ACTIONS.md.
- Railway CLI 5.66.0 installed but not logged in. No provider key; fixture provider only.
- The Bash tool on this machine halves backslashes in command text; files are written with the Write tool.

## Blocked (owner action required)

See [USER_ACTIONS.md](USER_ACTIONS.md): Railway login for deployment, provider key for live AI,
optional SMTP, optional GitHub publish.

## Resume checkpoint

Local stack: `pnpm db:local` (window 1), `pnpm dev` (window 2). Owner account on the local
database was created by the e2e tests with the test password in `tests/e2e/helpers.ts`; run
`pnpm owner:reset-password` to choose your own.

Next action: Milestone 3. Wire the scheduler through `packages/db/src/services/timetable.ts`
and `programme.ts`, build onboarding steps 2–12 ending in a confirmed term with a first week,
the director conversation and proposals, the timetable views and ICS export. Integrate the
content agents' courses when they report (`pnpm content:validate`, then `pnpm db:seed`). Then
update this file.
