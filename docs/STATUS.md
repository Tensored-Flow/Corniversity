# Status

Last updated: 9 November 2026 (Milestones 0–10 complete: Milestone 10 applied sections 13 to 20 of
the owner's Mind, Brain and AI update. The site is deployed on Railway; the owner account is still
to be created there, so the checks behind sign-in and the live-tutoring test remain blocked).

## Implemented / tested / blocked

| Area | Implemented | Tested | Notes |
|---|---|---|---|
| Planning documents | yes | n/a | docs/ |
| Monorepo, type checks, Biome, Vitest, Playwright | yes | typecheck green for 7 packages; `pnpm lint` clean | pnpm 12, TS 5.9, Next 16.4 |
| Embedded PostgreSQL dev cluster | yes | migrations applied | `pnpm db:local`; pgvector absent locally (expected) |
| Drizzle schema (74 tables, 7 migrations) | yes | db and worker tests on throw-away clusters; a fresh database migrated and seeded by the worker (9 Nov 2026) | pgvector table only when the extension exists; migrations are additive |
| better-auth email+password, owner bootstrap, closed sign-up, sign-in rate limit, one-owner index | yes | owner test (setup, concurrent inserts, restart); journey 1; security spec | the bootstrap code is optional once the owner exists |
| Owner password recovery without email | yes | owner test; the command run end to end against a throw-away database | `pnpm owner:reset-password` locally; in the worker's shell on Railway (HANDOFF.md); signs the owner out everywhere |
| Design tokens, fonts, Markdown + KaTeX (MathML) + mhchem | yes | 4 web unit tests (sanitiser, maths, chemistry); axe pass | light + dark roles; `--ink-3` darkened to pass 4.5:1 on every paper surface; chemistry rendered by the app's own KaTeX plugin |
| Arrival, sign-in, join, tour, campus shell, campus map with list equivalent | yes | journeys 1, 3; settings spec | |
| Onboarding steps 1–12, welcome, meet the college | yes | journeys 1 and 3 (desktop + mobile) | after orientation the plan steps change nothing; the interests step only follows newly chosen programmes |
| Catalogue (86 courses, honest readiness), departments, course foyer, unit page | yes | journey 2; validator | structural readiness ladder enforced by the validator; a unit's recorded checks are the author's self-review, labelled as such |
| Content package: loader, validator, versioned seeder, coverage generator | yes | validator green; coverage test | `pnpm content:validate`, `pnpm db:seed`, `pnpm content:coverage` |
| Twelve launch courses | yes | validator: 0 errors, 0 warnings | 12 teaching_ready; across the catalogue 141 units (33 prepared), 99 original exercises, 59 verified sources, 1121 verified locators |
| Learning loop: session, drafts, hint ladder, immutable submissions, worker assessment, structured feedback, appeals and real regrades, reference reveal (learner-visible part only) | yes | journey 2 (desktop + mobile); instructor-leakage test; `verdict.test.ts`, `reference.test.ts` | scripted demo; deterministic checks run first; without a live model every verdict is withheld (`needs_review`) |
| Tutor conversation with validated `[E#]` citations; library passages as evidence; local-only disclosure | yes | journeys 2 and 6 | |
| Evidence states, My Studies, revision prompts bounded by the weekly cap | yes | 5 + 1 unit tests; journey 5 spec | recall reschedules only; never evidence |
| AI package: Anthropic provider (beta Messages API, server-side refusal fallback), scripted demo, provider states, supported models, approval of paid use, worst-case budget, per-attempt pricing, asset diagnostic, role contracts and prompts | yes | 58 unit tests, including a contract test of the real SDK against a local server speaking the documented wire format | no request has reached Anthropic; live tutoring is blocked (no key, no approval) |
| Live-tutoring settings and labels | yes | provider-config tests; journeys 6 and 10 (a live model that cannot run is refused and the learner's message kept) | every AI label names the model, "model blocked" or "scripted demo" |
| Worker: assessment, ingestion, export and maintenance handlers; non-retryable failures; asset line on start | yes | handler tests; journeys 2, 5 and records | |
| Scheduling engine and timetable, proposals, catch-up, director, ICS | yes | 12 unit tests; journey 3 | journey 7 (missed sessions) is exercised at service level only; see QA_REPORT |
| Library: shelf, sources, books to obtain (+ exports), upload, permissions, extraction, reading room, open-resource import, jobs UI | yes | 19 db tests; worker tests; journeys 5 and 6 (desktop + mobile) | |
| Desktop companion (pair, sync, watch, status, pause, unpair) | yes | 10 unit tests; journeys run the CLI; `watch` rehearsed by hand against the development server | `apps/companion/README.md` |
| Laboratories: norms, sphere metric, A ⇌ B kinetics, gradient descent, number game, tuning fit (held-out trials or a held-out orientation), data leakage, the choice-modelling loop, planning transfer | yes | 58 laboratory unit tests; content regression tests against the exercises; journeys 4, spec 09 and spec 10 | exact or synthetic, labelled; *Predict again* resets a prediction-gated laboratory |
| Notebook, records (informal transcript, portfolio, end-of-term review, research projects, exports built by the worker) | yes | journey spec 05; export download test; spec 10 | the database is the source of truth |
| Common room: societies, labelled AI classmates with mute, office hours, bounded discussions, quiet mode | yes | journey 8 spec; spec 10 (quiet mode) | nothing is generated while the learner is away |
| Settings: profile, experience, live tutoring (provider, model, encrypted key, fallback, limits, approval, recent runs), persona memory | yes | settings spec; provider-config tests | |
| Programmes (Mind, Brain and AI): catalogue, programme page with where to begin and the route by stage, block pages, follow, pause or leave, director routes with prerequisites and the focus change, programme map, paper seminar, missing sources as library leads | yes | route, next-step, progress and programmes tests; seed test; journey specs 09 and 10 | coverage per block, elective, method and source in MIND_BRAIN_AI.md |
| Research studio: projects of five kinds, focused shelf, versioned proposal, methods and report, provenance, notebook, artefacts, feedback, oral discussion, Markdown report | yes | 13 core and 13 db tests; spec 10 (desktop + mobile) | feedback is structural checks in the scripted demo; no data from people |
| Study defaults and obligations: rolling plan, explicit preferences, workload preview with independent work, content sequence, appointments and deadlines kept apart | yes | study and planning tests; journey specs 09 and 10 | |
| Security: unauthenticated matrix (including the studio), sandboxed file routes, blob key validation, Markdown sanitiser, Content-Security-Policy (HSTS in production), proxy-aware rate-limit keys, global pairing cap, UUID guards | yes | security spec; blob, markdown and ownership tests | |
| Backup and restore | yes | 3 integration tests restore a snapshot with a 1 MB original into a fresh database | `pnpm backup`, `pnpm restore <file> [--yes]` |
| Health checks (web reports not-ready until the schema carries this build's migrations; asset counts and prompt versions) | yes | security spec (`/api/health`) | `pnpm health` |
| Production build | pass on 9 Nov 2026 | the 85 journeys pass at both sizes against the production build on a new, empty database | `pnpm build` |
| Deployment (Dockerfiles, Railway config, deploy script) | deployed 1 Nov 2026 to the Railway project `corniversity` (PostgreSQL, web, worker) at https://web-production-4c692.up.railway.app; the Milestone 10 release is recorded in QA_REPORT.md, Deployment | public pages, health, assets and headers only; nothing behind sign-in | images build on Railway (no Docker here); the owner account is still to be created; scripted demo until a key is added and paid use approved |

## Environment facts (verified 9 Nov 2026)

- Windows 11, Node v24.19.0, pnpm 12.16.1, Python 3.11.9 (no image library). Docker and psql absent; Railway builds the images.
- GitHub CLI authenticated (account Tensored-Flow); creating the private repository was blocked by approval controls, see USER_ACTIONS.md. The repository has no git remote.
- Railway CLI 5.66.0, signed in to the owner's Railway account; the repository folder is linked to the project `corniversity` (environment `production`; services `web`, `worker`, `Postgres`). No provider key; scripted demo only.
- Running a command inside a Railway container (`railway ssh`) was refused by this machine's approval controls; the deployed service is checked through its health route and logs instead.
- The Bash tool on this machine halves backslashes in command text and fails on heredocs with many apostrophes; files are written with the Write tool. Python's `write_text` writes CRLF here; files are written as bytes.
- Next's Turbopack development server reloads pages in a loop on this machine, so `pnpm dev` runs the webpack development server.

## Blocked (owner action required)

See [USER_ACTIONS.md](USER_ACTIONS.md): creating the owner account on the live site (then retiring
the bootstrap code and the checks behind sign-in), a provider key with approved paid use and a
test budget (then the live-tutoring test), optional email, optional GitHub publish.

## Resume checkpoint

Local stack: `pnpm db:local` (window 1), `pnpm dev` (window 2). Owner account on the local
database was created by the e2e tests with the test password in `tests/e2e/helpers.ts`; run
`pnpm owner:reset-password` to choose your own. Playwright signs in once per run through
`tests/e2e/auth.setup.ts`.

Live site: https://web-production-4c692.up.railway.app. To ship a change, commit it and run
`railway up --service worker --ci`, wait for its migrations and seed, then
`railway up --service web --ci`, from the repository root, which is linked to the
`corniversity` project. `pnpm deploy:railway` creates a new project with new secrets and refuses
to run in a linked folder; it is for a first deployment only.

Next action: the owner's steps in USER_ACTIONS.md. After the account exists: the authenticated
live checks and the removal of `OWNER_BOOTSTRAP_CODE`; after a key and an approved test budget:
one small live-tutoring check, recorded separately from the scripted tests.
