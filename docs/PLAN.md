# Corniversity — implementation plan

Ordered milestones with acceptance criteria. Status values: todo, in_progress, done, blocked.
The exact resume checkpoint lives in [STATUS.md](STATUS.md).

## Milestone 0 — Reconnaissance and executable specification — done

Done: environment inspected (Node 24.19, pnpm 12, Python 3.11, no Docker or psql, GitHub CLI
authenticated, Railway CLI not logged in, no provider key); ALTER inspected at commit
467daa5ceb9799b952a3a1d604b7142eeea75eec (MIT, six Claude Code skills); current library APIs
checked (Next 16.4, better-auth 1.7, pg-boss 12, Drizzle 0.45, Anthropic SDK 1.3, unpdf 2.1,
embedded-postgres 17.10); Railway Postgres pgvector status confirmed (not in the standard
image). Documents created; repository initialised.

Gate: coherent build plan, data and privacy boundaries defined, known deployment path.

## Milestone 1 — Design system and real application foundation — done

- pnpm monorepo, TypeScript 5.9, Next.js 16, Tailwind 4 tokens, fonts, KaTeX + mhchem rendering.
- Embedded PostgreSQL dev cluster script; Drizzle schema and SQL migrations for every entity
  area in [ARCHITECTURE.md](ARCHITECTURE.md); environment validation with `.env.example`.
- better-auth email + password; safe single-owner bootstrap (owner email + one-time code), sign-up
  closed afterwards, rate limiting on; every private route and API checks the session server-side.
- Learner profile and resumable onboarding state persisted; arrival, sign-in, onboarding shell,
  campus home shell with real tokens and copy.
- Acceptance: `pnpm dev` runs web + worker locally; a user can bootstrap, sign in, start
  onboarding, reload and resume; `pnpm typecheck` and `pnpm test` pass; unauthenticated requests
  to private routes and APIs are refused (test).

## Milestone 2 — The first complete learning loop (Functional Analysis) — done

- MAT-230 Functional Analysis I: source-verified spine (MIT 18.102 Spring 2021), complete
  syllabus with verified locators, units 1–4 prepared (lesson, exercises, hint ladder, rubric,
  instructor notes, exit check), including the C1 norm-comparison task.
- Course foyer, unit page, lecture/reading room with source panel, tutorial workbench with hint
  ladder, proof submission → immutable version → assessment job → structured, line-localised
  feedback → revision → evidence events → concept states; notebook capture.
