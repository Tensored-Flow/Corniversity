# Status

Last updated: 30 October 2026 (Milestone 1 foundation running locally; Milestone 2 starting).

## Implemented / tested / blocked

| Area | Implemented | Tested | Notes |
|---|---|---|---|
| Planning documents | yes | n/a | docs/ |
| Monorepo, type checks, Biome, Vitest, Playwright | yes | typecheck green for 7 packages | pnpm 12, TS 5.9, Next 16.4 |
| Embedded PostgreSQL dev cluster | yes | migrations applied | `pnpm db:local`; pgvector absent locally (expected) |
| Drizzle schema (64 tables) + initial migration | yes | migration applied | pgvector embedding table created only when extension exists |
| better-auth email+password, owner bootstrap, closed sign-up | yes | e2e journey 1 (desktop + mobile) | rate limits on; bootstrap needs owner email + one-time code header |
| Design tokens, fonts, Markdown + KaTeX (MathML) + mhchem | yes | renders; visual QA pending | light + dark roles |
| Arrival, sign-in, join, tour, campus shell, onboarding step 1 | yes | e2e journey 1 | steps 2–12 placeholders until M3 |
| Worker with pg-boss queues, job records, health endpoint | yes | starts; maintenance handler only | ingestion/assessment handlers in M2/M4 |
| Core: citation grounding, deterministic academic checks | yes | 12 unit tests | |
| AI package, content package, FA course content | in progress | – | M2 |

## Environment facts (verified 30 Oct 2026)

- Windows 11, Node v24.19.0, npm 11.17.0, pnpm 12.16.1 (installed this session), Python 3.11.9.
- Docker and psql absent, so local PostgreSQL runs via embedded-postgres (PostgreSQL 17.10 binaries).
- GitHub CLI authenticated (account Tensored-Flow; scopes gist, read:org, repo, workflow).
- Railway CLI 5.66.0 installed but not logged in; no RAILWAY_TOKEN in the environment.
- No ANTHROPIC_API_KEY and no ant CLI profile, so the fixture provider is the only provider
  until the owner configures one.
- Playwright browsers present (chromium build 1200).

## Blocked (owner action required)

See [USER_ACTIONS.md](USER_ACTIONS.md).

## Resume checkpoint

Local stack: `pnpm db:local` (window 1), `pnpm dev` (window 2). Owner account on the local
database was created by the e2e test with the test password in `tests/e2e/helpers.ts`; run
`pnpm owner:reset-password` to choose your own.

Next action: Milestone 2. Write `packages/ai` (provider contract, fixture + Anthropic providers,
role contracts, budget), `packages/content` (loader, validator, seeder), author MAT-230 units
1–4 from the verified MIT 18.102 sources, then build the course foyer → unit → tutorial →
submission → assessment → feedback loop in the web app and worker. Run `pnpm test`,
`pnpm test:e2e`, update this file.
