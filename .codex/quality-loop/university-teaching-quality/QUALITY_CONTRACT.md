# Quality contract — university teaching quality

## Task and outcome
Improve source-grounded generation, tutorial context and academic safeguards; complete and independently review all five selected courses; make the reviewed material available and enrol the existing owner where authenticated access permits. User explicitly selected FULL courses rather than opening units on 12 November 2026.

## Acceptance criteria
- AC-01: Unit authoring uses actual permissioned source passages, scopes allowed citations to supplied evidence, and refuses source-dependent drafting without evidence. No runtime model/subscription calls during this task.
- AC-02: Draft gates reject repetitive filler, missing worked reasoning, unsupported objective coverage and absent meaningful exercise progression. Gates are labelled structural/pedagogical checks, never proof of academic correctness; owner publication and provenance remain explicit.
- AC-03: Tutor sees the current learner-facing lesson and a bounded but substantially complete attempt; any truncation is disclosed; selection scope and self-test/solution release rules remain intact. Full explanations can be as long as needed within existing budget limits. Assessor respects alternate correct arguments and uncertainty.
- AC-04: Complete all units of CHE-101 (10), PHY-210 (10), MAT-230 (12), MAT-261 (12), CSA-210 (10), preserving IDs and existing work. Each has substantive source-anchored notes, worked reasoning, original independent/transfer problems, progressive hints, complete instructor solutions/rubrics, and cumulative synthesis. No outlines labelled ready. No arbitrary shortening of course promises.
- AC-05: All changed substantive teaching receives separate source/factual review, independent solution recomputation, and final post-repair review. Record exact checked scopes and unresolved limits; no claim of human expert or empirical learning validation.
- AC-06: Typecheck, lint, content validation, relevant unit/integration/worker tests and production build pass; representative real renderer journeys pass on isolated data. No live paid model tests.
- AC-07: Use existing owner authentication and enrolment services to take these five courses; preserve all prior progress, attempts, preferences and unrelated enrolments. If owner login is required, make all other work reviewable first and state that exact remaining dependency.
- AC-08: Durable docs reflect final code/content/review/deployment state. Ship to the existing app when authorized access permits; verify final service health and source version. Never bootstrap a replacement project or owner.

## Constraints
No Corniversity ChatGPT-plan connection, third-party model API, subscription credential reuse or paid generation. All course authoring/review takes place in this Codex task and subagents. No unrelated Kalibr changes. No private books or credentials in git. Source content remains under its applicable rights. Existing course/units/answers version safely. Course structure stays long-form lecture notes and problem sheets, not forced microlearning. Five courses means chemistry + physics + two maths + CS/AI.

## Scope and ownership
Engine writer: generation/tutor/evidence code and direct tests only. Maths author: content/courses/MAT-230 and MAT-261 only plus own review ledger. Science author: content/courses/CHE-101, PHY-210 and CSA-210 only plus own ledger. Lead: integration, environment, shared content/schema changes, documentation, reviews and release. Ownership is disjoint; no agent reverts another's edits.

## Baseline
Clean origin/main 1216ffa34f71378a1a8d9b05f738a190e298ec98 cloned on kalibr-server at /home/leon/work/Corniversity. Work branch codex/university-teaching-quality. Dependencies installation underway with frozen lockfile. Existing ready units reviewed as source material, not assumed flawless.

## Validation and evidence
pnpm content:validate; pnpm typecheck; pnpm lint; pnpm test; pnpm test:integration; pnpm eval:academic; pnpm build; targeted isolated browser journeys; independent source and solution reports. Tests use throwaway clusters on 5438/5439, never hosted data.

## Milestones
1. Establish environment and contracts; trace evidence/permission paths.
2. Implement generation/tutor improvements while disjoint authors finish courses.
3. Source and independent academic review; repair and regression validation.
4. Fresh final review, renderer verification and release/enrolment.

## Human-required judgments
Whether Leon enjoys the experience; long-term learning gains; external expert certification. Agent consensus is not evidence for these.

## Loop bound
Maximum five complete review/repair rounds, focused follow-up after repairs. Diagnose repeated defects rather than blind repetition.
