# Handoff

Written for Leon, the owner. Everything here was checked on 31 October 2026 on the build
machine (Windows 11). Where something has not been verified, this document says so.

## Where things stand

- **Status: locally working; deployment prepared, not executed.** There is no live URL. The
  Dockerfiles, Railway configuration and deploy script exist and `pnpm deploy:railway:plan`
  prints the plan, but nothing has been deployed because the Railway command-line tool on this
  machine is not signed in and Docker is not installed (so the images were never built here).
- **Live AI: not exercised.** No model-provider key is configured. Tutors, assessors, the
  director, the reading room, the seminar chair and the classmates run on deterministic
  fixtures, labelled as AI everywhere they speak. The Anthropic provider compiles and its
  budget and pricing logic has unit tests, but no live request has been made.
- **Repository:** `C:\Users\leona\Documents\Corniversity`, branch `main`, not yet published to
  GitHub (see [USER_ACTIONS.md](USER_ACTIONS.md), item 4). Commits: `1246d1e` (Milestone 3),
  `61cbe70` (launch content), `f8330a4` (Milestone 4), `1b26bbd` (Milestones 5–7), and the last
  commit on `main` (Milestone 8: the three review passes and their repairs; `git log -1` shows it).

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

## Sign in and begin

- **Fresh database:** open http://localhost:3000, choose *Create your course of study*, and
  enter the owner email and the one-time bootstrap code from your `.env` file
  (`OWNER_EMAIL`, `OWNER_BOOTSTRAP_CODE`). Sign-up closes once that account exists.
- **The database on the build machine:** the owner account was created by the automated
  journeys with a test password. Run `pnpm owner:reset-password` to choose your own, then sign
  in at http://localhost:3000/sign-in.
- **Then:** Orientation (twelve short steps; every answer stays editable in Settings) proposes a
  programme and a timetable. From the Campus page, *Timetable* shows the week and the next
  session; opening a session gives the reading, the exercise and the tutor. *My Studies*,
  *Notebook* and *Records* hold what you did.

## What to put in which folder

Your private data root (`CORNIVERSITY_DATA_ROOT`, chosen when you ran `init-env`) is outside
the repository and never committed. Inside it:

| Folder | Put here | What happens |
|---|---|---|
| `inbox/mathematics/`, `inbox/physics/`, `inbox/chemistry/`, `inbox/neuroscience/`, `inbox/cognitive-science/`, `inbox/computer-science-ai/` | PDF, Markdown or text files you own | The desktop companion registers each file as a **local-only** item (metadata only). Nothing leaves your computer until you grant *store a private copy* for that item in the Library; text extraction and any use by the AI faculty need their own permissions, which you grant per item. |
| `originals/`, `processed/`, `quarantine/` | nothing by hand | Managed by the app: stored copies, extracted text and files that failed validation. |
| `exports/` | nothing by hand | Records exports, timetable files and database backups (`exports/backups/`). |
| `requests/` | nothing by hand | The *Books to obtain* list in the formats the Library exports. |

The web upload at *Library → Upload* is the alternative for a file that is not in a watched
folder. Deleting an item in the Library deletes its stored copy and extracted text; notes that
pointed into it are kept and marked as needing repair.

## Desktop companion

```powershell
pnpm library:pair -- --server http://localhost:3000 --code 1234-5678 --name "Leon's desktop" --root "C:\Users\you\Documents\Corniversity-Library"
pnpm library:sync -- --dry-run     # shows what would be registered
pnpm library:sync                  # one pass
pnpm library:watch                 # keeps running; the Library shows "Desktop sync online"
pnpm library:status                # pairing and last report
```

The pairing code comes from *Library → Desktop sync* and is valid once. The companion only
makes outbound HTTPS requests, keeps its device token in `companion.json` under its own
configuration folder, and can be revoked at any time from the same Library page.

## Course readiness (exact counts from `content/`)

The catalogue holds 74 courses in six departments: the 12 launch courses are `teaching_ready`;
the other 62 are `proposed` (named, placed and described, with no syllabus or verified
sources yet) and are shown with that label everywhere they appear. Across the launch courses:
125 units, 31 of them prepared (lesson, exercises with feedback criteria, source locators and
an exit check); the other 94 have verified reading lists only and open with the notice that
their lesson, exercises and feedback "have not been prepared yet".
93 original exercises, 27 verified sources, 894 verified locators.

| Course | Units | Prepared | Minimum in the brief |
|---|---|---|---|
| CHE-101 Principles of Chemical Science | 10 | 5 | 4 (met) |
| MAT-230 Functional Analysis I | 12 | 4 | 4 (met) |
| NEU-220 Computational Neuroscience | 10 | 4 | 4 (met) |
| COG-201 Computational Cognitive Science | 10 | 2 | 2 (met) |
| CSA-210 Deep Learning Foundations | 10 | 2 | 2 (met) |
| MAT-210 Measure and Integration | 10 | 2 | 2 (met) |
| MAT-261 Smooth Manifolds | 12 | 2 | 2 (met) |
| MAT-262 Riemannian Geometry | 10 | 2 | 2 (met); the advanced-geometry tutorial is its sphere-metric laboratory unit |
| MAT-270 Abstract Algebra I | 10 | 2 | 2 (met) |
| PHY-201 Classical Mechanics | 10 | 2 | 2 (met) |
| PHY-210 Special Relativity and Minkowski Geometry | 10 | 2 | 2 (met) |
| PHY-240 General Relativity I | 11 | 2 | 2 (met) |

