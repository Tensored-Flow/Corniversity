# Requirement traceability

| ID | Requirement | Code | Tests / evidence | Status |
|---|---|---|---|---|
| UNI-01 | Dedicated private project; no Kalibr modification | repo root `C:\Users\leona\Documents\Corniversity` | git history | done |
| UNI-02 | Resumable onboarding, editable baseline | `apps/web/src/app/(app)/onboarding`, `learner_profile`, `onboarding_answers` | e2e journeys 1 and 3 | done: 12 resumable steps; every answer editable from Settings later (M6) |
| UNI-03 | Source-mapped programmes, prerequisite alternatives | `content/programmes`, `content/prerequisites`, `services/programme.ts` (evidence vs self-report, candidate plans) | journey 3 placement and plan steps | done for the launch catalogue |
| UNI-04 | Six departments, catalogue breadth | `content/departments`, `content/courses` | validator | done: six departments, 74-course catalogue with honest readiness, 12 launch courses teaching_ready |
| UNI-05 | Twelve launch syllabi, unit-level readiness | `content/courses/*`, validator | validator: 0 errors; 125 units (31 prepared), 93 exercises, 894 locators | done; ≥4 prepared units for MAT-230 (4), CHE-101 (5), NEU-220 (4) |
| UNI-06 | Welcome, induction, first week | `/welcome`, `/campus` next session, confirmed first-week plan | e2e journey 3 | done |
| UNI-07 | Distinct faculty roles, restricted tools, memory | `packages/ai/src/roles` | unit tests | role contracts + tutor/assessor done; others M6 |
| UNI-08 | Optional labelled peers, bounded interaction | `discussion` services | e2e journey 8 | todo |
| UNI-09 | Source-grounded lecture/tutorial/reading | sessions, grounding | e2e journey 2 | done for prepared units |
| UNI-10 | Serious proof assessment, revision, uncertainty | assessment worker, `packages/core/src/checks` | evals | done (fixture); appeals filed as records |
| UNI-11 | Exact locators, citation validation | `locator`, grounding, extracted pages with physical index + printed label, annotations anchored to locators with visible repair | unit tests; worker tests; journey 5b | done |
| UNI-12 | Structured acquisition requests | `resource_request`, `/library/requests`, catalogue-derived suggestions, `requests.md` + JSON export, data-folder write | db test (export); page | done |
| UNI-13 | Windows companion, pairing, offline state | `apps/companion` (pair, sync, watch, status, pause, unpair), `/api/companion/*`, hashed device tokens, online/paused/offline | 10 unit tests; journeys 5a/5b/6 run the CLI | done |
| UNI-14 | Separate permissions, reference-only workflow | six `processing_permission` actions, unknown by default, basis recorded, revocation re-checked by jobs | 16 db tests; 6 worker tests; journey 6 | done |
| UNI-15 | Durable jobs | `apps/worker`, pg-boss queues, idempotency keys, non-retryable failures, cancel/retry UI | worker tests; journeys 2 and 5 | done (export jobs M5) |
| UNI-16 | Deterministic timetabling, catch-up | `packages/core/src/scheduling`, `services/timetable.ts` (proposed vs confirmed plans, diff, catch-up proposals) | 12 scheduler unit tests (overlaps, availability, dependencies, daily cap, DST, determinism, stable UIDs); journey 3 | done |
| UNI-17 | ICS workflow, no false sync claims | `/api/calendar/export.ics`, tokenised subscription (hashed tokens) | ICS unit tests; journey 3 (valid file; invalid token refused) | done; copy says subscription, never two-way sync |
| UNI-18 | Durable notebook, portfolio, records | notebook/records services | e2e | evidence + My Studies done; notebook/records M5 |
| UNI-19 | Subject-specific computational activities | `apps/web/src/labs` | unit tests of equations | todo |
| UNI-20 | Private access, hidden solutions, safe files | auth, server-only instructor artifacts, signature/size/type validation, sandboxed file route, hashed device tokens, SSRF-guarded imports | journey 5/6 security test; db tests | done for the library; full sweep M7 |
| UNI-21 | Budgets, provider failure, non-AI fallback | `packages/ai/src/budget` | tests, journey 9 | budget decisions + provider failure path done |
| UNI-22 | Responsive scholarly design, accessibility | design system, axe | screenshots, axe report | todo |
| UNI-23 | Export, backup, restore, deletion | export service, scripts | restore rehearsal | todo |
| UNI-24 | Local reproducibility, truthful deployment | README, infra | QA_REPORT | todo |
| UNI-25 | Software QA plus educational evaluations | tests, evals | QA_REPORT | todo |
| UNI-26 | Accurate handoff, minimal manual steps | STATUS, USER_ACTIONS | – | todo |
