# QA report

Separates automated software checks, fixture tests, live-model checks, source verification and
academic uncertainty. Nothing below is claimed until the command and result are recorded.

## Software checks

All runs on 30–31 October 2026, Windows 11, local embedded PostgreSQL, fixture AI provider.

| Check | Command | Result |
|---|---|---|
| Lint and format (Biome, code only; content and docs excluded) | `pnpm lint` | 0 errors, 0 warnings, 1 info |
| Type check (7 packages) | `pnpm typecheck` | pass |
| All unit and integration projects | `pnpm exec vitest run` | 15 files, 116 tests passed: core 49 (grounding, checks, locators, scheduler, laboratory mathematics), ai 8, db 26 (evidence, library boundary, revision intervals, blob store), worker 6 (real PDF with page labels, corrupt PDF, revoked permission), companion 10, web 4 (sanitiser, maths, chemistry), academic evaluations 13 |
| Content validation | `pnpm content:validate` | 0 errors, 0 warnings; 74 courses (12 launch, all teaching_ready), 125 units (31 prepared), 93 exercises, 27 sources, 894 verified locators, 11 personas |
| Seed | `pnpm db:seed` | all twelve launch courses seeded; re-seeds create new course versions only when content changed |
| Journey 1: arrival, bootstrap, closed sign-up, resumable onboarding, unauthenticated refusal | `tests/e2e/01-arrival-and-onboarding.spec.ts` | all 29 journey tests in specs 01–08 pass on desktop (plus the shared sign-in setup); mobile 13 journey tests in specs 01–04 pass on mobile (390×844) |
| Journey 2: enrol, attempt, feedback, revision, persistence, tutor turn | `tests/e2e/02-functional-analysis-loop.spec.ts` | 2 passed on desktop and on mobile |
| Journey 3 (orientation) and the catch-up surface: steps 2–12, welcome, timetable, ICS, token refusal | `tests/e2e/03-onboarding-to-timetable.spec.ts` | 2 passed on desktop and on mobile |
| Journeys 5 and 6 and the library acceptance (companion pairing, deduplication, local-only, upload, extraction with printed labels, passage question, corrupt and fake files, unauthenticated access) | `tests/e2e/04-library.spec.ts` | 5 passed on desktop and on mobile |
| Journeys 3 (chemistry laboratory) and 4 (neuroscience laboratory), norm laboratory gating, notebook, records with a worker-built export, instructor-material leakage check, revision section | `tests/e2e/05-laboratories-and-records.spec.ts` | 7 passed on desktop |
| Journey 8 (bounded discussion with labelled classmates, nothing unprompted), mute, quiet mode, settings | `tests/e2e/06-common-room-and-settings.spec.ts` | 4 passed on desktop |
| Security: unauthenticated pages redirect, private routes 401/404, health route minimal, sign-up closed | `tests/e2e/07-security.spec.ts` | 4 passed |
| Accessibility (axe, WCAG 2.2 A/AA rules) on twelve main pages | `tests/e2e/08-accessibility.spec.ts` | serious/critical: none after fixing text contrast and focusable scroll regions; minor findings listed in the run output |
| Backup and restore rehearsal | `pnpm backup`; `pnpm restore <file>`; `pnpm restore <file> --yes` into a throw-away database | 65 tables, 2378 rows; dry run lists per-table counts; restore completed; 24 compared tables match the source exactly |
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

`pnpm eval:academic` — 13 cases pass. They cover: the expected `x^n` norm values; a correct proof in
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

None performed (no provider configured). Fixture runs are not live checks. The fixture responses
say so on screen.

## Visual QA

Screenshots at 1440×900 and 390×844 are in `docs/qa/screenshots/` (01–35: arrival through
settings). Inspected in this round: the reading room (page text, printed label badge, search
highlight, notes and passage question), the kinetics laboratory (chart, readouts, unstable-step
flag, report prompt and workbench), the records page, an open discussion and the notebook. Defects
found and fixed from the inspection: chemistry macro rendering, transcript version resolution,
an `exercise kind` badge showing an underscore. Known cosmetic point: extracted PDF text keeps the
PDF's line breaks, which is deliberate (the source view is one click away) but reads unevenly.

## Deployment

Status: **not deployed**. Railway CLI is installed but not logged in. Prepared: `Dockerfile.web`,
`Dockerfile.worker`, `infra/railway.web.json`, `infra/railway.worker.json`,
`infra/deploy-railway.ps1` (prints its plan with `-DryRun`). The Dockerfiles have not been built
on this machine (no Docker). Estimated running cost on Railway's Hobby plan (pricing page read on
31 Oct 2026): $5 a month, which includes $5 of usage; usage is billed per second at about $20 per
vCPU-month, $10 per GB of memory-month and $0.15 per GB of volume-month. Three mostly idle services
(web, worker, Postgres) at roughly 0.8–1.5 GB of memory and a small fraction of a vCPU come to
about $10–25 a month in total; stopped services cost nothing. Model usage is separate and capped
by the budgets in Settings (pricing table `packages/ai/src/pricing.ts`, version anthropic-2026-10-06:
the default model at $4 per million input tokens and $20 per million output tokens, so a typical
tutor turn of a few thousand tokens costs about a cent).

## Remaining defects

- The companion's `watch` mode has unit tests and a manual rehearsal against the development
  server (31 Oct 2026: paired through the root script, a text file dropped into `inbox/mathematics/`
  registered as a local-only companion item, the Library read "Desktop sync online" while the
  heartbeat ran and "Desktop sync offline" two minutes after it stopped). The Playwright journeys
  run `pair` and `sync` as child processes, not a long-lived `watch`, so only the rehearsal covers it.
- Deployment and live-provider behaviour remain unverified until the owner supplies credentials.
