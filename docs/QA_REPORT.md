# QA report

Separates automated software checks, fixture tests, live-model checks, source verification and
academic uncertainty. Nothing below is claimed until the command and result are recorded.

## Software checks

All runs on 30–31 October 2026, Windows 11, local embedded PostgreSQL, fixture AI provider.

| Check | Command | Result |
|---|---|---|
| Lint and format (Biome, code only; content and docs excluded) | `pnpm lint` | 0 errors, 0 warnings, 1 info |
| Type check (7 packages) | `pnpm typecheck` | pass |
| All unit and integration projects | `pnpm test`, `pnpm test:integration`, `pnpm eval:academic` | 143 tests pass (31 Oct 2026, after the review repairs): unit 90 across core, ai, content, worker, companion and web (grounding with location-only labels, checks including the short-submission gate and scientific notation, verdict policy, learner-visible reference, locators, scheduler, laboratory mathematics, pricing, sanitiser, maths, chemistry, companion scanning and server-address rule); integration 34 in db (evidence, library boundary with ownership and re-extraction, revision intervals, blob store, backup format 2 into a fresh database, director conversation continuity); academic evaluations 19 |
| Content validation | `pnpm content:validate` | 0 errors, 0 warnings; 74 courses (12 launch, all teaching_ready), 125 units (31 prepared), 93 exercises, 27 sources, 894 verified locators, 11 personas |
| Seed | `pnpm db:seed` | all twelve launch courses seeded; re-seeds create new course versions only when content changed |
| Journey 1: arrival, bootstrap, closed sign-up, resumable onboarding, unauthenticated refusal | `tests/e2e/01-arrival-and-onboarding.spec.ts` | all 30 journey tests in specs 01–08 pass at 1440×900 and all 30 at 390×844 (31 Oct 2026, after the review repairs; plus the shared sign-in setup) |
| Journey 2: enrol, attempt, feedback, revision, persistence, tutor turn | `tests/e2e/02-functional-analysis-loop.spec.ts` | 2 passed on desktop and on mobile; both branches assert the withheld fixture verdict and that no "Accepted" label appears |
| Journey 3 (orientation) and the catch-up surface: steps 2–12, welcome, timetable, ICS, token refusal | `tests/e2e/03-onboarding-to-timetable.spec.ts` | 2 passed on desktop and on mobile |
| Journeys 5 and 6 and the library acceptance (companion pairing, deduplication, local-only, upload, extraction with printed labels, passage question, corrupt and fake files, unauthenticated access) | `tests/e2e/04-library.spec.ts` | 5 passed on desktop and on mobile |
| Journeys 3 (chemistry laboratory) and 4 (neuroscience laboratory), norm laboratory gating, notebook, records with a worker-built export, instructor-material leakage check, revision section | `tests/e2e/05-laboratories-and-records.spec.ts` | 7 passed on desktop |
| Journey 8 (bounded discussion with labelled classmates, nothing unprompted), mute, quiet mode, settings | `tests/e2e/06-common-room-and-settings.spec.ts` | 4 passed on desktop |
| Security: unauthenticated pages redirect, private routes 401/404, health route minimal and reporting migration state, sign-up closed | `tests/e2e/07-security.spec.ts` | 5 passed |
| Accessibility (axe, WCAG 2.2 A/AA rules) on twelve main pages, both sizes | `tests/e2e/08-accessibility.spec.ts` | serious/critical: none after fixing text contrast, focusable scroll regions and (in the review) faded completed timetable rows; minor findings listed in the run output |
| Backup and restore | `pnpm backup`; `pnpm restore <file>`; `pnpm restore <file> --yes` into a throw-away database; `backup.test.ts` | earlier rehearsal: 65 tables, 2378 rows, 24 compared tables equal; format 2 (sidecar originals, text dates, snapshot, verified checksum) restores a snapshot with a 1 MB original into a freshly migrated database in the integration tests |
| Production build | `pnpm build` | pass on 31 Oct 2026: Next production build with every route server-rendered on demand; worker and companion bundles built |

Defects found and fixed by these checks (this round): the chemistry macro `\ce{…}` rendered as
text in the server bundle because rehype-katex used a separate KaTeX instance from the mhchem
registration (now rendered by the app's own plugin); the records transcript read units from the
enrolment's original course version and so showed "0 of 0 prepared" after a re-seed (now reads the
current version, as study sessions do); the light `--ink-3` token missed WCAG AA contrast (4.1–4.4:1;
now ≥4.8:1); scrollable command blocks were not keyboard-focusable; the `AiLabel` prop collided
with the ARIA `role` attribute; several test-only issues (shared sign-in state leaking into
"anonymous" contexts, duplicate corrupt-file bytes deduplicated onto an earlier rejected item).

## Academic evaluations

`pnpm eval:academic` — 19 cases pass (31 October 2026). They cover, among others: the expected `x^n` norm values; a correct proof in
different words passing the same deterministic checks as the reference; a finite collection of
examples failing; the over-generalised equivalence claim triggering the objection and the
over-generalisation fixture; every authored check example for MAT-230, PHY-240 (signature
conventions), CHE-101 (kinetics numbers), CSA-210 (leakage, baseline) and NEU-220 (synthetic data
must be named); a fabricated citation removed and recorded as uncited; evidence blocks carrying no
URLs or page numbers. The set states which evaluations need a live model or a human reviewer and
does not claim them: novel proof structure judged by a live assessor, lecturer adaptation to a
weak-prerequisite route, conflicting conventions in a live explanation, handwritten transcription
confirmation (image upload not implemented), a peer refusing an unreleased solution (the peer
prompt forbids it; untested against a live model).

## Journeys not automated

Journey 7 (missed sessions → bounded recovery plan → clash-free calendar) is implemented in
`services/timetable.ts` (`proposeCatchUp`, `decideProposal`) and surfaced on the Timetable page,
but the end-to-end test would need planned sessions in the past; the onboarding term starts on a
future Monday. Verified manually in Milestone 3 against a plan whose sessions were moved into the
past; recorded here as manual, not automated.

