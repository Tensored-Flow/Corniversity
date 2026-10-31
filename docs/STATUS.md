# Status

Last updated: 31 October 2026 (Milestones 0–6 complete; Milestone 7 hardening complete except
deployment, which waits on the owner's Railway login; Milestone 8 review pending).

## Implemented / tested / blocked

| Area | Implemented | Tested | Notes |
|---|---|---|---|
| Planning documents | yes | n/a | docs/ |
| Monorepo, type checks, Biome, Vitest, Playwright | yes | typecheck green for 7 packages; `pnpm lint` clean | pnpm 12, TS 5.9, Next 16.4 |
| Embedded PostgreSQL dev cluster | yes | migrations applied | `pnpm db:local`; pgvector absent locally (expected) |
| Drizzle schema (65 tables, 3 migrations) | yes | db and worker tests on throw-away clusters | pgvector table only when the extension exists |
| better-auth email+password, owner bootstrap, closed sign-up, sign-in rate limit | yes | e2e journey 1 (desktop + mobile); security spec | journeys share one signed-in state so the rate limit stays as it is |
| Design tokens, fonts, Markdown + KaTeX (MathML) + mhchem | yes | 4 web unit tests (sanitiser, maths, chemistry); axe pass | light + dark roles; `--ink-3` darkened to pass 4.5:1 on every paper surface; chemistry rendered by the app's own KaTeX plugin |
| Arrival, sign-in, join, tour, campus shell, campus map with list equivalent | yes | journeys 1, 3; settings spec | |
| Onboarding steps 1–12, welcome, meet the college | yes | journeys 1 and 3 (desktop + mobile) | every answer editable later in Settings |
| Catalogue (74 courses, honest readiness), departments, course foyer, unit page | yes | journey 2; validator | readiness ladder enforced by the validator |
| Content package: loader, validator, versioned seeder | yes | validator green | `pnpm content:validate`, `pnpm db:seed` |
| Twelve launch courses | yes | validator: 0 errors, 0 warnings | 12 teaching_ready; 125 units (31 prepared); 93 original exercises; 27 verified sources; 894 verified locators |
| Learning loop: session, drafts, hint ladder, immutable submissions, worker assessment, structured feedback, appeals, reference reveal | yes | journey 2 (desktop + mobile); instructor-leakage test | fixture provider; deterministic checks run first |
| Tutor conversation with validated `[E#]` citations; library passages as evidence; local-only disclosure | yes | journeys 2 and 6 | |
| Evidence states, My Studies, revision prompts bounded by the weekly cap | yes | 5 + 1 unit tests; journey 5 spec | recall reschedules only; never evidence |
| AI package: providers, role contracts, prompts (tutor, assessor, director, reading room, chair, peer), pricing, budget | yes | 8 unit tests | Anthropic provider compiles; no live run performed |
| Worker: assessment, ingestion, export and maintenance handlers; non-retryable failures | yes | 6 handler tests; journeys 2, 5 and records | |
| Scheduling engine and timetable, proposals, catch-up, director, ICS | yes | 12 unit tests; journey 3 | journey 7 (missed sessions) is exercised at service level only; see QA_REPORT |
| Library: shelf, sources, books to obtain (+ exports), upload, permissions, extraction, reading room, open-resource import, jobs UI | yes | 16 db tests; 6 worker tests; journeys 5 and 6 (desktop + mobile) | |
| Desktop companion (pair, sync, watch, status, pause, unpair) | yes | 10 unit tests; journeys run the CLI; `watch` rehearsed by hand against the development server (online, then offline two minutes after stopping) | `apps/companion/README.md` |
| Laboratories: norms, sphere metric, A ⇌ B kinetics, gradient descent, number game, tuning fit, data leakage | yes | 20 unit tests; journeys 3 and 4 | exact or synthetic, labelled; maths labs hide closed forms until the tutorial attempt is assessed |
| Notebook (entries, search, tags, questions shelf, backlinks), records (informal transcript, portfolio, end-of-term review, exports built by the worker) | yes | journey spec 05; export download test | the database is the source of truth |
| Common room: societies, labelled AI classmates with mute, office hours, bounded discussions, quiet mode | yes | journey 8 spec | nothing is generated while the learner is away |
| Settings: profile, experience (immersion, theme, type size, motion, social layer, notifications), provider key (encrypted), budgets, persona memory inspection and deletion | yes | settings spec | |
| Security: unauthenticated matrix, sandboxed file route, blob key validation, Markdown sanitiser | yes | security spec; 4 blob tests; 4 markdown tests | |
| Backup and restore (Node-native, no pg_dump) | yes | rehearsed: 65 tables, 2378 rows restored into a throw-away database, all compared counts equal | `pnpm backup`, `pnpm restore <file> [--yes]` |
| Health checks | yes | security spec (`/api/health`) | `pnpm health` |
| Production build | pass on 31 Oct 2026: Next production build with every route server-rendered on demand; worker and companion bundles built | | `pnpm build` |
| Deployment (Dockerfiles, Railway config, deploy script) | prepared, not executed | Dockerfiles unverified locally (no Docker) | needs `railway login`; see USER_ACTIONS.md |

## Environment facts (verified 31 Oct 2026)

- Windows 11, Node v24.19.0, pnpm 12.16.1, Python 3.11.9. Docker and psql absent, so the Dockerfiles could not be built here.
- GitHub CLI authenticated (account Tensored-Flow); creating the private repository was blocked by approval controls, see USER_ACTIONS.md.
- Railway CLI 5.66.0 installed but not logged in. No provider key; fixture provider only.
- The Bash tool on this machine halves backslashes in command text; files are written with the Write tool.

## Blocked (owner action required)

See [USER_ACTIONS.md](USER_ACTIONS.md): Railway login for deployment, provider key for live AI,
optional SMTP, optional GitHub publish.

## Resume checkpoint

Local stack: `pnpm db:local` (window 1), `pnpm dev` (window 2). Owner account on the local
database was created by the e2e tests with the test password in `tests/e2e/helpers.ts`; run
`pnpm owner:reset-password` to choose your own. Playwright signs in once per run through
`tests/e2e/auth.setup.ts`.

Next action: Milestone 8. Run the independent review passes (sceptical learner, academic
assessor, production engineer), repair what they find, then write the handoff (deployment status
"locally working with deployment prepared" unless the owner has logged into Railway). Desktop
journeys: all 29 journey tests in specs 01–08 pass on desktop (plus the shared sign-in setup). Mobile journeys: 13 journey tests in specs 01–04 pass on mobile (390×844).
