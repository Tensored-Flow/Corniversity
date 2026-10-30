# Requirement traceability

| ID | Requirement | Code | Tests / evidence | Status |
|---|---|---|---|---|
| UNI-01 | Dedicated private project; no Kalibr modification | repo root `C:\Users\leona\Documents\Corniversity` | git history | done |
| UNI-02 | Resumable onboarding, editable baseline | `apps/web/src/app/onboarding`, `learner_profile` | e2e journey 1 | step 1 done; steps 2–12 M3 |
| UNI-03 | Source-mapped programmes, prerequisite alternatives | `packages/core/src/prerequisites`, `content/programmes` | unit tests | todo |
| UNI-04 | Six departments, catalogue breadth | `content/departments`, `content/courses` | validator | six departments + 74-course catalogue done; breadth content in progress |
| UNI-05 | Twelve launch syllabi, unit-level readiness | `content/courses/*`, validator | validator counts | todo |
| UNI-06 | Welcome, induction, first week | `/welcome`, scheduler first-week | e2e journey 1 | todo |
| UNI-07 | Distinct faculty roles, restricted tools, memory | `packages/ai/src/roles` | unit tests | role contracts + tutor/assessor done; others M6 |
| UNI-08 | Optional labelled peers, bounded interaction | `discussion` services | e2e journey 8 | todo |
| UNI-09 | Source-grounded lecture/tutorial/reading | sessions, grounding | e2e journey 2 | done for prepared units |
| UNI-10 | Serious proof assessment, revision, uncertainty | assessment worker, `packages/core/src/checks` | evals | done (fixture); appeals filed as records |
| UNI-11 | Exact locators, citation validation | `locator`, grounding | unit tests | done |
| UNI-12 | Structured acquisition requests | `resource_request`, `/library/requests` | integration | todo |
| UNI-13 | Windows companion, pairing, offline state | `apps/companion` | integration | todo |
| UNI-14 | Separate permissions, reference-only workflow | `processing_permission` | integration | todo |
| UNI-15 | Durable jobs | `apps/worker`, pg-boss | integration | assessment jobs done; ingestion M4 |
| UNI-16 | Deterministic timetabling, catch-up | `packages/core/src/scheduling` | unit tests | todo |
| UNI-17 | ICS workflow, no false sync claims | `/api/calendar` | unit + integration | todo |
| UNI-18 | Durable notebook, portfolio, records | notebook/records services | e2e | evidence + My Studies done; notebook/records M5 |
| UNI-19 | Subject-specific computational activities | `apps/web/src/labs` | unit tests of equations | todo |
| UNI-20 | Private access, hidden solutions, safe files | auth, services, upload validation | security tests | auth + instructor artifacts server-only done; file handling M4 |
| UNI-21 | Budgets, provider failure, non-AI fallback | `packages/ai/src/budget` | tests, journey 9 | budget decisions + provider failure path done |
| UNI-22 | Responsive scholarly design, accessibility | design system, axe | screenshots, axe report | todo |
| UNI-23 | Export, backup, restore, deletion | export service, scripts | restore rehearsal | todo |
| UNI-24 | Local reproducibility, truthful deployment | README, infra | QA_REPORT | todo |
| UNI-25 | Software QA plus educational evaluations | tests, evals | QA_REPORT | todo |
| UNI-26 | Accurate handoff, minimal manual steps | STATUS, USER_ACTIONS | – | todo |