Journey 9 (provider failure and budget exhaustion leave notes and reading usable) is covered in
part: journey spec 10 chooses a live model that cannot run and checks that the tutor refuses with
the reason and keeps the learner's message; budget decisions, the error kinds and the refusal
path are unit and integration tests. Exhausting a real budget needs a live provider, and no live
provider has been exercised.

Journey 10 (deployed site) is not automated. Against a non-local site the journeys refuse the
default test password, so they cannot create or use the owner account there. The checks run on
the live site are listed under Deployment.

## Source verification

All 27 source records were opened by the authoring agents on 30 October 2026 with the pages and
PDFs listed in each record's `componentsSeen` and the gaps in `limitations`. Notable findings:
OpenStax Chemistry 2e states CC BY-NC-SA 4.0 with an AI-ingestion restriction (reference-only,
never passed to a model); author-hosted notes without a licence (Gudmundsson, Hitchin, Tao, Tong,
Carroll, probmods.org) are reference-only; Taylor & Wheeler's *Spacetime Physics* is CC BY 4.0 by
the authors' statement. See docs/SOURCE_REGISTRY.md.

## Live-model checks

None performed (no provider configured). The live path has been exercised only against local
servers that speak the documented wire format (the provider contract test and the worker
assessment test), which check what the application sends and records, never how a model answers.
The first live check is the owner's checklist ([USER_ACTIONS.md](USER_ACTIONS.md), item 4).
Fixture runs are not live checks: the worker withholds
every fixture verdict (`needs_review`, confidence at most 0.5) and the feedback card says that no
model has read the submission, so no fixture run can produce an acceptance or a "demonstrated"
evidence state. The fixture texts describe what the automatic checks found and what a live
assessor would still have to read; they do not assert anything about the argument itself.

## Visual QA

Screenshots at 1440×900 and 390×844 are in `docs/qa/screenshots/` (01–35: arrival through
settings). Inspected in this round: the reading room (page text, printed label badge, search
highlight, notes and passage question), the kinetics laboratory (chart, readouts, unstable-step
flag, report prompt and workbench), the records page, an open discussion and the notebook. Defects
found and fixed from the inspection: chemistry macro rendering, transcript version resolution,
an `exercise kind` badge showing an underscore. Known cosmetic point: extracted PDF text keeps the
PDF's line breaks, which is deliberate (the source view is one click away) but reads unevenly.

## Deployment

Status: **deployed** on 1 November 2026 to a dedicated Railway project, `corniversity`
(PostgreSQL, web, worker), at https://web-production-4c692.up.railway.app. Checked on the live
site:

- `/api/health` reports the database and the migrations current.
- The worker's log shows the migrations applied, with pgvector enabled, and 86 course versions
  created by seeding on start.
- The Content-Security-Policy's `script-src` is `'self' 'unsafe-inline'`, without `unsafe-eval`,
  and HSTS is sent (`max-age=15552000; includeSubDomains`).
- `robots.txt` disallows every crawler.
- A headless browser loaded the arrival page, the tour, sign-in and the join page with no policy
  refusal, console error or page error. The join form accepts typing; nothing was submitted.
- `/join` offers *Create the owner account*. The account itself is the owner's to create.

Not checked on the live site: anything behind sign-in, including the fixture tutors. The
container's files were not listed, because running a command inside it was refused by this
machine's approval controls; the fixture folder's presence rests on the identical local
production build below.

**Production web build (1 November 2026).** The first deployment served the development
security policy, with `unsafe-eval` and without HSTS, because Next fixes headers when the app is
built and the image was built in local mode. The image now builds with
`CORNIVERSITY_BUILD_TARGET=production`. The standalone build also lacked the fixture folder,
which the AI package looked for beside its source, so fixture tutors and classmates could not
answer. The build now carries `packages/ai/fixtures`, and `findFixtureRoot` also looks for it
from the working directory (4 tests). With both repairs, all 35 desktop journeys pass against the
production build served locally, and a sweep of 24 pages and 3 study sessions under the
production policy found no refusals.

**Fresh-deployment rehearsal (1 November 2026).** The production web build and the worker ran
against an empty database, in local mode because production mode refuses an `http://` sign-in
address. The run went as follows:

- The worker applied the migrations and seeded all 86 courses on start.
- The web health check reported the database and migrations current.
- A browser created the owner account through the real join page with the one-time code and
  landed on orientation.
- From there the browser checked the catalogue, followed the programme, took a course and
  opened its first session, rendered the nine main pages, and signed out and in again.
- Sign-up was closed afterwards.

The rehearsal found that `Dockerfile.web` copied an `apps/web/public` folder that did not exist,
which would have failed the image build. The folder now holds a `robots.txt` that keeps search
engines away. Seeding on start was added because nothing else would have loaded the catalogue
into a new database.

Deployment files: `Dockerfile.web`,
`Dockerfile.worker`, `infra/railway.web.json`, `infra/railway.worker.json`,
`infra/deploy-railway.ps1` (`pnpm deploy:railway:plan` prints its plan without a login; it runs under Windows PowerShell 5.1 as well as PowerShell 7). Railway builds both images; Docker
is not installed on this machine. Estimated running cost on Railway's Hobby plan (pricing page read on
31 Oct 2026): $5 a month, which includes $5 of usage; usage is billed per second at about $20 per
vCPU-month, $10 per GB of memory-month and $0.15 per GB of volume-month. Three mostly idle services
(web, worker, Postgres) at roughly 0.8–1.5 GB of memory and a small fraction of a vCPU come to
about $10–25 a month in total; stopped services cost nothing. Model usage is separate and capped
by the budgets in Settings (pricing table `packages/ai/src/pricing.ts`, version anthropic-2026-10-06:
the default model at $4 per million input tokens and $20 per million output tokens, so a typical
tutor turn of a few thousand tokens costs about a cent).

## Independent review (Milestone 8)

