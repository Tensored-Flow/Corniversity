# Status

Last updated: 11 November 2026 (Milestones 0–19 complete: the teaching-experience brief
(`brief/CORNIVERSITY_CLAUDE_CODE_NEXT_BUILD.md`, Milestones 11–17), the owner's final
acceptance request (Milestone 18: teaching through the owner's ChatGPT plan in a local installation,
the extension workflows' repairs, allowlisted error codes, a restore drill) and the lean study
format (Milestone 19: courses as notes, problem sheets, tutorials and timed exams; shorter text). The owner account is
still to be created on the hosted site, so the checks behind sign-in, live tutoring and the plan
connection wait for the owner's acceptance journey, USER_ACTIONS 4).

## Implemented / tested / blocked

| Area | Implemented | Tested | Notes |
|---|---|---|---|
| Planning documents | yes | n/a | docs/ |
| Monorepo, type checks, Biome, Vitest, Playwright | yes | typecheck green for 7 packages; `pnpm lint` clean | pnpm 12, TS 5.9, Next 16.4 |
| Embedded PostgreSQL dev cluster | yes | migrations applied | `pnpm db:local`; pgvector absent locally (expected) |
| Drizzle schema (87 tables, 16 migrations) | yes | db and worker tests on throw-away clusters; a fresh database migrated and seeded by the worker (9 Nov 2026) | pgvector table only when the extension exists; migrations are additive |
| better-auth email+password, owner bootstrap, closed sign-up, sign-in rate limit, one-owner index | yes | owner test (setup, concurrent inserts, restart); journey 1; security spec | the bootstrap code is optional once the owner exists |
| Owner password recovery without email | yes | owner test; the command run end to end against a throw-away database | `pnpm owner:reset-password` locally; in the worker's shell on Railway (HANDOFF.md); signs the owner out everywhere |
| Design tokens, fonts, Markdown + KaTeX (MathML) + mhchem | yes | 4 web unit tests (sanitiser, maths, chemistry); axe pass | light + dark roles; `--ink-3` darkened to pass 4.5:1 on every paper surface; chemistry rendered by the app's own KaTeX plugin |
| Arrival, sign-in, join, tour, campus shell, campus map with list equivalent | yes | journeys 1, 3; settings spec | |
| Orientation: one step (name and time zone), then the catalogue | yes | journey 1 (desktop + mobile) | old orientation addresses lead to *Your courses*; the earlier twelve steps' records are kept |
| Catalogue (86 courses, honest readiness), departments, course foyer, unit page | yes | journey 2; validator | structural readiness ladder enforced by the validator; a unit's recorded checks are the author's self-review, labelled as such |
| Content package: loader, validator, versioned seeder, coverage generator | yes | validator green; coverage test | `pnpm content:validate`, `pnpm db:seed`, `pnpm content:coverage` |
| Twelve launch courses | yes | validator: 0 errors, 0 warnings | 12 teaching_ready; across the catalogue 141 units (33 prepared), 103 original exercises, 59 verified sources, 1121 verified locators |
| Study workspace (teaching-experience brief CORE-01–03): session header with objective, source and last save; pause and resume; reading position saved on the server; selection questions with the attached context shown; anchored notes and lecture timestamps; external-reading progress; drafts with revisions, conflicts and an on-device buffer; four help modes; paper pages, confirmed transcriptions and paper submissions; consent-gated model transcription; concept bridges with exact return; session close from records; timetable slots open their session | yes | 15 service tests, 11 core tests, 3 worker tests; journey 11 (8 journeys at both viewports) | scripted demo; model transcription and live help unverified without a key |
| Lean study format (Milestone 19): navigation of Courses, Catalogue, Library and Notebook; any number of courses taken from the catalogue; a course as unit rows (lecture notes, problem sheet, tutorial); timed, closed-book exams from problems not yet attempted, marked by the assessor | yes | `exam.test.ts` (5), `exams.test.ts` (9), `sheets.test.ts` (4); journey 3 (desktop + mobile) | marking needs a connected teacher; in the scripted demo exam answers stay unmarked |
| Learning loop: session, drafts, hint ladder, immutable submissions, worker assessment, structured feedback, appeals and real regrades, reference reveal (learner-visible part only) | yes | journey 2 (desktop + mobile); instructor-leakage test; `verdict.test.ts`, `reference.test.ts` | scripted demo; deterministic checks run first; without a live model every verdict is withheld (`needs_review`); each assessment keeps the exercise as answered; feedback repeating the reference solution is withheld |
| Tutor conversation with validated `[E#]` citations; library passages as evidence; local-only disclosure | yes | journeys 2 and 6; citation and ingestion tests | passages match any word of the question, best first; replayed history names the sources earlier tags resolved to |
| Evidence states, My Studies, revision prompts bounded by the weekly cap | yes | 5 + 1 unit tests; journey 5 spec | recall reschedules only; never evidence |
| Academic operations, subject and reading-programme proposals, discussion bounds (brief EXT-03 to EXT-06) | yes | extension (3) and discussion-bounds (3) tests; journey 14 at both viewports; axe; security journey covers the new routes | a published proposal is a catalogue item at readiness "proposed": no enrolment, no verified source, no syllabus |
| Voice and visual teaching (brief EXT-01, EXT-02): dictation after a recorded permission, read-aloud with on-device voices, spoken explanations marked; checked visual explanations with films recorded locally (`pnpm visuals:render`) | yes | visual (8), visuals-seed (4) and speakable (2) tests; journey 13 at both viewports; axe | dictation in automation uses a labelled stand-in for the browser's recogniser; films have no sound (captions carry the words) |
| Learning issues, bounded review, problem progressions, course preparation (brief CORE-04 to CORE-06) | yes | learning-issues (4), review (6), pipeline (4), preparation (4) and prepare-handler (2) tests; journey 12 at both viewports | issues describe work, not the learner; review owes nothing; progressions tagged on four routes; preparation drafting is blocked in the scripted demo and unverified live |
| AI package: Anthropic provider (beta Messages API, server-side refusal fallback, SDK retries off), scripted demo, provider states, supported models, approval of paid use, strict worst-case bound (a token per byte, images at the documented ceiling, unknown prices refused), micro-dollar arithmetic, billing certainty of failures, bounded history, per-attempt pricing (table fetched 10 Nov 2026), asset diagnostic, role contracts and prompts | yes | 69 unit tests in `packages/ai`, including a contract test of the real SDK against a local server speaking the documented wire format and role-ceiling usability; the worker assessment test runs the live path against such a server, including a dropped connection (one call, run unsettled) | no request has reached Anthropic; live tutoring waits for the owner's key and approval |
| Teaching through the owner's ChatGPT plan (local installation only: `pnpm local:owner`, http://127.0.0.1:3300, *Settings → Use your ChatGPT plan*) | yes | `ai` plan tests (14) and `db` plan tests (15) against a labelled test double of OpenAI's documented wire format; journey 16 at both viewports on a rehearsal stack wired to the double; independent review (its findings fixed) | no request has reached OpenAI; the hosted site refuses it (OpenAI documents plan usage for open-source and locally hosted apps); request limits the owner approves; a usage limit pauses until resumed; no fallback to an API key or scripted text |
| Live-tutoring settings and labels; unsettled runs and their settlement | yes | provider-config tests (20: reservations, the lock, recorded spend, unsettled runs held, stale runs, settlement rules, duplicate calls, UTC boundaries); journeys 6 and 10 (a live model that cannot run is refused and the learner's message kept) | every AI label names the model, "model blocked" or "scripted demo"; Settings explains the Console key and subscription credits with the official link |
| Worker: assessment, ingestion, export and maintenance handlers; non-retryable failures; asset line on start | yes | handler tests; journeys 2, 5 and records | |
| Scheduling engine and timetable, proposals, catch-up, director, ICS | yes | 12 unit tests; journey 3 (ICS) | journey 7 (missed sessions) is exercised at service level only; see QA_REPORT. Hidden from navigation in the lean format (Milestone 19); routes and records kept. |
| Library: shelf, sources, books to obtain (+ exports), upload, permissions, extraction, reading room, open-resource import, jobs UI | yes | 19 db tests; worker tests; journeys 5 and 6 (desktop + mobile) | |
| Desktop companion (pair, sync, watch, status, pause, unpair) | yes | 10 unit tests; journeys run the CLI; `watch` rehearsed by hand against the development server | `apps/companion/README.md` |
| Laboratories: norms, sphere metric, A ⇌ B kinetics, gradient descent, number game, tuning fit (held-out trials or a held-out orientation), data leakage, the choice-modelling loop, planning transfer | yes | 59 laboratory unit tests; content regression tests against the exercises; journeys 4, spec 09 and spec 10 | exact or synthetic, labelled; *Predict again* resets a prediction-gated laboratory; a saved prediction cannot be edited or deleted |
| Notebook, records (informal transcript, portfolio, end-of-term review, research projects, exports built by the worker) | yes | journey spec 05; export download test; spec 10 | the database is the source of truth |
| Common room: societies, labelled AI classmates with mute, office hours, bounded discussions, quiet mode | yes | journey 6 (mute); journey 8 and the quiet-mode journeys are skipped since Settings no longer offers the setting | nothing is generated while the learner is away. Hidden from navigation in the lean format (Milestone 19); routes and records kept. |
| Settings: profile, experience, live tutoring (provider, model, encrypted key, fallback, limits, approval, recent runs), persona memory | yes | settings spec; provider-config tests | |
| Programmes (Mind, Brain and AI): catalogue, programme page with where to begin and the route by stage, block pages, follow, pause or leave, director routes with prerequisites and the focus change, programme map, paper seminar, missing sources as library leads | yes | route, next-step, progress and programmes tests; seed test; journey specs 09 and 10 | coverage per block, elective, method and source in MIND_BRAIN_AI.md; a director route made for an earlier focus is superseded, never applied. Hidden from navigation in the lean format (Milestone 19); routes and records kept. |
| Research studio: projects of five kinds, focused shelf, versioned proposal, methods and report, provenance, notebook, artefacts, feedback, oral discussion, Markdown report | yes | 15 core and 15 db tests; spec 10 (desktop + mobile) | feedback is structural checks in the scripted demo; no recruitment or new data from people; existing data about people only as its licence or terms permit. Hidden from navigation in the lean format (Milestone 19); routes and records kept. |
| Study defaults and obligations: rolling plan, explicit preferences, content sequence, appointments and deadlines kept apart | yes | study and planning tests; the study-defaults journey is skipped since Settings no longer offers the preferences | existing preferences are kept and still apply; the course page no longer previews a workload. Hidden from navigation in the lean format (Milestone 19); routes and records kept. |
| Security: unauthenticated matrix (including the studio), sandboxed file routes, blob key validation, Markdown sanitiser, Content-Security-Policy (HSTS in production), proxy-aware rate-limit keys, global pairing cap, UUID guards | yes | security spec (including a forged session cookie and sign-up after setup with the bootstrap code); blob, markdown and ownership tests | the journeys refuse to run against anything but a local stack in the scripted demo |
| Backup and restore | yes | 3 integration tests restore a snapshot with a 1 MB original into a fresh database; a restore drill on two scratch databases restored learning records and a permitted upload byte for byte (QA_REPORT, "Final acceptance") | `pnpm backup`, `pnpm restore <file> [--yes]`; `pnpm local:owner backup` for the owner's local installation; source bundles in `Documents/Corniversity-backups`; off-device copies and the hosted backup schedule are the owner's |
| Health checks (web reports not-ready until the schema carries this build's migrations; asset counts and prompt versions) | yes | security spec (`/api/health`) | `pnpm health` |
| Production build | pass on 11 Nov 2026 | 109 journeys pass at both sizes against the production build on a new, empty database (10 skipped: hidden features, and journey 16, which runs on its rehearsal stack) | `pnpm build` |
| Deployment (Dockerfiles, Railway config, deploy script) | deployed 1 Nov 2026; Milestone 10 released on 9 Nov 2026; the audit's fixes released on 10 Nov 2026 to the Railway project `corniversity` (worker and web from `40c2624`, migration 0007 applied); the teaching-experience brief released on 10 Nov 2026 (worker, then web, from `6850ec9`; migrations 0008–0012 applied); final acceptance released on 10 Nov 2026 (worker, then web, from `88e7ece`; migration 0013 applied) at https://web-production-4c692.up.railway.app | live: health with the asset diagnostic, the worker's log, production headers, robots, the public pages at both sizes, private routes refusing anonymous requests and a forged session cookie, a non-owner sign-up refused; nothing behind sign-in (QA_REPORT.md, "After the release") | images build on Railway (no Docker here); the owner account is still to be created; scripted demo until a key is added and paid use approved |

## Environment facts (verified 9 Nov 2026)

- Windows 11, Node v24.19.0, pnpm 12.16.1, Python 3.11.9 (no image library). Docker and psql absent; Railway builds the images.
- GitHub CLI authenticated (account Tensored-Flow); creating the private repository was blocked by approval controls, see USER_ACTIONS.md. The repository has no git remote.
- Railway CLI 5.66.0, signed in to the owner's Railway account; the repository folder is linked to the project `corniversity` (environment `production`; services `web`, `worker`, `Postgres`). No provider key; scripted demo only.
- Running a command inside a Railway container (`railway ssh`) was refused by this machine's approval controls; the deployed service is checked through its health route and logs instead.
- The Bash tool on this machine halves backslashes in command text and fails on heredocs with many apostrophes; files are written with the Write tool. Python's `write_text` writes CRLF here; files are written as bytes.
- Next's Turbopack development server reloads pages in a loop on this machine, so `pnpm dev` runs the webpack development server.
- Vitest ignores `fileParallelism` in a project's own config, so the root scripts pass `--no-file-parallelism` for the worker and database projects, whose files share one database.

## Blocked (owner action required)

See [USER_ACTIONS.md](USER_ACTIONS.md): creating the owner account on the hosted site, then
retiring the bootstrap code; choosing who teaches (an Anthropic key on the hosted site, or the
owner's ChatGPT plan in the local installation); the owner acceptance journey (item 4), because
the build agent cannot sign in as the owner or as their ChatGPT account; backups off this computer
and the hosted backup schedule (item 5); optional GitHub publish.

## Resume checkpoint

Local stack: `pnpm db:local` (window 1), `pnpm dev` (window 2). Owner account on the local
database was created by the e2e tests with the test password in `tests/e2e/helpers.ts`; run
`pnpm owner:reset-password` to choose your own. The owner's own local installation is separate:
`pnpm local:owner` (database `corniversity_owner`, http://127.0.0.1:3300); never run the journeys
against it. Journey 16 needs a rehearsal stack with `CHATGPT_PLAN_AUTH_BASE` and
`CHATGPT_PLAN_API_BASE` pointing at the test double's port (`E2E_CHATGPT_PLAN_FAKE_PORT`) and is
skipped on the ordinary stack. Playwright signs in once per run through
`tests/e2e/auth.setup.ts`.

Live site: https://web-production-4c692.up.railway.app. To ship a change, commit it and run
`railway up --service worker --ci`, wait for its migrations and seed, then
`railway up --service web --ci`, from the repository root, which is linked to the
`corniversity` project. `pnpm deploy:railway` creates a new project with new secrets and refuses
to run in a linked folder; it is for a first deployment only.

The teaching-experience brief is complete (Milestones 11–17) and released on 10 Nov 2026 from
`6850ec9`; the plan and gates are in PLAN.md, the requirement rows in TRACEABILITY.md (second table).

Owner actions: the steps in USER_ACTIONS.md. When the owner reports the checklist's results,
record them in QA_REPORT.md as checks the owner ran on the live site; check from outside that a
sign-up answers "Sign-up is closed" and that `OWNER_BOOTSTRAP_CODE` is gone from both services
(variable names only); and read the worker's log for the assessment runs.
