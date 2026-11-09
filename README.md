# Corniversity

A private, independent, non-accredited personal university for one learner: six departments,
AI faculty and optional classmates (all labelled), real university materials with exact source
locators, proof feedback, deterministic timetabling and a durable academic record.

Specification: [`brief/UNIVERSITY_BUILD_BRIEF.md`](brief/UNIVERSITY_BUILD_BRIEF.md), extended by the
owner's Mind, Brain and AI update ([`docs/MIND_BRAIN_AI.md`](docs/MIND_BRAIN_AI.md)). Agent manual:
[`AGENTS.md`](AGENTS.md). Current state: [`docs/STATUS.md`](docs/STATUS.md).

## Run it locally (Windows, PowerShell)

Prerequisites: Node.js 22.12 or newer, Git, pnpm (`npm install -g pnpm`). Docker is **not** required.

```powershell
pnpm install
node scripts/init-env.mjs you@example.com "C:\Users\you\Documents\Corniversity-Library"
pnpm setup:check          # verifies Node, pnpm, the environment file and the data root
pnpm db:local             # starts an embedded PostgreSQL 17 cluster (leave this window open)
```

In a second window:

```powershell
pnpm db:migrate           # applies SQL migrations
pnpm db:seed              # loads departments, catalogue, sources and personas from content/
pnpm dev                  # starts the web app (http://localhost:3000) and the worker
```

`pnpm dev` uses Next's webpack development server: the Turbopack one reloads pages in a loop in
this monorepo layout.

Open http://localhost:3000, choose **Create your course of study**, and enter the owner email
and the one-time bootstrap code from your `.env` (`OWNER_BOOTSTRAP_CODE`). Sign-up closes after
that account exists.

## Commands

| Command | Purpose |
|---|---|
| `pnpm typecheck`, `pnpm lint`, `pnpm build` | Static checks and production build |
| `pnpm test` | Unit tests (pure logic: scheduling, prerequisites, grounding, checks) |
| `pnpm test:integration` | Service tests against a real embedded PostgreSQL |
| `pnpm test:e2e` | Playwright learner journeys (stack must be running) |
| `pnpm eval:academic` | Academic evaluation set |
| `pnpm content:validate` | Validates `content/` and reports readiness counts |
| `pnpm content:coverage` | Regenerates the per-block, elective, method and source tables in `docs/MIND_BRAIN_AI.md` |
| `pnpm owner:reset-password` | Sets a new owner password (asked twice, never echoed) and signs the owner out everywhere; on the live site run it in the worker's shell, see `docs/HANDOFF.md` |
| `pnpm library:pair -- --server <url> --code <code>`, `pnpm library:sync -- --dry-run`, `pnpm library:watch`, `pnpm library:status` | Desktop companion; see `apps/companion/README.md` |
| `pnpm backup`, `pnpm restore <file> [--yes]`, `pnpm health` | Logical database backup (a small document plus a `<file>.blobs/` folder of stored originals; keep them together), restore (dry run by default) and health check |
| `pnpm deploy:railway:plan`, `pnpm deploy:railway` | Prints the plan of a first deployment; creates a new Railway project after `railway login`, and refuses to run in a folder already linked to one. Later releases use `railway up --service worker --ci`, then `--service web` |

## Where private data lives

`CORNIVERSITY_DATA_ROOT` (outside the repository) holds `inbox/<department>/` for books you
drop in, `originals/`, `processed/`, `exports/`, `requests/`, `quarantine/` and the local
PostgreSQL cluster. Nothing under it is ever committed.

## Honesty

Readiness states (`proposed`, `source_verified`, `syllabus_ready`, `teaching_ready`,
`resource_blocked`) are shown everywhere a course appears, at course and unit level. AI
teaching is a labelled scripted demo until you choose a live model, store a key and approve paid
use within finite limits in Settings; a live model that cannot run is reported as blocked, never
replaced by scripted text. Records are informal and never imply accreditation.