Three review passes ran on 31 October 2026 as independent agents with read-only briefs: a
sceptical learner driving the running application through Playwright at 1440×900 and 390×844, an
academic assessor recomputing the taught material and reading the assessment code, and a production
engineer probing the local server and reading the deployment path. Their reports are summarised
here with what was repaired; nothing below was taken on trust from the build itself.

### Sceptical learner: 20 findings, all repaired

- The development server reloaded every page about nine times a second. Cause: Next's browser
  console forwarding writes a log under `.next` on each page load and the page was treated as
  changed, so the client reloaded on an HMR version mismatch, which logged again. Forwarding is
  now off (`experimental.browserDebugInfoInTerminal: false`); a page loads once (probe: 1 load,
  0 compiles in six seconds, where it was 41 and 40). The production server has no watcher.
- The Director of Studies conversation started afresh on every visit, so replies vanished:
  session-less conversations now continue (integration test `tutoring.test.ts`).
- A draft typed for one exercise appeared in, and was saved under, the next: the workbench is
  keyed per exercise.
- "Needs review" feedback promised a later assessment and a regrade that nothing performed: a
  regrade request now queues a real re-assessment of the same submission, and the fixture copy
  promises only that.
- Malformed ids crashed pages with a 500: every id-keyed service answers "not found" for anything
  that is not a UUID.
- Phones: the primary navigation wraps and includes the Catalogue and the Director; the sync page
  no longer scrolls sideways; timetable controls are tap-sized; the orientation step numbers are
  legible; the unit page's objectives no longer overflow.
- Work is tied to the timetable slot that asked for it: opening material from the campus or the
  timetable links the learning session to the slot, which becomes "attempted" on start and
  "completed" when the material is marked done.
- Reading-room notes appear in the Notebook with a link to their page; a notebook entry needs a
  body; the focus ring is visible on filled buttons; the practice-mode reveal shows the reasoning
  only (grading notes, acceptance ranges and "instructor only" headings are removed; unit-tested in
  `reference.test.ts`); the Markdown export lists every attempt with its outcome, and every appeal
  and regrade; society cards describe what the system does; session titles no longer read as two
  titles; the campus map wraps the long hall name; portfolio excerpts render their mathematics;
  the "Laboratory: Laboratory:" prefix and the duplicate course keys are gone; an unknown department
  in the catalogue says so.

### Academic assessor: 11 findings, all repaired

- Blocker: in fixture mode a two-formula answer was "Accepted" with confidence 0.82, fabricated
  feedback and a "demonstrated" evidence state. The worker now withholds every fixture verdict
  (`reconcileVerdict`: `needs_review`, confidence at most 0.5, an explicit note), the three
  scripted fixtures describe only what the automatic checks found, and no fixture run can reach
  "demonstrated" (unit tests in `verdict.test.ts`; evaluation cases in the academic set; journey 2
  now asserts the withheld verdict in both branches).
- Content: the NEU-220 sub-threshold formula sign (`−60 − 10e^{−t/10}`), the CHE-101 free-fall
  collapse time (about 2×10⁻¹⁷ s under the Coulomb force; 10⁻¹⁰ s is the radiative figure), the
  propane molar mass (44.09), Proxima Centauri's distance (about 4.25 ly, the book's 1992 figure
  noted), the NEU-220 failure-set description, and CSA-210 unit 1, whose activity and check
  evidence described a feature-selection experiment the laboratory does not run and now describe
  the leakage audit it does.
- Tutor citations: a paragraph that cites only location pointers (no passage text) can no longer
  carry the source-backed label; it is labelled "location cited, text not seen" (test in
  `citations.test.ts`), and the prompts say so.
- Automatic checks: absence checks refuse to pass on a submission too short to hold an argument;
  lists of instances are counted ("n = 1, 2, 3", a leading "Suppose" no longer counts as a general
  argument); a required hypothesis must sit near the claim (three sentences before to one after,
  or document-wide where a check says `scope: anywhere`); numeric checks read scientific notation
  and the Unicode minus. The validator's 187 authored examples still behave as declared; the
  evaluation set grew from 13 to 19 cases that exercise these rules and the verdict policy.
- The readiness ladder's substantive checks are described as the author's self-review in the
  academic model and status; the course foyer shows how many units are prepared beside the badge.

### Production engineer: 18 findings; 15 repaired, 3 recorded

- Repaired: the post-deploy hint that would have created the production owner with the committed
  test password (removed; the journeys refuse the default password against a non-local site);
  backups stream stored originals to sidecar files and travel dates as text (format 2, snapshot
  read, verified checksum; `backup.test.ts` restores into a fresh database); the assessor checks the
  budget and unknown models are priced at the dearest known rate; re-extraction no longer strands
  an item in "processing"; the worker honours Railway's `PORT` and starts tsx directly in its
  image; a failed queue start is retried rather than cached; the web health check reports
  not-ready until the schema carries this build's migrations; the demo seed refuses production and
  only an owner account closes sign-up; a Content-Security-Policy and (in production) HSTS are
  sent and the sanitiser allows only the renderer's class names; permission changes and reading
  progress check ownership; withdrawing private storage removes the stored copy at once; exports
  expire after thirty days; services restart always; the companion refuses plain http to a remote
  server; the unused concurrency setting is gone; a Railway process must not run in local mode;
  rate limits key on the proxy-appended client address and pairing has a global cap; error pages
  exist for a failing page and a failing root.
- Recorded, not repaired: sign-in rate limiting remains per client address (a per-account counter
  is not implemented; passwords are at least twelve characters and scrypt-hashed); the provider key
  is encrypted with a key derived from `BETTER_AUTH_SECRET`, so rotating that secret makes the
  stored key unreadable and the app falls back to fixtures (re-enter the key in Settings); base
  images use floating `node:22-alpine` tags and the Dockerfiles have not been built here.

## Milestone 9: the Mind, Brain and AI update

All runs on 31 October 2026, Windows 11, local embedded PostgreSQL, fixture AI provider, webpack
development server. The requirement-by-requirement classification is in
[MIND_BRAIN_AI.md](MIND_BRAIN_AI.md).

