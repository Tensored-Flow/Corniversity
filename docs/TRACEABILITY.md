# Requirement traceability

| ID | Requirement | Code | Tests / evidence | Status |
|---|---|---|---|---|
| UNI-01 | Dedicated private project; no Kalibr modification | repo root `C:\Users\leona\Documents\Corniversity` | git history | done |
| UNI-02 | Resumable onboarding, editable baseline | `apps/web/src/app/onboarding`, `learner_profile` | e2e journey 1 | todo |
| UNI-03 | Source-mapped programmes, prerequisite alternatives | `packages/core/src/prerequisites`, `content/programmes` | unit tests | todo |
| UNI-04 | Six departments, catalogue breadth | `content/departments`, `content/courses` | validator | todo |
| UNI-05 | Twelve launch syllabi, unit-level readiness | `content/courses/*`, validator | validator counts | todo |
| UNI-06 | Welcome, induction, first week | `/welcome`, scheduler first-week | e2e journey 1 | todo |
| UNI-07 | Distinct faculty roles, restricted tools, memory | `packages/ai/src/roles` | unit tests | todo |
| UNI-08 | Optional labelled peers, bounded interaction | `discussion` services | e2e journey 8 | todo |
| UNI-09 | Source-grounded lecture/tutorial/reading | sessions, grounding | e2e journey 2 | todo |
| UNI-10 | Serious proof assessment, revision, uncertainty | assessment worker, `packages/core/src/checks` | evals | todo |
| UNI-11 | Exact locators, citation validation | `locator`, grounding | unit tests | todo |
| UNI-12 | Structured acquisition requests | `resource_request`, `/library/requests` | integration | todo |
| UNI-13 | Windows companion, pairing, offline state | `apps/companion` | integration | todo |
| UNI-14 | Separate permissions, reference-only workflow | `processing_permission` | integration | todo |
| UNI-15 | Durable jobs | `apps/worker`, pg-boss | integration | todo |
| UNI-16 | Deterministic timetabling, catch-up | `packages/core/src/scheduling` | unit tests | todo |
| UNI-17 | ICS workflow, no false sync claims | `/api/calendar` | unit + integration | todo |
| UNI-18 | Durable notebook, portfolio, records | notebook/records services | e2e | todo |
| UNI-19 | Subject-specific computational activities | `apps/web/src/labs` | unit tests of equations | todo |
| UNI-20 | Private access, hidden solutions, safe files | auth, services, upload validation | security tests | todo |
| UNI-21 | Budgets, provider failure, non-AI fallback | `packages/ai/src/budget` | tests, journey 9 | todo |
| UNI-22 | Responsive scholarly design, accessibility | design system, axe | screenshots, axe report | todo |
| UNI-23 | Export, backup, restore, deletion | export service, scripts | restore rehearsal | todo |
| UNI-24 | Local reproducibility, truthful deployment | README, infra | QA_REPORT | todo |
| UNI-25 | Software QA plus educational evaluations | tests, evals | QA_REPORT | todo |
| UNI-26 | Accurate handoff, minimal manual steps | STATUS, USER_ACTIONS | – | todo |
