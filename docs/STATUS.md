# Status

Last updated: 1 November 2026 (Milestones 0–9 complete; Milestone 9 applied sections 1 to 12 of the
owner's Mind, Brain and AI update, the rest of which was not received; deployed to Railway, where
the owner account is still to be created).

## Implemented / tested / blocked

| Area | Implemented | Tested | Notes |
|---|---|---|---|
| Planning documents | yes | n/a | docs/ |
| Monorepo, type checks, Biome, Vitest, Playwright | yes | typecheck green for 7 packages; `pnpm lint` clean | pnpm 12, TS 5.9, Next 16.4 |
| Embedded PostgreSQL dev cluster | yes | migrations applied | `pnpm db:local`; pgvector absent locally (expected) |
| Drizzle schema (67 tables, 4 migrations) | yes | db and worker tests on throw-away clusters | pgvector table only when the extension exists |
| better-auth email+password, owner bootstrap, closed sign-up, sign-in rate limit | yes | e2e journey 1 (desktop + mobile); security spec | journeys share one signed-in state so the rate limit stays as it is |
| Design tokens, fonts, Markdown + KaTeX (MathML) + mhchem | yes | 4 web unit tests (sanitiser, maths, chemistry); axe pass | light + dark roles; `--ink-3` darkened to pass 4.5:1 on every paper surface; chemistry rendered by the app's own KaTeX plugin |
| Arrival, sign-in, join, tour, campus shell, campus map with list equivalent | yes | journeys 1, 3; settings spec | |
| Onboarding steps 1–12, welcome, meet the college | yes | journeys 1 and 3 (desktop + mobile) | every answer editable later in Settings |
| Catalogue (86 courses, honest readiness), departments, course foyer, unit page | yes | journey 2; validator | structural readiness ladder enforced by the validator; a unit's recorded checks are the author's self-review, labelled as such |
| Content package: loader, validator, versioned seeder | yes | validator green | `pnpm content:validate`, `pnpm db:seed` |
| Twelve launch courses | yes | validator: 0 errors, 0 warnings | 12 teaching_ready; across the catalogue 141 units (33 prepared), 99 original exercises, 59 verified sources, 1121 verified locators |
| Learning loop: session, drafts, hint ladder, immutable submissions, worker assessment, structured feedback, appeals and real regrades, reference reveal (learner-visible part only) | yes | journey 2 (desktop + mobile); instructor-leakage test; `verdict.test.ts`, `reference.test.ts` | fixture provider; deterministic checks run first; every fixture verdict is withheld (`needs_review`), so no fixture run reaches "demonstrated" |
| Tutor conversation with validated `[E#]` citations; library passages as evidence; local-only disclosure | yes | journeys 2 and 6 | |
| Evidence states, My Studies, revision prompts bounded by the weekly cap | yes | 5 + 1 unit tests; journey 5 spec | recall reschedules only; never evidence |
| AI package: providers, role contracts, prompts (tutor, assessor, director, reading room, chair, peer), pricing, budget | yes | 13 unit tests | Anthropic provider compiles; no live run performed |
| Worker: assessment, ingestion, export and maintenance handlers; non-retryable failures | yes | 6 handler tests; journeys 2, 5 and records | |
| Scheduling engine and timetable, proposals, catch-up, director, ICS | yes | 12 unit tests; journey 3 | journey 7 (missed sessions) is exercised at service level only; see QA_REPORT |
| Library: shelf, sources, books to obtain (+ exports), upload, permissions, extraction, reading room, open-resource import, jobs UI | yes | 16 db tests; 6 worker tests; journeys 5 and 6 (desktop + mobile) | |
| Desktop companion (pair, sync, watch, status, pause, unpair) | yes | 10 unit tests; journeys run the CLI; `watch` rehearsed by hand against the development server (online, then offline two minutes after stopping) | `apps/companion/README.md` |
| Laboratories: norms, sphere metric, A ⇌ B kinetics, gradient descent, number game, tuning fit, data leakage, the choice-modelling loop, planning transfer | yes | 52 unit tests; journeys 3, 4 and spec 09 | exact or synthetic, labelled; maths labs hide closed forms until the tutorial attempt is assessed |
| Notebook (entries, search, tags, questions shelf, backlinks), records (informal transcript, portfolio, end-of-term review, exports built by the worker) | yes | journey spec 05; export download test | the database is the source of truth |
| Common room: societies, labelled AI classmates with mute, office hours, bounded discussions, quiet mode | yes | journey 8 spec | nothing is generated while the learner is away |
| Settings: profile, experience (immersion, theme, type size, motion, social layer, notifications), provider key (encrypted), budgets, persona memory inspection and deletion | yes | settings spec | |
| Programmes (Mind, Brain and AI): catalogue, programme page, follow, pause or leave, director routes, programme map, paper seminar, missing sources as library leads | yes | programme and progress tests; seed test; journey spec 09 | see MIND_BRAIN_AI.md |
| Study defaults and obligations: rolling plan, explicit preferences, workload preview, content sequence, appointments and deadlines kept apart | yes | study and planning tests; journey spec 09 | |
| Security: unauthenticated matrix, sandboxed file route, blob key validation, Markdown sanitiser with a class-name allow-list, Content-Security-Policy (HSTS in production), proxy-aware rate-limit keys, global pairing cap, UUID guards on every id-keyed service | yes | security spec; 4 blob tests; 4 markdown tests; 3 ownership and re-extraction tests | |
| Backup and restore (Node-native, no pg_dump; format 2 with stored originals in sidecar files, dates as text, snapshot read, verified checksum) | yes | 3 integration tests restore a snapshot with a 1 MB original into a fresh database; earlier rehearsal of 65 tables and 2378 rows | `pnpm backup`, `pnpm restore <file> [--yes]`; restore needs a role allowed to set `session_replication_role` |
| Health checks (web reports not-ready until the schema carries this build's migrations) | yes | security spec (`/api/health`) | `pnpm health` |
| Production build | pass on 31 Oct 2026: Next production build with every route server-rendered on demand; worker and companion bundles built | the 35 desktop journeys pass against the production web build (1 Nov 2026) | `pnpm build` |
| Deployment (Dockerfiles, Railway config, deploy script) | deployed 1 Nov 2026: Railway project `corniversity` (PostgreSQL, web, worker) at https://web-production-4c692.up.railway.app | live checks in QA_REPORT.md: health, seeded catalogue, security headers, public pages in a browser, owner-only sign-up | images build on Railway (no Docker here); the owner account is still to be created; fixture AI until a key is added |

## Environment facts (verified 31 Oct 2026)

- Windows 11, Node v24.19.0, pnpm 12.16.1, Python 3.11.9. Docker and psql absent; Railway builds the images.
- GitHub CLI authenticated (account Tensored-Flow); creating the private repository was blocked by approval controls, see USER_ACTIONS.md.
- Railway CLI 5.66.0, signed in to the owner's Railway account (1 Nov 2026); the repository folder is linked to the `corniversity` project. No provider key; fixture provider only.
- The Bash tool on this machine halves backslashes in command text; files are written with the Write tool.
- Next's Turbopack development server reloads pages in a loop on this machine, so `pnpm dev` runs the webpack development server.

## Blocked (owner action required)

See [USER_ACTIONS.md](USER_ACTIONS.md): creating the owner account on the live site, provider key
for live AI, optional SMTP, optional GitHub publish.

## Resume checkpoint

Local stack: `pnpm db:local` (window 1), `pnpm dev` (window 2). Owner account on the local
database was created by the e2e tests with the test password in `tests/e2e/helpers.ts`; run
`pnpm owner:reset-password` to choose your own. Playwright signs in once per run through
`tests/e2e/auth.setup.ts`.

Live site: https://web-production-4c692.up.railway.app. To ship a change, commit it and run
`railway up --service web --ci` (or `--service worker`) from the repository root, which is linked
to the `corniversity` project. `pnpm deploy:railway` creates a new project with new secrets, so it
is for a first deployment only.

Next action: the owner's steps in USER_ACTIONS.md (create the owner account on the live site;
provider key and budgets for live teaching; the missing sections of the Mind, Brain and AI update). Milestone 8's three review passes and their repairs are recorded in
QA_REPORT.md; the handoff is docs/HANDOFF.md.