| Check | Result |
|---|---|
| Content validation | 0 errors, 0 warnings: 86 courses (12 launch, all teaching_ready; COG-250 and COG-260 source_verified), 141 units (33 prepared), 99 exercises, 59 sources, 1121 verified locators, 7 programmes, 12 programme blocks, 8 electives; every authored check example behaves as declared |
| Seeding | the first seed after the update created the new course versions and a second seed created none; the worker's seed test proves this against the real catalogue and keeps enrolments and programme participation |
| Type check, lint | pass in all 7 packages; Biome clean |
| Unit tests (`pnpm test`) | 143 pass in 19 files, including the two new laboratories, study preferences and obligations, block readiness and shared units, the seed test and the new validator rule |
| Integration tests (`pnpm test:integration`) | 46 pass in 8 files, including programme participation and study preferences against PostgreSQL |
| Academic evaluations (`pnpm eval:academic`) | 19 pass |
| Journeys, desktop 1440×900 | 35 pass in 2.6 minutes, including the five journeys of spec 09 and the axe accessibility checks on twelve main pages |
| Journeys, mobile 390×844 | 35 pass in 2.9 minutes, including spec 09 and the accessibility checks |
| Production build (`pnpm build`) | pass |

**Journey environment.** The journeys ran against a freshly started webpack development server
whose routes had been visited once. On a development server that had hot-reloaded for hours,
pages took 10 to 20 seconds to compile and were discarded again after a minute, so three
navigations per run outlasted the journeys' 10-second waits. A fresh server compiles each page in
0.5 to 5 seconds, and `next.config.ts` now keeps compiled pages for the whole session.

**Journey spec 09** covers the update end to end:

- discovering, inspecting and following the programme without enrolling;
- the director's route confirmed with a focus set and no enrolment;
- COG-260's laboratory refusing a one-line prediction and keeping results hidden until a prediction is saved, then running model recovery and a held-out comparison whose contract is shown;
- COG-250's laboratory after an announced revaluation;
- deadlines kept apart from appointments, a milestone that is not binding, and switched-off deadline kinds that cannot be chosen.

**Independent review of the two new units.** A fresh reviewer read both units, their laboratories and the seven source records cold. It reproduced every number with the library code and ran sample answers through the real checker. It reported 3 blocking findings, 15 to fix and a list of minor ones. All blocking and should-fix findings were repaired:

- **Biased responding.** The lesson's prediction for biased responding was false: split by reward alone, its repeat probabilities differ whenever $b\neq\frac12$. The laboratory now reports the split by previous arm as well.
- **Episode values.** COG-250's exit exercise asked for values the laboratory showed only as plot lines. Every plot now lists its values, and the planning laboratory prints every episode.
- **Exercise 3 rubric.** It misread its own invented report as an in-sample comparison.
- **Contract order.** The held-out contract appeared after its numbers; it is now shown before anything is run.
- **Missing controls.** Validation by simulation and design changes were asked for but could not be run; the laboratory now has both.
- **The ambiguous case.** The lesson credited it to the short session and close arms. Model recovery shows the participants' region drives it. Over seeds 1 to 5, Rescorla-Wagner was recovered as itself 19 times in 100 as built, 13 with arms 0.2 and 0.8, 42 with 300 trials and 79 with the informative region.
- **Default participant.** The ambiguous case's default participant was not ambiguous.
- **Leaked results.** The lesson stated results before learners predicted them.
- **Shortcut claims.** They were too strong: the cached policy can find the opening by exploration, drawn in by its untried values.
- **Converged training.** The first-move diagnostic needs converged training, and the unit now says so.
- **Automatic checks.** Two of COG-250's checks marked a wrong tie-break right and rejected "2.5%".
- **Smaller errors.** A grading note's arithmetic, a tolerance that rejected 0.68, and two lists that rendered as one were corrected.

**Defects found and fixed during the milestone.**

- **Choice laboratory.** Its held-out comparison drew the ambiguous case's participants from the broad region (test added).
- **Tuning laboratory (NEU-220).** It held out two fixed orientations rather than trials of every orientation, so its held-out comparison was an extrapolation test (test added). Its instructor margin, an estimate of 0.5 to 1 nats, was replaced by the computed 11.9.
- **Course helper.** The journeys' take-course helper never completed an enrolment that needed the workload preview, because the word it waited for is also a radio label.
- **Reading-room race.** The reading-room journey selected text before the page had hydrated.
- **Catalogue count.** The catalogue counted only teaching-ready courses as having prepared units.
- **Method mapping.** NEU-220 unit 2 was mapped to a method it does not teach. The validator now refuses a method mapped to a unit that does not teach its concept.

## Milestone 10: sections 13 to 20 and the live product

All runs on 9 November 2026, Windows 11, Node 24.19, local embedded PostgreSQL 17, scripted demo
(no model provider). Three environments are kept apart below: the development server, a local
production build against new empty databases, and the deployed site. The requirement-by-requirement
status is in [MIND_BRAIN_AI.md](MIND_BRAIN_AI.md).

