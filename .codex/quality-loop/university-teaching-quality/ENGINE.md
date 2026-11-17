# Engine implementation — 12 November 2026

Scope: AC-01, AC-02 and AC-03 in QUALITY_CONTRACT.md. Implementation is ready for independent review. No deployment, enrollment or live model generation was performed by this writer.

## Source-grounded authoring
- Authoring retrieves actual processed library passages belonging to the current owner and course, restricted to the source editions assigned to the unit.
- Local-only, deleted, unprocessed, other-owner, other-course and other-edition items are excluded; external-AI permission is checked during retrieval and again immediately before a provider call.
- Missing passages block before provider-run reservation. Registered bibliography/section pointers are never treated as read text.
- At most eight passages of 2,400 characters are sent; excerpting is disclosed. The full bounded prompt remains subject to the existing admission and preparation budget checks.
- Draft citations must reference supplied passage IDs or supplied further-reading locations. Server-recorded allowed IDs and original objectives are retained with the checks; publication reruns the gates from this record. Legacy drafts without provenance must be regenerated/reviewed.
- Assessor evidence now includes permissioned matching library passages for the current course. The prompt distinguishes pointers from evidence, requires review for reference discrepancies and permits alternate correct arguments.

## Teaching and tutoring
- Drafts need a substantial lesson, non-repetitive text, a separately stored worked example, complete planned objective mappings and independent plus transfer/counterexample/synthesis exercises.
- The check stage explicitly says it checks evidence and teaching structure, not academic correctness. Citation membership, objective indices, text length and repetition are mechanical heuristics; they cannot establish claim support, mathematical correctness or learning gains.
- Worked examples are rendered into the learner-facing published lesson. Instructor solutions remain separate.
- Tutor attachment preparation now carries current learner-facing notes (up to 12,000 characters) and current saved work (up to 20,000 characters, or latest submission when the draft is empty). Longer text preserves the opening plus selection context or conclusion, with explicit omission markers and identical preview disclosure.
- Selection scope, exam/self-test restrictions, hints, instructor separation and existing provider budgets remain in place. Full explanation instructions no longer impose an arbitrary 300-word cap.

## Validation run on isolated Linux fixtures
- pnpm typecheck: passed across workspace.
- Core/AI/web combined: 314 tests passed and one notice-allowlist test failed. Added the two new publication notices, then reran that entire notice file: 5/5 passed. All new core/context/web regressions passed in the combined run.
- Focused database integration: preparation.test.ts, source-evidence.test.ts and library.test.ts: 29/29 passed.
- Focused worker integration: prepare.handler.test.ts and assess.handler.test.ts: 13/13 passed.
- Worker tests use a local HTTP wire-format double and synthetic keys, never an external service. They assert missing/withdrawn evidence costs no call or reservation; supplied passage text reaches the prompt; unrelated registered locator IDs and invented passage IDs fail; repetitive drafts fail; budget refusal remains; only owner publication changes the unit.
- The publication/reseed regression verifies all three generated exercises and all three instructor artifacts survive unchanged, using the lead writer's seeder repair.
- Biome check/write on the 18 initial owned files passed; notices and E2E12 follow-up files also passed Biome. Existing deprecated Biome-config warning is unrelated.
- E2E12 continues to exercise the unselected outlined NEU-220 course and now expects the missing-permitted-passages blocker. Browser execution remains the lead's integration check.
- Test ports 5438 and 5439 are released.

## Review boundaries and follow-up
- No claim of independent academic correctness is made by these gates or by the authored test fixture.
- Runtime generation still requires explicitly permissioned, course-associated library material linked to the unit's source edition. This does not automatically ingest public websites.
- Exact preservation of planned objective text prevents a model from shrinking the syllabus; old outlines with placeholder objectives should have their plans authored before generation.
- No migration is needed: optional draft schema additions keep saved legacy data readable; old drafts cannot bypass current publication checks.
- Lead retains full-suite, production build, independent review and renderer validation ownership.
