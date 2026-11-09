# Handoff

Written for Leon, the owner. Everything here was checked on 31 October, 1 November and
9 November 2026, on the build machine (Windows 11) and, for the deployment, on the live site.
Where something has not been verified, this document says so.

## Where things stand

- **Status: deployed, waiting for your account.** The site runs at
  https://web-production-4c692.up.railway.app, in the Railway project `corniversity` (PostgreSQL,
  a web service and a worker). Milestone 10's release is recorded in [QA_REPORT.md](QA_REPORT.md), Deployment. Until you create the owner account there, sign-up
  accepts only the owner email with the one-time code ([USER_ACTIONS.md](USER_ACTIONS.md),
  item 1); then it closes for good.
- **Live tutoring: blocked, not verified.** No model key is configured and no paid use is
  approved. Tutors, the assessor, the director, the reading room, the seminar chair, the
  classmates and the studio's feedback run as a *scripted demo*, labelled so wherever they speak;
  scripted text never reads your work. The Anthropic integration has been checked against a local
  server that speaks the documented wire format, but no request has reached Anthropic. If you
  choose a live model before it can run, it is refused with the reason, and nothing scripted takes
  its place.
- **Behind sign-in on the live site: not checked.** Every journey ran on this computer, on the
  development server and on the production build against an empty database; on the live site only
  the public pages, the health check and the logs were checked, because no account exists there.
- **Repository:** `C:\Users\leona\Documents\Corniversity`, branch `main`, with no git remote; it
  has not been pushed anywhere ([USER_ACTIONS.md](USER_ACTIONS.md), item 6). Milestone 10 started
  from commit `5faa665` and is committed after it (`git log` lists the commits).

## Start it (two PowerShell windows in the project folder)

Prerequisites: Node.js 22.12 or newer, pnpm, Git. Docker is not required.

```powershell
pnpm install
node scripts/init-env.mjs you@example.com "C:\Users\you\Documents\Corniversity-Library"   # first time only
pnpm setup:check
pnpm db:local        # window 1: embedded PostgreSQL 17 on port 5437; leave it open
```

```powershell
pnpm db:migrate      # window 2, first time and after every update
pnpm db:seed         # loads departments, catalogue, sources, personas and the course content
pnpm dev             # web app on http://localhost:3000 plus the background worker
```

If pages become slow after a long development session, stop `pnpm dev` and start it again.

## Sign in and begin

- **Fresh database:** open http://localhost:3000, choose *Create your course of study*, and
  enter the owner email and the one-time bootstrap code from your `.env` file.
- **The database on the build machine:** the owner account was created by the automated
  journeys with a test password, and its records are test data. Run `pnpm owner:reset-password`
  to choose your own password, then sign in at http://localhost:3000/sign-in.
- **Then:** Orientation (twelve short steps) proposes a plan and a timetable; choosing a programme
  there follows it and enrols you in nothing. Afterwards every step stays visible, but the plan
  steps change nothing: courses are taken on their own pages after their workload preview.

## What Milestone 10 added

- **The programme experience.** *Mind, Brain and AI* says where to begin and shows the route by
  stage. Each of its twelve blocks has a page with its scope, the units that serve it, your
  prerequisites rule by rule, its sources, what is missing (with the library link), the
  curriculum's readiness and, separately, your own progress, and one next step. *Ask the director
  for a route* drafts a small route that shows your focus before and after and what happens to
  each course before you confirm; confirming enrols you in nothing. A mathematics background is
  recognised for the mathematics rules only, never for programming, psychology or biology.
- **Laboratories.** *Predict again* hides a laboratory's results until you save a new prediction.
  NEU-220's tuning laboratory offers two splits that answer different questions (new trials of
  the eight orientations, or an orientation the fit never saw), each with its question and
  contract; the lesson, exercise 3 and its rubric (now version 2) say the same.
- **The research studio** (side bar, *Research Studio*). A project starts from a question and is
  conceptual, mathematical, computational, a replication or a critical review. It keeps a focused
  shelf of verified sources, a proposal, methods and a report as numbered versions, the provenance
  of every dataset or simulation, notebook entries, small files, feedback on a saved version, an
  optional oral discussion, and a report you can download as Markdown. It never collects data from
  people. In the scripted demo its feedback is a set of structural checks that says no model read
  the work.
- **Live tutoring settings** (*Settings → Live tutoring and its costs*): the provider, a supported
  model, the key (stored encrypted, shown only by its ends), the refusal-fallback choice, limits
  per run, per day and per month (always hard), your approval of paid use, and the recent runs
  with their actual cost.
- **Coverage.** [MIND_BRAIN_AI.md](MIND_BRAIN_AI.md) now has one generated row per block,
  elective, method and shelf source, and the status of every requirement in sections 13 to 20.

## Course readiness (exact counts from `content/`)