| Check | Command | Result |
|---|---|---|
| Content validation | `pnpm content:validate` | 0 errors, 0 warnings: 86 courses (12 launch, all teaching_ready; COG-250 and COG-260 source_verified), 141 units (33 prepared), 99 exercises, 59 sources, 1121 verified locators, 7 programmes, 12 blocks, 8 electives |
| Coverage tables | `pnpm content:coverage`; `coverage.test.ts` | regenerated; the test fails when the committed tables differ from the catalogue |
| Seeding | `pnpm db:seed` on the development database; `seed-idempotence.test.ts` | the NEU-220 change created one course version and left 85 unchanged; the seed test proves a second seed creates nothing and keeps learner records |
| Type check, lint | `pnpm typecheck`, `pnpm lint` | pass in all 7 packages; Biome clean apart from one notice that its configuration can be migrated |
| Unit tests | `pnpm test` | 253 pass in 32 files |
| Integration tests | `pnpm test:integration` | 80 pass in 12 files, against throw-away PostgreSQL clusters |
| Academic evaluations | `pnpm eval:academic` | 19 pass (check rules and verdict policy; no model's judgement) |
| Provider contract | `packages/ai/src/anthropic.contract.test.ts` (in `pnpm test`) | 13 pass: the real SDK against a local HTTP server speaking the documented wire format (streaming, structured output, server-side fallback attempts, refusals, truncation, seven error kinds). It proves the request shape and the error mapping, not that Anthropic answers |
| Journeys, development server | `pnpm test:e2e` (desktop 1440×900, mobile 390×844) | the last full run passed 84 of 85; the one failure was a real accessibility defect, repaired and re-checked at both sizes (below) |
| Production build | `CORNIVERSITY_BUILD_TARGET=production pnpm --filter @corniversity/web build` | pass: every route server-rendered on demand, no warnings; the standalone server carries the scripted-response folder |
| Journeys, production build on an empty database | three runs, each on a new database (below) | the final run passed 85 of 85 in 2.5 minutes, at both sizes, with nothing skipped |

**Development-server runs.** The development server and worker were restarted before the runs
(the old server had been hot-reloading for hours) and the main routes were requested once. The
first full desktop run passed 33 of 37 tests. The four failures, and what was done:

- *Orientation (spec 03).* The test took a visit to step 2 as proof that orientation was
  unfinished, so on a completed account it replayed orientation, which before this milestone
  withdrew enrolments made since. Step 2 now only follows newly chosen programmes, so the test
  stopped there. It now asks the campus whether orientation is finished, as spec 01 does, and on
  a new account also chooses the programme during orientation.
- *Tuning laboratory (spec 05).* The held-out row's label changed from "held out" to "held-out
  trials (n trials)". The test now also switches to the held-out-orientation split, checks each
  contract's task row, and checks that bootstrap intervals computed for one split are not shown
  against the other.
- *Settings (spec 06) and provider failure (spec 10).* "Scripted demo" matched the state notice
  and every row of the recent-runs table; the assertions now target the notice. A rerun then
  showed that the blocked notice is an alert, not a status, and the test was corrected.

The failed tests passed on rerun. A full run of both viewports then passed 84 of 85. The failure
was the axe sweep at 390 px: the new recent-runs table in Settings scrolls sideways on a phone
and could not be reached by keyboard (`scrollable-region-focusable`, serious). After that repair
the sweep reached the programme page, newly added to it, where the methods table had the same
defect from Milestone 9; both containers are now focusable labelled regions, and the sweep passes
on all 15 pages at both sizes. No test was skipped and no timeout was raised.

**Production build on an empty database (clean start).** The production web build ran as its
image runs it (the standalone server with its static files), and the worker ran from source with
`tsx`, as its image does, both against a new database in the local cluster, with freshly generated
local-only secrets, in local mode on ports 3200 and 3201 (production mode refuses an `http://`
address). On each start the worker logged the migrations applied, all 86 course versions seeded,
and "7 of 7 scripted responses load" with the six prompt versions; the health route reported the
schema current and the same asset counts; the pages carried the production policy (`script-src`
without `unsafe-eval`, HSTS). The owner account was created through the real join page each time.

- *First run* (database `corniversity_clean_20261109a`): 51 passed, 12 failed, 22 did not run.
  - **Product defect.** Choosing Mind, Brain and AI during orientation added its departments, so
    the default plan took NEU-220 as its lighter course in reading-seminar mode, which NEU-220
    does not offer; step 9 then failed with an unhandled `EnrolmentError` and showed the error
    page. It had stayed hidden because no journey had chosen a programme during
    orientation before. Plans now propose only modes a course offers, falling
    back to the nearest lighter one (`offeredMode`), and a refused mode returns to step 9 with a
    notice; the worker's seed test now checks every plan against the real catalogue.
  - Two assertions in spec 02 depended on data left on the development database: "demonstrated"
    on My Studies, which no withheld verdict can produce (the old value predates that rule), and
    "source-backed", which needs the library to hold the passage's text (on a new database the
    tutor honestly says "location cited, text not seen"). They now check what holds on any
    database.
  - Spec 04 paired the companion with a fixed `http://localhost:3000`; it now uses the run's server.
  - The other failures followed from the unfinished orientation.
- *Second run* (rebuilt; database `corniversity_clean_20261109b`): 73 passed, 2 failed, 10 did
  not run. The journey helper that takes a course in full stopped at an existing enrolment, and
  orientation's plan had now (correctly) chosen to audit NEU-220, so its laboratory could not be
  attempted. The helper now changes an audit or reading seminar into a full enrolment as a learner
  would, by withdrawing and taking the course again. Spec 05 then passed in full at both sizes
  (14 journeys).
- *Third run* (same build; database `corniversity_clean_20261109c`): 85 passed in 2.5 minutes,
  at both sizes, nothing skipped, including a new learner choosing the programme during
  orientation and every journey of spec 10.
- *Fourth run* (rebuilt with the studio fix described below; database
  `corniversity_clean_20261109d`): 85 passed in 2.4 minutes.

The four rehearsal databases remain in the local cluster; they hold only test data.

**Release to Railway (9 November 2026).** Before releasing, `railway status` showed the linked
project `corniversity` (environment `production`; services `web`, `worker` and `Postgres` with its
volume), and the working tree was clean at commit `1b93eae`. The three new migrations only add
columns, one unique index and seven tables; the production database held the seeded catalogue and
no learner data, since no account exists there.

- *Worker first* (`railway up --service worker --ci`, from `1b93eae`). Its log shows
  `migrations ok (pgvector on)`, `content seeded: 1 course versions created, 85 unchanged` (the
  NEU-220 change) and `AI assets: 7 of 7 scripted responses load` with the six prompt versions.
  While the old web build still served, its health check stayed current.
- *Then web* (`railway up --service web --ci`). The health route reports the schema current and
  `aiAssets` with "7 of 7" and the six prompt versions.