- Provider abstraction with fixture provider; Anthropic provider wired but inactive without
  config; citation grounding ([E#] tags validated server-side); budget accounting.
- A timetable entry for the tutorial; the deterministic check for the x^n norms.
- Acceptance: journey 2 passes end to end with the fixture provider; feedback persists across
  reload and re-login; assessment retry does not duplicate feedback (test).

## Milestone 3 — Programmes, department breadth, timetabling — done

- Catalogue from Appendix A with honest readiness; six department halls; named programmes;
  concept-level prerequisite graph with alternatives, bridges, co-requisites, cycle detection,
  learner overrides with provenance.
- Deterministic scheduler: availability, commitments, days off, term template, per-activity
  estimates, dependencies, weekly cap; infeasibility report with choices; proposed vs confirmed
  plans; diff-based rescheduling; catch-up plan; ICS export and tokenised subscription.
- Onboarding steps 2–12 fully functional, ending in welcome letter, handbook and first week.
- Acceptance: scheduler unit tests (overlaps, availability, dependencies, DST, determinism,
  stable UIDs); journeys 1 and 7 pass; no course displays a readiness it has not earned
  (content validator test).

## Milestone 4 — Library and durable background processing — done

- Resource requests (library/requests.md + JSON export); web upload; quarantine and validation;
  metadata confirmation; separate processing permissions; ingestion pipeline (unpdf native text,
  physical index + printed label, segmentation, FTS, optional embeddings); reading room with
  TOC, page jump, search, annotations, "ask about this passage".
- Companion CLI: pairing code → revocable device token; watch/sync/status; stability checks,
  checksums, deduplication, retries, pause; visible "desktop sync offline" state.
- Job management UI (progress, errors, cancel, retry) with idempotency keys.
- Acceptance: journeys 5 and 6 pass; forbidden processing does not occur (tests on permission
  denial before and during a queued job); duplicate import is deduplicated; corrupt PDF fails
  cleanly; direct unauthenticated file access refused.

## Milestone 5 — Full academic workflows and launch content — done

- Twelve launch courses source-verified with complete syllabi; at least two prepared units each;
  at least four for Functional Analysis, Principles of Chemical Science and Computational
  Neuroscience; an advanced geometry tutorial (C2); labs: norm comparison, sphere metric,
  A ⇌ B kinetics, neural model fitting on labelled synthetic data.
- Assessment types beyond proofs; appeals and regrades; revision items bounded by workload;
  notebook questions shelf; projects and reading courses; end-of-term review.
- Academic evaluation set with deterministic checks and fixture expectations.
- Acceptance: content validator passes with exact counts reported; journeys 3 and 4 pass;
  `pnpm eval:academic` passes; instructor artifacts absent from learner payloads (test).

## Milestone 6 — The institution and campus experience — done

- Induction polish, faculty personas with distinct contracts and restricted tools, optional
  peers with bounded rounds, societies, office hours, common room, campus map with list
  equivalent, immersion setting (quiet, collegiate, full), memory inspection and deletion.
- Acceptance: journey 8 passes; quiet mode exposes full academic function; no background
  conversations are generated (test).

## Milestone 7 — Hardening and deployment — done (deployed on 1 November 2026; journey 10 is checked by hand, see QA_REPORT.md)

- Authorization sweep, injection, SSRF and path-traversal tests, accessibility checks (axe),
  budgets and provider-failure behaviour, backup and restore rehearsal, export and import
  dry-run, Dockerfiles, Railway configuration, deploy script, post-deploy verification script.
- Acceptance: journeys 9 and 10 (when deployment is possible); visual QA screenshots at
  1440×900 and 390×844; truthful deployment status recorded.

## Milestone 8 — Independent review and repair — done

- Review passes as sceptical learner, academic assessor and production engineer (subagents
  where available); findings investigated, repaired, re-tested; remaining limitations listed.
- Acceptance: QA_REPORT.md complete; handoff written; USER_ACTIONS.md minimal.

## Milestone 9 — Mind, Brain and AI update — done for sections 1 to 12

- The owner's in-place curriculum and programme update, applied to the running application
  without resetting content or learner records. The message was truncated after section 12;
  sections 13 to 20 arrived later and are Milestone 10.
- The MIND-BRAIN-AI programme (twelve blocks mapped to existing and new courses, derived block
  readiness, shared units, eight modelling methods, eight proposed electives, a bounded paper
  seminar); programme catalogue, page, following, director routes and the programme map.
- Study defaults (rolling study, one main and one exploratory course, weekly appointments, no
  deadlines or examinations unless chosen, a workload preview before heavier loads) with content
  sequence, appointments and deadlines kept apart.
- Twelve new catalogue records (86 courses); COG-250 and COG-260 each with a prepared unit and a
  laboratory (planning transfer; the complete choice-modelling loop with information contracts).
- 32 new source records from three verification passes; missing sources routed to the library's
  request list as leads.
- Acceptance: content validator clean; seeding idempotent; unit, integration and journey suites
  pass at both viewports; an independent review of the two new units, with its findings repaired;
  the requirement classification in [MIND_BRAIN_AI.md](MIND_BRAIN_AI.md).

## Milestone 10 — Sections 13 to 20 and the live product — done (released 9 November 2026; the checks that need the owner's account or a provider key wait for them)

Reconciled from commit `5faa665`; the requirement checklist is the last part of
[MIND_BRAIN_AI.md](MIND_BRAIN_AI.md). Order of work, each step with its check:

1. Live tutoring made honest and safe: provider states (scripted demo, live, blocked) with no
   silent fallback; explicit approval for paid use; a supported-model setting; always-hard,
   worst-case budget checks; server-side refusal fallback priced per attempt; precise error
   states; provider-aware labels; a non-sensitive asset diagnostic. Check: unit tests, a
   contract test of the Anthropic provider against the documented wire format on a local mock,
   integration tests of the provider states.
2. Owner setup and recovery: a one-owner database guarantee, a bootstrap code that is optional
   once the owner exists and never printed, and a recovery command that works inside the worker
   image and revokes sessions. Check: integration tests, including concurrent sign-ups and the
   recovery command run end to end against a throw-away database.
3. The programme experience: block pages, the route and next step on the overview, a workload
   preview that shows independent work, orientation that cannot displace an existing learner's
   commitments, a director route that explains prerequisites and prior knowledge, and "predict
   again" in the laboratories. Check: core and integration tests; journeys.
4. The research studio. Check: core, integration and journey tests at both viewports.
5. Teaching and regressions: the modelling standard in the assessor, regression cases for the
   repaired units, NEU-220's evaluation question and a labelled held-out-orientation split.
   Check: core and content tests; the content validator.
6. Coverage, plan, status, academic model and QA records. Check: generated coverage tables match
   the catalogue.
7. Verification on a clean development server, then on a local production build, then on the
   deployed site; release to the existing Railway project (worker first, then web). Check:
   recorded results, screenshots inspected, live health and diagnostic.
- Blocked on the owner: creating the owner account (then the authenticated live checks and the
  retirement of the bootstrap code), and a provider key with an approved budget (then the live
  tutoring test).