The catalogue holds 86 courses in six departments. The 12 launch courses are `teaching_ready`.
COG-250 and COG-260 are `source_verified`, each with one prepared unit and seven outlined units.
The other 72 are `proposed`: named and described, without a syllabus or verified sources yet. Across
the catalogue there are 141 units (33 prepared), 99 original exercises, 59 verified sources and
1121 verified locators. Of the programme's twelve blocks, eight are partly prepared, MBI-03 has
verified sources but no prepared unit, and MBI-02, MBI-10 and MBI-12 are proposed; the eight
electives are proposed and offered for audit only; method 9.6 has no prepared unit yet. Three
sources are still unresolved leads, listed under Library → Books to obtain. A prepared unit is
teaching material; it says nothing about what you have understood.

## Test and build results (9 November 2026)

| Check | Result |
|---|---|
| `pnpm typecheck`, `pnpm lint` | clean (7 packages; Biome) |
| `pnpm test` | 253 pass in 32 files |
| `pnpm test:integration` | 80 pass in 12 files |
| `pnpm eval:academic` | 19 pass (check rules and the verdict policy, not a model's judgement) |
| `pnpm content:validate` | 0 errors, 0 warnings |
| Journeys, development server | the last full run passed 84 of 85 at 1440×900 and 390×844; the one failure, two scrolling tables a keyboard could not reach, was repaired and the accessibility sweep passed at both sizes |
| Journeys, production build on an empty database | 85 of 85 at both sizes on a new database, after two earlier runs found an orientation defect (repaired) and four faults in the tests themselves |
| Deployment | recorded in [QA_REPORT.md](QA_REPORT.md), Deployment |
| Live model | none; live tutoring blocked |

What each check does and does not prove, every failure and rerun, and the screenshots that were
inspected are in [QA_REPORT.md](QA_REPORT.md), Milestone 10.

## Operating costs

These are estimates with their assumptions, not a verified monthly bill.

- **Hosting (Railway).** Actual configuration: one project with three always-on services, `web`,
  `worker` and `Postgres` (with one volume), in US West. Railway's Hobby plan was $5 a month
  including $5 of usage, then about $20 per vCPU-month, $10 per GB of memory-month and $0.15 per
  GB of volume-month (price page read on 31 October 2026, not re-read since). Three mostly idle
  services at roughly 0.8–1.5 GB of memory in total and a small fraction of a vCPU suggest about
  $10–25 a month. The real figure is on Railway's usage page.
- **Model use (Anthropic).** Nothing so far: no live run has been made. If you enable it, it is
  billed by Anthropic to your API account, separately from hosting. Prices per million tokens
  (input/output) in `packages/ai/src/pricing.ts`, read on 6 October 2026: Claude Opus 5.5 $4/$20
  (the default), Sonnet 5.5 $2/$10, Haiku 5.5 $0.10/$0.50, Fable 5.1 $10/$50. The default limits
  are $1 per run, $3 a day and $40 a month, never above $5, $50 and $500; a run is refused if its
  worst case could cross one. A tutor turn usually costs about a cent or two, but its worst case
  (the whole output allowance) is what the limits are checked against; with refusal fallback on,
  a declined request can be billed twice.
- **Everything else.** No email provider, domain, object storage or other paid service is used.
  The embedded database, the companion and exports run on your own computer at no cost.

## Account recovery

There is no password-reset email, because no mail provider is configured. If you forget your
password: in PowerShell in the project folder run `railway ssh --service worker`, then in that
shell `node node_modules/tsx/dist/cli.mjs apps/worker/src/admin/reset-owner-password.ts`, and type
the new password twice (it is not shown). Every signed-in browser is signed out and the reset is
recorded. Nothing on the website can reset a password. On your own computer the command is
`pnpm owner:reset-password`. The command is tested against a throw-away database; it has not been
run on the live site.

## Backups and exports

- `pnpm backup` writes `exports/backups/corniversity-<timestamp>.json.gz` under your data root
  together with a `…json.gz.blobs/` folder holding the stored originals; keep the two together.
  `pnpm restore <file>` shows what a restore would do and `pnpm restore <file> --yes` performs it.
- *Records → Exports* builds JSON and Markdown exports of your transcript, portfolio and
  evidence; *Timetable → Export* gives an `.ics` file. A studio project downloads as Markdown.

## Remaining actions for you

Listed with exact steps in [USER_ACTIONS.md](USER_ACTIONS.md): create the owner account on the
live site; then remove the bootstrap code from both services; let the signed-in checks be done;
optionally enable live tutoring with a key, approval and a small test budget; optionally publish
the repository. Please also confirm that the tests named in QA_REPORT.md describe the behaviour
you intend, in particular the studio's rules and the route rules in MIND_BRAIN_AI.md, section 13.

## The core question

*Can Leon choose a coherent programme, access exact teaching material, do meaningful work,
receive genuine grounded tutoring when a provider is configured, and return with persistent and
honest records?*

On this computer, yes, except the tutoring: the programme can be chosen and followed without
enrolling; its 33 prepared units open with exact source locations; laboratories, exercises,
notes, the studio and records persist and were exercised by the journeys on an empty database.
Tutoring is the scripted demo until a key is added and paid use approved, and no live model has
been tested. On the live site the same build is deployed, but nothing behind sign-in has been
used yet: your first sign-in there is its first real use.