- *Checked on the live site without an account:* the production policy (`script-src` without
  `unsafe-eval`; HSTS); robots.txt disallows every crawler; the arrival, tour, sign-in and join
  pages load at 1440 and 390 px with no console error, page error or policy refusal; `/join` still
  offers *Create the owner account*; `/studio`, `/programmes`, a block page, `/settings` and
  `/campus` redirect to sign-in; the studio and tutor APIs answer 401; a sign-up with an email
  that is not the owner's was refused with 403 and created nothing (the join page still offers the
  owner account afterwards).
- *One defect found there:* `/studio` redirected to sign-in without its return path. It was fixed
  in `6a01e17` (web only), the 85 journeys passed again against the rebuilt production build on a
  new database, and the web service was released again; `/studio` now redirects to
  `/sign-in?next=%2Fstudio`.
- *Not checked on the live site:* anything behind sign-in (the scripted tutors, the studio, the
  laboratories), because the owner account does not exist; live tutoring (no key, no approval);
  the recovery command, which would run in the worker's shell (this machine's approval controls
  refuse to open one) and needs an owner.
- *Running now:* the worker built from `1b93eae` and the web service from `6a01e17`; the
  worker's code is the same in both commits.


**Defects found and fixed during the milestone.**

- **Orientation with a programme.** The plan could propose a mode its course does not offer, and
  the step then crashed (above).
- **Accessibility.** Two tables that scroll sideways on a phone could not be reached by keyboard.
- **Block pages.** "Missing resources" listed only the block shelf's own leads, of which there are
  none; it now lists the leads recorded by the courses the block maps, with the library link. On
  a phone the next step came after ten screens of detail; it now comes first.
- **Settings.** The provider select and its card shared the id `provider`, so the "Provider"
  label pointed at the card, not the control.
- **Scripted texts.** The scripted replies called themselves "fixture" turns and the withheld
  verdict said "fixture provider", jargon beside labels that say "scripted demo"; they now say
  scripted demo.
- **Asset diagnostic.** It did not report the studio supervisor's prompt version.
- **Tuning laboratory.** The training-mean plot drew a zero at an orientation with no training
  trials, and bootstrap intervals stayed on screen after the data or split they described had
  changed.
- **Studio sign-in return.** `/studio` was missing from the proxy's private paths, so signing in
  from it landed on the campus (found on the live site; fixed and released).
- **Studio copy.** "A computational modelling needs at least 1" now names a project and its
  verified sources.
- **Journey helpers.** `takeCourse` read the course page's new workload preview as the
  enrolment's heavier-load confirmation, and did not take a course in full when it was audited.

**Visual review.** Screenshots inspected on 9 November: at 1440 px, the block page (readiness and
progress kept apart, prerequisites rule by rule, missing resources with the library link), the
studio project (versions, provenance, artefact, feedback labelled "Scripted demo: no model read
this"), the director's route proposal (focus unchanged, each course's action, what is still to
prepare), the tutor panel with a blocked live model ("model blocked" label, the reason, the
learner's message kept), settings and the tuning laboratory; at 390 px, the block page (the
defect above) and the studio project's forms.

## After the release: test audit, fixes and the owner's checks (9–10 November 2026)

**The live site, checked from outside without an account (9 Nov 2026, 23:31 UTC).** The health
route reports the database ok, the migrations current, `aiAssets` "7 of 7" and six prompt versions.
`/join` still offers *Create the owner account*: the owner account does not exist, so nothing behind
sign-in can be checked. Railway variables, read by name only (no value was printed):
`OWNER_BOOTSTRAP_CODE` is still set on web and worker, as expected before setup; there is no
`ANTHROPIC_API_KEY` (a key is entered in Settings and stored encrypted with `BETTER_AUTH_SECRET`);
`BETTER_AUTH_SECRET` is the same on both services (compared inside one process), so the worker can
read a key saved through the web; `AI_PROVIDER` is `fixture` on both, and the owner's saved choice
overrides it; `BLOB_STORE` is `pg` on both, so the worker reads imported files from the database.

**The live provider against the current Claude API reference (read 9 Nov 2026; a static review, no
request sent).** The model ids and the price table match for all seven priced models (including
Claude Opus 5.5 cache reads at $0.20 and Claude Fable 5.1 at $0.25). `fallbacks: "default"` goes
with `server-side-fallback-2026-07-01`, the documented pairing, and is never sent for Claude Haiku
5.5, which has no server-side fallback. The fallback targets used for the worst case are the
documented ones; `output_config.effort` is valid for every supported model; SDK 1.3.0 sends its
default API version, which is still accepted; the assessor's structured-output schema as sent has
one nullable union and no optional fields, the supervisor's none. What only a real call shows (the
key's access to the chosen model, real answers, refusals) is left to the owner's checklist.

**Independent audit of the tests.** Two reviewers with no prior context read the owner's sections 13
to 18, the tests and the code they exercise, and reported where an assertion did not encode a rule
or the code broke one (about 28 findings). Every finding was checked against the code before
anything changed: most were confirmed, the COG-260 finding was narrowed (its likelihood rule is
mathematics, but its own guidance asks for model fitting) and MBI-08's biology was left as a
recorded gap (below). The fixes, each with a test that fails on the code before it where one could:

- *Spending.* A reply the learner abandoned mid-stream was never recorded, so spend could be
  undercounted: the turn now runs to its end and is recorded (stream test). A stream that failed
  after it started recorded no usage: what it reported is kept (contract test). Runs started
  together were each checked against recorded spend only: a live run is now reserved at its worst
  case under a per-owner database lock and holds it until finished (reservation, recorded-spend and
  lock-wait tests; the lock-wait test fails without the lock). The worst case counts characters
  outside ASCII at their UTF-8 bytes and the fallback's continuation input, and the settings say
  that the prompt is an estimate.
- *Citations and retrieval.* Tutor retrieval required every word of a question to occur in one
  passage, so most natural questions retrieved nothing (four of six probe questions against a
  directly relevant passage): any word now matches, best matches first (ingestion test). Replayed
  history kept tags that a later turn renumbers: earlier tags are replaced by the sources they
  resolved to. A reading-room selection was labelled with its page without checking it was there.
