# Status

Last updated: 12 November 2026. Milestone 20 completes the five selected courses and strengthens source-grounded preparation and tutorial context. Academic review and non-browser validation are complete. All build and browser gates pass. Deployment and existing-owner enrolment are the remaining release steps; they must not be inferred from the local checks below.

## Current teaching

| Course | Complete units | Original exercises | Course version |
|---|---:|---:|---:|
| CHE-101 Principles of Chemical Science | 10 | 37 | 3 |
| PHY-210 Special Relativity and Minkowski Geometry | 10 | 33 | 2 |
| MAT-230 Functional Analysis I | 12 | 44 | 3 |
| MAT-261 Smooth Manifolds | 12 | 43 | 4 |
| CSA-210 Deep Learning Foundations | 10 | 38 | 3 |

All 54 units have substantive lessons, original assessed work, progressive hints, rubrics, complete instructor reference reasoning and cumulative synthesis. All 195 solutions received independent reasoning checks; source/factual and post-repair reviews have separate ledgers under `.codex/quality-loop/university-teaching-quality/`. The CS course includes a complete executable CPU capstone; its output was independently reproduced. These are AI-assisted reviews, not human expert certification, accreditation or measured learning gains. Workload estimates are provisional.

Catalogue totals: 86 courses; 12 teaching-ready launch courses; 141 units, 72 ready; 250 original exercises; 59 sources and 1,166 verified locators. Other catalogue courses retain their actual readiness.

## Generation and tutor

Preparation requires actual permissioned source passages before any draft model call. Structural gates check objective alignment, substantive worked reasoning, exercise progression, citation scope and repetitive filler; they do not prove factual correctness. Evidence permissions are rechecked immediately before provider calls, including deletion, private-cloud withdrawal and external-AI withdrawal. Failure blocks the call and settles the reservation without an attempt. Tutor history omits replies whose recorded source identities are no longer permitted; uncited historical paraphrases cannot be reliably attributed by this guard.

The tutor receives the current learner-facing lesson and a bounded, substantially complete current attempt, with disclosed omissions. Full explanations have room for complete reasoning. Alternate correct arguments remain admissible; self-test and reference-release boundaries remain enforced. Whole-document Markdown rendering preserves lists, reference links, footnotes, code and mathematical accessibility.

No Corniversity runtime model, ChatGPT-plan subscription or paid model API was used to author, review or test these courses. Runtime live-tutor quality has not been measured in this task. Scripted-demo tests are explicitly labelled.

## Validation and environment

- 601 distinct regression cases pass across core/AI/content/companion/web, worker, database and academic evaluations; the two stale coverage/enum expectations were repaired and rerun.
- Seven-package typecheck, lint and production build pass. Content validation reports zero errors or warnings; strict KaTeX renders 8,116 expressions without error.
- All 53 distinct targeted desktop/mobile browser cases pass after repairs. The final reruns passed 18 of 19 cases, then all 3 setup/mobile accessibility cases after the remaining diagram fix. Long lesson formulas are horizontally contained with keyboard access; the tutor Send hit target remains usable. Axe reports no violations on the tested pages.
- Linux checkout: `/home/leon/work/Corniversity`, branch `codex/university-teaching-quality`; Node 24.18.1, pnpm 12.16.1. GitHub origin: `https://github.com/Tensored-Flow/Corniversity.git` (public).
- QA uses a separate local-only fixture database on port 5547 and web port 3330. Its account and records are disposable test data, not the hosted owner. Never run Playwright journeys against production.
- The existing Railway project `corniversity` has web, worker and Postgres services. CLI authentication is refreshed and the checkout is linked to that existing project. No new project or owner was created. The existing hosted owner was verified read-only in Railway on 12 November; its current sign-in session is not available in the browser.

## Resume checkpoint

Commit reviewed source, deploy worker then web to the existing project and verify service health and content/prompt versions. Enrol the existing owner in the five selected courses through the normal enrolment service/UI, preserving prior work. If owner sign-in is needed, request only that handoff after the release is concrete. Do not reset the owner password or create a replacement owner. Keep `.env`, source-download caches and credentials out of git.

Historical release evidence remains in QA_REPORT.md and prior milestones in PLAN.md. The old Windows owner installation is separate from this Linux QA checkout. `pnpm deploy:railway` is a first-deployment script and must not be used for this existing project.
