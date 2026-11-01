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

Journey 9 (provider failure and budget exhaustion leave notes and reading usable) is covered at the
unit level (budget decisions, provider error path in every route returns a labelled note) and by
the fixture provider; no live provider has been exercised.

Journey 10 (deployed site) cannot run until the owner deploys.

## Source verification

All 27 source records were opened by the authoring agents on 30 October 2026 with the pages and
PDFs listed in each record's `componentsSeen` and the gaps in `limitations`. Notable findings:
OpenStax Chemistry 2e states CC BY-NC-SA 4.0 with an AI-ingestion restriction (reference-only,
never passed to a model); author-hosted notes without a licence (Gudmundsson, Hitchin, Tao, Tong,
Carroll, probmods.org) are reference-only; Taylor & Wheeler's *Spacetime Physics* is CC BY 4.0 by
the authors' statement. See docs/SOURCE_REGISTRY.md.

## Live-model checks

None performed (no provider configured). Fixture runs are not live checks: the worker withholds
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

Status: **not deployed**. The Railway CLI is installed but not logged in.

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

Prepared: `Dockerfile.web`,
`Dockerfile.worker`, `infra/railway.web.json`, `infra/railway.worker.json`,
`infra/deploy-railway.ps1` (`pnpm deploy:railway:plan` prints its plan without a login; it runs under Windows PowerShell 5.1 as well as PowerShell 7). The Dockerfiles have not been built
on this machine (no Docker). Estimated running cost on Railway's Hobby plan (pricing page read on
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

## Remaining defects

- The companion's `watch` mode has unit tests and a manual rehearsal against the development
  server (31 Oct 2026: paired through the root script, a text file dropped into `inbox/mathematics/`
  registered as a local-only companion item, the Library read "Desktop sync online" while the
  heartbeat ran and "Desktop sync offline" two minutes after it stopped). The Playwright journeys
  run `pair` and `sync` as child processes, not a long-lived `watch`, so only the rehearsal covers it.
- Deployment and live-provider behaviour remain unverified until the owner supplies credentials.
- The three items the production engineer recorded above (per-address sign-in limiting, the
  provider-key secret, unbuilt images with floating base tags).
- The timetable-slot linking added in the review was exercised by hand (campus → open the
  material → mark as read → the slot reads completed) and by the service-level logic; no journey
  test covers it yet.
- Sections 13 onward of the Mind, Brain and AI update were not received, so nothing in them is
  implemented.
- COG-250 and COG-260 each have one prepared unit; their other seven units are outlines, and
  COG-100 has none. Method 9.6 (measurement, reliability and validity) has no prepared unit.
- Choosing a programme during orientation is tested at the service level only; journey spec 09
  follows the programme from its own page.
- One saved prediction opens a laboratory for its whole unit, so the choice-model activity asks
  for both cases' predictions before saving rather than enforcing one per case.