- *Sign-up, isolation and recovery.* The closed-sign-up test never sent the bootstrap code: it now
  signs up after setup with the stack's real code, as the owner email and as another, and expects
  "Sign-up is closed". The account-creation hook assigned "learner" after setup instead of refusing:
  it refuses. A forged session cookie is tested against the server's own check; private routes must
  answer exactly 401. The journeys refuse to run against anything but a local stack, or with a live
  model configured. The recovery prompt let the line editor's redraw echo the password: the editor
  now writes only to a sink (prompt test). Sessions were cached in a cookie for five minutes, so
  "signed out everywhere" took up to five minutes: the cache is off.
- *Records.* Repairing an exercise overwrote the prompt and rubric an earlier attempt had been
  assessed against: each assessment keeps the exercise as answered (migration 0007, one nullable
  column), the worker assesses against it, and a regrade keeps it (worker assessment test). Only the
  prompt kept the assessor from quoting the reference solution: repeated runs of ten words are
  withheld (leakage tests). A saved prediction could be edited or deleted after the results, and an
  older note retagged as one: both are refused (prediction test).
- *The research studio.* Re-analysis of existing data about people was flagged as planning new
  collection, and the form said "published" where the owner's rule says "appropriately permitted":
  the check reads the learner's own plan sentence by sentence, the wording follows the rule, data
  collected from people can be stated and is refused rather than filed as none, and data about
  people needs a licence or terms that permit the analysis. An untouched template passed six of six
  checks: a section counts only with text. The report and the badges mislabelled failed and blocked
  supervisor runs.
- *Programme pages.* A block's next step spoke of missing sources where there were none, and MBI-12
  still said the studio was not built: the next step uses the block's leads, MBI-12 carries a studio
  flag and the stale gap is gone. COG-260's rule let measure-theoretic probability alone stand in for
  model fitting, against its own guidance: NEU-220 is now the bridge (seed test). An older director
  proposal could displace a newer focus: a new proposal supersedes older drafts and confirming
  checks the focus first (seed test). Orientation's rhythm step showed the original answers after
  Settings changed them: it shows the preferences as they stand (planning test). The tuning
  laboratory showed an empty held-out set as a comparison. Psych-101 is pinned as not importable.
- *The test harness.* Vitest ignores `fileParallelism` in a project's own configuration, so the
  database and worker test files, which share one database, ran in parallel; the root scripts now
  run them one at a time. A test counting every user failed intermittently because of it.

**Checks after the fixes (10 Nov 2026; scripted demo or a local imitation of the API).**

| Check | Result |
|---|---|
| `pnpm lint` | 0 errors, 1 info (the Biome configuration notice) |
| `pnpm typecheck` | 7 of 7 packages |
| `pnpm test` | 254 unit tests in 30 files (core 159, ai 59, content 18, companion 12, web 6), then 23 worker tests in 6 files |
| `pnpm test:integration` | 88 tests in 12 files |
| `pnpm eval:academic` | 19 |
| `pnpm content:validate` | 0 errors, 0 warnings; coverage tables regenerated |
| Journeys, production build, new database `corniversity_clean_20261110a` (retrieval and studio wording fixed, nothing else) | 85 passed |
| Journeys, production build, new database `corniversity_clean_20261110b` (every fix; migration 0007 applied from empty) | 87 passed in 2.5 minutes at both sizes, none skipped (two more than before: the forged-cookie test) |

Failures on the way, all repaired: the first concurrency test passed without the lock, because its
connection pool serialised the calls (replaced by the deterministic lock-wait test); a new
prediction test changed the state two existing tests expected (moved after them, with its own
laboratory tag); the user-counting test above; the cleanup order of the new worker test; type and
formatting errors caught by `pnpm typecheck` and `pnpm lint` before any run.

Visual check: on `47-studio-feedback-desktop.png` the feedback on an untouched proposal names its
empty sections, the people check reads "No plan to collect new data from people was found", and the
provenance text carries the licence wording.

**Not checked, and why.** Anything behind sign-in on the live site, live tutoring, and recovery on
the live site: the owner account does not exist, no key is stored, and this machine's approval
controls refuse a shell inside a Railway container. Those checks are the owner's checklist
([USER_ACTIONS.md](USER_ACTIONS.md), item 4); their results are recorded here when the owner
reports them, apart from the scripted and local checks above.

**Release (10 Nov 2026).** Before releasing, `railway status` showed the linked project
`corniversity` (environment `production`), the tree was clean at `40c2624`, and the live site still
offered *Create the owner account*. The worker went first (`railway up --service worker --ci`): its
log shows `migrations ok`, `content seeded: 0 course versions created, 86 unchanged` (the COG-260
rule and the MBI-12 change are upserted in place on every start, not as course versions) and the
prompt versions with `supervisor-1.1`. Then the web service: the health route reports the
migrations current, so migration 0007 is applied, and `supervisor-1.1`. Checked on the live site
without an account: the policy headers (no `unsafe-eval`; HSTS); robots disallow every crawler;
`/campus`, `/studio`, `/programmes` and `/settings` redirect to sign-in with their return path; a
forged session cookie is turned away by the server itself (`/campus` redirects to sign-in, the tutor
API answers 401); a sign-up with an email that is not the owner's is refused with 403 and "The owner
email or bootstrap code is not correct.", the answer before setup; the arrival, tour, sign-in and
join pages load at 1440 and 390 px with no console error, page error or policy refusal. The
browser's link prefetches return 200 and the router cancels some of them, which the page check
lists as aborted requests; a click on a prefetched link navigates on the client as it should.
Running now: the worker and the web service, both from `40c2624`.

## Teaching-experience brief: Milestones 11 to 14 (10 November 2026)