Shortfall, stated plainly: the minimums are met, and no more. A term's work in any one course
runs past its prepared units within three to five weeks; the remaining units are produced
through the visible content workflow (unit status `draft` → prepared, validated by
`pnpm content:validate`), never generated silently when you press *Start*.

## Test and build results (31 October 2026)

| Check | Result |
|---|---|
| `pnpm typecheck`, `pnpm lint` | clean (7 packages; Biome) |
| `pnpm test` and `pnpm test:integration` | 124 unit and integration tests pass (core, ai, content, db, worker, companion, web) |
| `pnpm eval:academic` | 19 academic evaluation cases pass (fixture provider; they exercise the check rules and the verdict policy, not a model's judgement) |
| `pnpm test:e2e` | 30 learner-journey tests pass at 1440×900 and 30 at 390×844; axe accessibility checks clean on 12 pages at both sizes |
| `pnpm build` | production build passes (every route server-rendered on demand) |
| `pnpm content:validate` | 0 errors, 0 warnings |
| Backup and restore | rehearsed: 65 tables, 2378 rows restored into a throw-away database with equal counts |
| Companion `watch` | rehearsed by hand against the development server: online while running, offline two minutes after stopping |
| Deployment | plan printed (`pnpm deploy:railway:plan`); not executed |
| Live model | none |

Details, including what each check does and does not prove, are in [QA_REPORT.md](QA_REPORT.md).
Screenshots of the running application (desktop and mobile) are in `docs/qa/screenshots/` on the
build machine (about 60 MB of PNGs, kept out of git by the ignore rule); a dozen key desktop views
are committed alongside so the repository carries evidence of the actual application.

## Independent review (Milestone 8)

Three independent passes reviewed the build on 31 October 2026 (a sceptical learner using the
running application, an academic assessor recomputing the material, a production engineer probing
the server and the deployment path). Between them they raised 49 findings; 46 were repaired and
re-tested, and the 3 recorded ones are listed in [QA_REPORT.md](QA_REPORT.md) under "Independent
review" with every repair. Two of the findings matter most to you: in fixture mode the assessor
had been able to mark an unread answer "Accepted", which can no longer happen (every fixture
verdict is withheld until a live assessor exists), and the development server had been reloading
pages continuously, which is fixed.

## Operating cost estimate

- **Hosting (Railway):** the Hobby plan is $5 a month and includes $5 of usage; usage is about
  $20 per vCPU-month, $10 per GB of memory-month and $0.15 per GB of volume-month (price page
  read on 31 October 2026). Three mostly idle services (web, worker, PostgreSQL) come to roughly
  **$10–25 a month**. Stopped services cost nothing.
- **Model usage:** nothing until you add a key. With the default model at $4 per million input
  tokens and $20 per million output tokens (pricing table in `packages/ai/src/pricing.ts`), a
  tutor turn of a few thousand tokens costs about a cent; the daily and monthly budgets you set in
  Settings are enforced before each request.
- **Everything else** (embedded database, companion, exports) runs on your own computer at no
  cost.

## Backups and exports

- `pnpm backup` writes `exports/backups/corniversity-<timestamp>.json.gz` under your data root
  together with a `…json.gz.blobs/` folder holding the stored originals; keep the two together.
  `pnpm restore <file>` shows what a restore would do and `pnpm restore <file> --yes` performs it
  (the database role must be allowed to set `session_replication_role`, as Railway's default is).
- *Records → Exports* builds JSON and Markdown exports of your transcript, portfolio and
  evidence; *Timetable → Export* gives an `.ics` file, and the subscription link keeps a calendar
  app in step.
- Your original files stay in `originals/` under the data root; they are never inside the
  database when the file store is the local disk.

## Minimal remaining manual actions

Listed with exact steps in [USER_ACTIONS.md](USER_ACTIONS.md): sign in to Railway and run the
deploy script; add a provider key and budgets in Settings to enable live teaching; optionally
configure email for password reset; optionally publish the private GitHub repository.

## The core question

*Can Leon enrol, open tomorrow's real material, attempt meaningful work, receive careful
feedback, and return next week without losing the thread?*

On this machine, yes for the 31 prepared units: enrolment, the timetable, the reading with exact
source locators, exercises with deterministic checks, structured feedback with an appeal path,
notes, evidence and revision all persist and were exercised by the automated journeys. Two
qualifications: the feedback's prose is fixture-generated until you add a provider key (the
checks and the feedback structure are real; the careful reading of your argument needs the live
model), and the site exists only on this computer until the Railway step is done.
