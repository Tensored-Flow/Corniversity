# Requirement traceability

| ID | Requirement | Code | Tests / evidence | Status |
|---|---|---|---|---|
| UNI-01 | Dedicated private project; no Kalibr modification | repo root `C:\Users\leona\Documents\Corniversity` | git history | done |
| UNI-02 | Resumable onboarding, editable baseline | `apps/web/src/app/(app)/onboarding`, `learner_profile`, `onboarding_answers`, Settings (profile, experience, review link to every step) | e2e journeys 1 and 3; settings spec | done: 12 resumable steps; completed orientation stays editable step by step and from Settings |
| UNI-03 | Source-mapped programmes, prerequisite alternatives | `content/programmes`, `content/prerequisites`, `services/programme.ts` (evidence vs self-report, candidate plans), `services/programmes.ts` (following, routes, the programme map) | journey 3 placement and plan steps; journey spec 09 | done; the MIND-BRAIN-AI programme in MIND_BRAIN_AI.md |
| UNI-04 | Six departments, catalogue breadth | `content/departments`, `content/courses` | validator | done: six departments, 86-course catalogue with honest readiness, 12 launch courses teaching_ready |
| UNI-05 | Twelve launch syllabi, unit-level readiness | `content/courses/*`, validator | validator: 0 errors; 141 units (33 prepared), 99 exercises, 1121 locators | done; ≥4 prepared units for MAT-230 (4), CHE-101 (5), NEU-220 (4) |
| UNI-06 | Welcome, induction, first week | `/welcome`, `/campus` next session, confirmed first-week plan | e2e journey 3 | done |
| UNI-07 | Distinct faculty roles, restricted tools, memory | `packages/ai/src/roles`, prompts for tutor, assessor, director, reading room, chair and peer; `persona_memory` inspection and deletion in Settings | unit tests; journey 8 spec; settings spec | done |
| UNI-08 | Optional labelled peers, bounded interaction | `services/community.ts`, `/common-room`, `/api/discussions/turn` (rounds fixed at opening, released material only, mute, no unprompted turns) | journey 8 spec | done |
| UNI-09 | Source-grounded lecture/tutorial/reading | sessions, grounding | e2e journey 2 | done for prepared units |
| UNI-10 | Serious proof assessment, revision, uncertainty | assessment worker, `packages/core/src/checks` (`verdict.ts`, `leakage.ts`), the exercise kept with each run | evals, `verdict.test.ts`, `leakage.test.ts`, the worker assessment test (scripted; live through a local wire-format server; failed; refused by the limits; assessed as answered after a repair; reference text withheld), journey 2 | done at fixture level: every fixture verdict is withheld (`needs_review`), regrades queue a real re-assessment of the same exercise version, appeals filed as records; live-model judgement unverified |
| UNI-11 | Exact locators, citation validation | `locator`, grounding, extracted pages with physical index + printed label, annotations anchored to locators with visible repair | unit tests (including replayed history and selections checked against their page); worker tests (including natural-language questions retrieving passages); journey 5b | done |
| UNI-12 | Structured acquisition requests | `resource_request`, `/library/requests`, catalogue-derived suggestions, `requests.md` + JSON export, data-folder write | db test (export); page | done |
| UNI-13 | Windows companion, pairing, offline state | `apps/companion` (pair, sync, watch, status, pause, unpair), `/api/companion/*`, hashed device tokens, online/paused/offline | 10 unit tests; journeys 5a/5b/6 run the CLI | done |
| UNI-14 | Separate permissions, reference-only workflow | six `processing_permission` actions, unknown by default, basis recorded, revocation re-checked by jobs | 16 db tests; 6 worker tests; journey 6 | done |
| UNI-15 | Durable jobs | `apps/worker`, pg-boss queues, idempotency keys, non-retryable failures, cancel/retry UI | worker tests; journeys 2 and 5 | done (export jobs M5) |
| UNI-16 | Deterministic timetabling, catch-up | `packages/core/src/scheduling`, `services/timetable.ts` (proposed vs confirmed plans, diff, catch-up proposals) | 12 scheduler unit tests (overlaps, availability, dependencies, daily cap, DST, determinism, stable UIDs); journey 3 | done |
| UNI-17 | ICS workflow, no false sync claims | `/api/calendar/export.ics`, tokenised subscription (hashed tokens) | ICS unit tests; journey 3 (valid file; invalid token refused) | done; copy says subscription, never two-way sync |
| UNI-18 | Durable notebook, portfolio, records | `services/notebook.ts`, `services/records.ts`, `/notebook`, `/records`, exports built by the worker | journey spec 05 (notebook, records, export download) | done |
| UNI-19 | Subject-specific computational activities | `packages/core/src/labs` (9 laboratories), `sessions/[id]/labs`, interpretation recorded to notebook and evidence | 58 laboratory unit tests; content regression tests tie exercises to laboratory output; journeys 3, 4, 09 and 10 | done |
| UNI-20 | Private access, hidden solutions, safe files | auth, server-only instructor artifacts, signature/size/type validation, sandboxed file route, hashed device tokens, SSRF-guarded imports | journey 5/6 security test (including a forged session cookie and sign-up after setup with the bootstrap code); db tests | done for the library; full sweep M7 |
| UNI-21 | Budgets, provider failure, non-AI fallback | `packages/ai/src/budget.ts` (always-hard limits under fixed ceilings, worst-case checks), `state.ts` (scripted, live or blocked; approval of paid use), `apps/web/src/lib/model-runs.ts` (refused runs recorded, the learner's message kept, an abandoned reply still recorded), `services/provider-config.ts` (live runs reserved at their worst case under a per-owner lock), Settings → Live tutoring | budget, state and provider-config tests (reservations, the lock, recorded spend); the provider contract test on a local mock; the worker assessment test; journey spec 10 (a live model that cannot run) | done; no silent fallback; the live provider is unverified (no key, no approval) |
| UNI-22 | Responsive scholarly design, accessibility | design tokens (contrast corrected), both viewports, axe spec | 35 screenshots at both viewports; axe: no serious/critical findings | done; WCAG criteria checked, not certified |
| UNI-23 | Export, backup, restore, deletion | Records exports (JSON, Markdown), `scripts/backup.ts`, `scripts/restore.ts` (dry run, transaction), library item deletion with retention note | restore rehearsal into a throw-away database: counts match | done |
| UNI-24 | Local reproducibility, truthful deployment | README, Dockerfiles, `infra/`, `pnpm health` | local stack reproduced; the production build rehearsed on new, empty databases; deployed to Railway (Milestone 10 released 9 Nov 2026; the audit's fixes 10 Nov 2026), live checks recorded in QA_REPORT | done; the journeys are not run on the live site |
| UNI-25 | Software QA plus educational evaluations | 254 unit, 23 worker and 88 integration tests, 10 journey specs at two viewports (87 journeys), 19 academic evaluations, content regression tests; tests audited against the owner's rules by two independent reviewers | QA_REPORT | done |
| UNI-26 | Accurate handoff, minimal manual steps | STATUS, USER_ACTIONS, HANDOFF | – | done |
| MBA-01 | The owner's Mind, Brain and AI update, sections 1 to 12 | see MIND_BRAIN_AI.md, one row per requirement | unit, integration, seed and journey tests listed there | done |
| MBA-02 | The update's sections 13 to 20: programme experience, teaching and regressions, coverage, the research studio, tests, the live product, handoff | see MIND_BRAIN_AI.md, "Sections 13 to 20" | the tests and journeys listed there; QA_REPORT, Milestone 10 | done, except what needs the owner: the account on the live site and a key with approved paid use, then the owner's checklist (USER_ACTIONS.md, item 4) |

## Teaching experience (brief `CORNIVERSITY_CLAUDE_CODE_NEXT_BUILD.md`)

Baseline is the state at `984fb5e` (10 Nov 2026) before this work: existing, partial, missing or
blocked. Status is updated in the change that alters it.

| ID | Requirement | Baseline | Code | Tests / evidence | Status / next step |
|---|---|---|---|---|---|
| CORE-01 | Connected lectures, reading, tutorials, labs and resumable cross-session work | partial: sessions resume one activity; drafts autosave last-write-wins; reader position, pause, selection questions, video/external progress and session close missing | – | – | Milestone 13 |
| CORE-02 | Paper-first proof and science work; four help modes; assistance provenance | partial: typed attempts, hint ladder, practice reveal; `submission_version.transcription` unused; no pages, no help modes | – | – | Milestone 13 |
| CORE-03 | Concept-level prerequisite bridges that return to the lesson | partial: concept rules with alternatives and course-level bridges; MBI-08 biology inexpressible; no concept bridges or return path | – | – | Milestones 12–13 |
| CORE-04 | Evidence-linked mistake notes, questions shelf, bounded review | partial: `misconception_record` active/cleared, questions as notebook kind, definition-only revision with weekly cap | – | – | Milestone 14 |
| CORE-05 | Problem progressions with provenance, hints, solutions, transfer and counterexamples | partial: 99 exercises with hint ladders and rubrics; no progression stage, difficulty basis or help-mode policy | – | – | Milestone 14 |
| CORE-06 | Course-preparation service with finite budgets and sustained content | partial: units prepared in `content/` by hand; `prepare-unit` queue reserved, no hosted pipeline | – | – | Milestone 14 |
| EXT-01 | Optional voice tutorials and oral explanations | missing | – | – | Milestone 15 |
| EXT-02 | Reviewed visual explanations and original rendered teaching films | missing (plots exist inside laboratories) | – | – | Milestone 15 |
| EXT-03 | Faculty, bounded classmates, seminars, office hours | existing: personas, peers with mute, bounded discussions, office hours, quiet mode | – | – | Milestone 16: teaching styles, two-peer cap, memory purposes |
| EXT-04 | Functional 2D campus; Today, My studies, operations views | partial: campus map with list equivalent, campus home, My Studies; no operations view | – | – | Milestone 16 |
| EXT-05 | Department/programme/reading-course extension workflow | missing (catalogue grows only through `content/`) | – | – | Milestone 16 |
| EXT-06 | Bounded role-based academic coordination | partial: role contracts with limits; no task states over a pipeline | – | – | Milestone 16 |
| REL-01 | Budget correctness: strict bound, atomic reservations, fixed precision, unsettled runs, idempotency, parent/child | partial: worst-case reservations under a per-owner lock; ASCII counted at 3 chars/token; SDK retries unreserved; uncertain failures recorded at zero | – | – | Milestone 12 |
| REL-02 | Security on every new route, sanitisation, isolation | existing for current routes | – | – | Milestone 17 sweep |
| REL-03 | Upgrade on a populated database; migrations additive; seed twice | partial: seed idempotence test; no populated-upgrade fixture | – | – | Milestone 17 |
| REL-04 | Backup/restore of the database including new tables; private source backup | partial: database backup/restore tested; no source backup, no remote | – | – | Milestone 17 |
| REL-05 | Release to the existing Railway project and truthful live verification | existing procedure (worker, then web) | – | – | Milestone 17 |
| REL-06 | Accessibility and both viewports for new screens | existing axe spec for current screens | – | – | each milestone |