Local evidence only; nothing here has been released. Budget (Milestone 12): a strict prompt bound,
integer micro-dollar accounting, unsettled runs held at their worst case until the owner settles
them, idempotency keys and no SDK retries (provider-config tests, 20). Study continuity, paper work
and bridges (Milestone 13): journey 11 at both viewports, with a two-device draft conflict, an
offline save, a symbol that must be confirmed before submission and a withdrawn permission that
sends nothing. Issues, review, progressions and preparation (Milestone 14): journey 12 at both
viewports. Two test defects were found and repaired on the way: a submission wait that could read
the previous card's state, and a review test that unticked a box before React reset the form after
the first save. One product defect was repaired: after a submission the draft revision was stale,
so the next save reported a conflict. Issues are now proposed only by checks that look for an
error, after omissions produced noisy issues. Suites at the close of Milestone 14: 301 unit and 29
worker unit tests, 119 integration tests, typecheck and lint clean, the content validator with no
error or warning.

Voice and visual teaching (Milestone 15): journey 13 at both viewports and the axe pass over the
new pages. Both films were inspected frame by frame from the recorded files; that inspection
found a missing y-axis label and a recording longer than its storyboard (the extra time is a held
last frame, and captions are offset by the measured lead-in), and the label was added. A real
layout defect was found and repaired: on a 900-pixel-tall screen the sticky study panel grew taller
than the window once a tutor conversation was long, leaving the send button unreachable; the
panel now has its own scroll and the conversation a height tied to the window. Dictation in
automation uses a labelled stand-in for the browser's recogniser; real recognition is unverified.

Operations, proposals and discussion bounds (Milestone 16): journey 14 at both viewports, the axe pass
and the security journey over the new routes. Three defects were found before release: the
operations page counted outlined units by a status that does not exist (it read 0 of 108; it now
counts every unit that is not ready, and the journey requires a non-zero count); one write of the
publication step had escaped its transaction; and three classmates could join one discussion,
where the brief allows two.

Hardening (Milestone 17). An independent security review of the routes and services added in
Milestones 13 to 16 reported no high or medium findings and four low ones, all repaired with
regression tests: the PDF check now decodes #xx escapes in names and looks for more action types
(it remains a stated heuristic; PDFs are only downloaded, sandboxed, never sent to a model); JPEG
uploads keep only decoding segments, follow progressive scans and drop anything after the end
marker; publishing a draft and publishing a proposal are now conditional claims inside one
transaction, so a double submit publishes once and a failure part-way leaves nothing behind.
Migrations 0008 to 0012 are additive (the only data change maps two old issue statuses, scoped by
WHERE); the production build passes; a history-wide secret scan found only placeholders; the
source bundle was verified and cloned back.

The full journey suite (103 tests across both viewports) then ran: 95 passed and four tests failed
at both sizes. Two were journeys left behind by earlier milestones (the review section's new
wording; a catalogue total that grows when journey 14 publishes a proposal locally). Two were a
hydration race: text typed, or a selection made, before React attached its handlers was lost at
the next update. That is also a product risk on slow devices, so the tutor and attempt boxes now
adopt text typed before the page finished loading. A rerun then showed the notebook silently
listing only the 100 most recent of 133 entries; it now says so and points to search and filters.
After the repairs every failing journey passed at both viewports, and the unit (308), worker (36)
and integration (124) suites passed.

## Remaining defects

- The companion's `watch` mode has unit tests and a manual rehearsal against the development
  server (31 Oct 2026: paired through the root script, a text file dropped into `inbox/mathematics/`
  registered as a local-only companion item, the Library read "Desktop sync online" while the
  heartbeat ran and "Desktop sync offline" two minutes after it stopped). The Playwright journeys
  run `pair` and `sync` as child processes, not a long-lived `watch`, so only the rehearsal covers it.
- Live tutoring is unverified: there is no key and no approved test budget, and the provider
  contract test runs against a local mock. The modelling standard in the assessor and the studio
  supervisor's feedback are therefore checked as prompts only, never as a model's behaviour.
- Nothing behind sign-in has been checked on the live site, because the owner account does not
  exist yet; the journeys run locally. The clean-start rehearsal runs in local mode over `http`,
  so secure cookies and https-only behaviour are exercised only by the live site.
- The three items the production engineer recorded above (per-address sign-in limiting, the
  provider-key secret, floating base-image tags).
- The timetable-slot linking added in the review was exercised by hand (campus → open the
  material → mark as read → the slot reads completed) and by the service-level logic; no journey
  test covers it yet.
- COG-250 and COG-260 each have one prepared unit; their other seven units are outlines, and
  COG-100 has none. Blocks MBI-02, MBI-10 and MBI-12 are proposed, the eight electives are
  proposed, and method 9.6 (measurement, reliability and validity) has no prepared unit.
- Error text passed to a page in `?error=` is shown as given in the error notice. React escapes it,
  so it cannot run script, but a crafted link can make misleading text look like an app message.
- The PDF active-content check reads the file's uncompressed text; content inside compressed
  object streams is not seen. PDFs are therefore only offered as downloads under a sandbox.
- (Repaired in Milestone 13.) MBI-08 says its biology comes from MBI-02, but MBI-02's courses (NEU-101, NEU-201) and NEU-210
  are proposed with no concepts defined, so no biology prerequisite can be expressed yet; NEU-220,
  the block's teachable course, needs none (its Neuromatch spine asks for no biology).
- (Repaired in Milestone 12.) The worst-case estimate used to count ASCII prompt text at three
  characters a token, which symbol-dense text can beat; the bound is now a token per UTF-8 byte
  (see ARCHITECTURE.md, Budget, for the assumption it rests on), and uncertain failures stay
  unsettled at their worst case instead of being recorded at what was known.
- The studio's new-data check reads the learner's plan sentence by sentence and recognises the
  usual phrasings; a plan worded otherwise passes as "no plan found". The provenance form still
  refuses data collected from people, whatever the plan says.
- Spec 03's new-account branch runs once per run, at the first viewport, on a database that does
  not yet hold the account.
- One saved prediction opens a laboratory for its whole unit, so the choice-model activity asks
  for both cases' predictions before saving rather than enforcing one per case; *Predict again*
  resets the laboratory for the whole unit.
