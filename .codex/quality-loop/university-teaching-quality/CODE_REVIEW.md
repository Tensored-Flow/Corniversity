# Independent engineering review — 12 November 2026

Reviewer: fresh code_review agent, independent of implementation. Baseline: 1216ffa34f71378a1a8d9b05f738a190e298ec98. This reviews the current uncommitted engineering changes; academic authoring is outside scope. Recommendation: repair the findings below before release, then obtain a focused independent recheck.

## Findings

### CR-01 — P1: source availability and consent are not revalidated consistently at dispatch

`packages/db/src/services/preparation.ts:625` rechecks only `isAllowed(..., external_ai)`. That function reads permission rows, not the current asset or passage. Both `deleteAsset` and denial of `private_cloud_store` remove the passages and delete or make the asset local-only without removing an existing external-AI allowance. A source removed after retrieval but during asynchronous provider admission therefore still passes this final predicate, and its cached text remains in the prompt.

The new library retrieval in `apps/worker/src/handlers/assess.ts:110` has no source recheck after `planRun` at all before the call at line167. Even explicit external-AI withdrawal during admission is therefore not respected. The tutor route has the same pre-existing interval between `buildUnitEvidence` and dispatch through `streamPersonaTurn`; include it when applying the common guard so the updated teaching paths have one coherent boundary.

Independent reproduction: `/tmp/corniversity-code-review-recheck.mts` creates and tears down a separate PostgreSQL cluster on5559 and uses real library services with synthetic text. After capturing one passage:

- `deleteAsset`: current asset is null; current external-AI allowance remains true; new retrieval returns0; cached text still exists.
- `setPermission(private_cloud_store, denied)` on a companion asset: status becomes registered_local and localOnly=true; external-AI allowance remains true; new retrieval returns0; cached text still exists.

No external provider was called. This reproduces the invalid final predicate; the send follows directly from the current call site.

Repair: add a shared exact-passage freshness guard, checking current passageId/assetId relationship, asset owner, course association, processed/nondeleted/nonlocal state, relevant assigned source edition for preparation, and latest external-AI decision. Invoke after admission, as close to dispatch as possible. Refuse the entire stale prompt, settle any reserved run as blocked with zero attempts, and retain the learner work. A full snapshot/retrieval retry is optional; do not send the cached text on failure.

Required regressions: pause/instrument the admission boundary, then delete the captured asset, withdraw private storage, revoke external-AI permission, change its course/edition association, or remove the captured passage. Assert zero provider calls, zero billed attempts, and correct blocked status/reservation release. Cover preparation and the newly evidence-bearing assessor, plus the tutor hook. Keep the existing pre-retrieval refusal tests.

### CR-02 — P2: assessor drops stable identities of the newly supported passage citations

`apps/worker/src/handlers/assess.ts:250` serializes only tag, locatorId and label. Library evidence has assetId/passageId and no locatorId, so a source-backed assessment loses the identity of the source it actually used when feedback is persisted. This was harmless when this path only supplied registry locators; the change introduces passage references. The shared Citation schema already supports both IDs, and tutoring preserves them.

Repair: persist assetId and passageId along with the existing fields. Add an assessor integration case whose model-double response cites a supplied library tag, then assert the stored feedback citation resolves to the actual asset and passage. A tag or matching human title alone does not establish source identity.

### CR-03 — P2: reparsing each Markdown AST block loses reference definitions

`apps/web/src/lib/markdown.ts:130` splits a correctly parsed document into node source slices, then processes each slice independently. Document-level link definitions no longer accompany paragraphs that refer to them.

Independent baseline/current reproduction using the real renderer (esbuild bundle, server-only stub) is saved at `/tmp/corniversity-code-review-markdown.mjs`. Input:

```markdown
[source]: https://example.test/reading
Read [the source][source].
```

Baseline1216ffa renders a link. Current renders literal `[the source][source]`. This is a new regression, separate from the useful fenced-code and list repair.

Repair: preserve one document AST through the transformation/rendering pipeline, applying named-environment wrapping to paragraph nodes (and preserving the sanitiser), or otherwise carry global definitions consistently. Add reference-link and footnote cases alongside existing blank-line fence/list tests. Do not restore blank-line splitting, which corrupts executable code.

## Checked paths and positive evidence

Inspected the source retrieval query and owner/course/edition/permission filters, source-required block before reservation, draft schema and gates, recorded provenance and publication transaction, tutor attachment builder and route, model-run dispatch, assessor/reference separation and feedback serialization, seeder preservation of published teaching, Markdown renderer/sanitiser, portable test directories, and direct tests.

- Draft citations are scoped to supplied IDs; registered location labels are explicitly distinguished from read evidence.
- Planned objectives cannot silently shrink during drafting. Current publication reruns the structural gates against server-recorded provenance, and legacy drafts cannot bypass them.
- Automatic gate wording correctly avoids claiming academic verification. Word counts, repeated-token tests and objective-index membership remain heuristics, as documented.
- Tutor uses learner-facing notes and the latest owner-scoped work, with explicit bounds and omission disclosure. The inspected attachment builder does not load instructor solutions; exam/self-test help decisions remain in place.
- The seeder change protects the published unit’s exercises and instructor artifacts as well as its lesson. Existing stable IDs are preserved.
- The renderer retains the strict HTML/URL sanitiser, escaped named-environment titles and untrusted KaTeX configuration.
- Linux test-directory changes use OS temporary paths rather than a Windows absolute-path literal.

Executed focused tests independently: core pipeline7, bounded tutor context3, web tutor attachments4, Markdown6; all20 passed. Existing worker tests check pre-execution revocation but not withdrawal after retrieval/admission, so these passing results do not discharge CR-01. The source-freshness reproduction used isolated synthetic data and cleaned its cluster. No real account data or runtime model subscription was used.

## Limits

No production deployment, live-model evaluation, complete browser pass, or academic-content review is claimed here. Full workspace validation and final source-state validation remain with the lead. Concurrency between a final database check and remote network transmission cannot be made literally atomic; the requested repair removes the demonstrable stale snapshot across admission, with the final check immediately before dispatch. Review conclusions apply to the source state inspected and require focused recheck after repair.

## Focused post-repair review, round2 — 12 November 2026

Independently reread the repaired query, generation and assessment dispatch paths, tutor dispatch hook, citation serialization and whole-document Markdown pipeline. Independently reran source-evidence DB12/12, preparation+assessment worker23/23, and Markdown+model-runs web11/11. All46 passed. The original baseline/current reference-link reproduction now produces the same correct link.

- CR-02: resolved in the inspected code. Asset and passage IDs are persisted; the local-provider integration test verifies the actual feedback record.
- CR-03: resolved in the inspected code. A single full document passes through sanitisation; named-environment wrapping uses fixed classes and text-node titles after sanitisation. Reference and footnote definitions, fences and lists survive.
- CR-01: normal stale-source outcomes are resolved by the single-query exact-passage guard. Independent test reruns verify changed permission, storage, availability, association and passage identity are rejected, with no provider dispatch and a finished blocked reservation.

Two related follow-ups remain at this review checkpoint:

1. The new guard can throw before dispatch. Tutor handles this as blocked/zero-attempt; preparation rethrows non-ProviderError and assessment awaits the guard outside its provider try. Those two paths leave a reserved run running even though no external call happened; stale-run maintenance later marks it unsettled and continues holding its worst case. Catch failures specifically around the predispatch guard, then settle blocked/zero-attempt and preserve the submission. Add rejected-guard regression tests. A database that remains unavailable can naturally prevent settlement; do not claim atomicity across an outage.
2. Prior tutor replies are currently resent through citedHistory/boundedHistory. citedHistory only rewrites citation tags as labels, so a reply quoting a now-revoked library passage can survive even though current retrieval excludes that source. Omit historical persona replies whose recorded library citations are no longer permitted, without deleting the learner record or blocking every future turn; include surviving history passage refs in the final dispatch guard. Test stale-history omission, valid-history retention and withdrawal during admission. Legacy uncited source-derived text cannot be reliably attributed retrospectively from the current stored data; this is an explicit provenance limitation, not a promise to purge every historical derivation.

## Final focused disposition, round3 — 12 November 2026

All three original findings are resolved within the reviewed engineering scope. No further release-blocking defect was found in the final focused repair review.

- CR-01 guard exceptions: preparation and assessment now convert a failed freshness query to the same no-dispatch blocked result. Independent worker rerun passes13 preparation and12 assessment tests, including the new admission-time check-error cases; the tests assert zero provider calls, zero cost, finished blocked reservations and preserved submissions. The tutor already handles rejected checks through the same blocked/zero-attempt outcome.
- CR-01 tutor history: the bounded candidate history is screened using recorded asset/passage identities. Replies with unavailable identities are omitted from the outgoing prompt; the learner record and new question remain. Decisions are memoised per identity, and retained history references join current evidence in the final dispatch check. History filtering errors fail closed by omitting the affected reply. Inspected the actual route wiring as well as the helper.
- CR-02 citation preservation and CR-03 full-document rendering remain intact.

Final independent executions: content validation0 errors/0 warnings; worker25/25; web16/16 (history5, model-runs3, Markdown8). The source-boundary database12/12 passed in round2 against the unchanged guard implementation. No test used an external model API; worker provider traffic stayed at a local wire-format double.

Limits: the history guard protects source identities actually stored with a reply. An uncited historical paraphrase, whether old or newly produced, cannot be reliably attributed from the stored citation data; this is not a general deletion or provenance guarantee for every context-derived sentence. Comprehensive per-turn context provenance would be a separate design. The unavoidable interval between the final database snapshot and network dispatch remains, and persistent database failure can prevent recording any outcome. This review does not certify academic correctness, live-model pedagogy, production deployment or learning gains. The lead retains whole-workspace checks and browser/release verification.

## Independent full non-browser regression follow-through

See EVIDENCE-tests.md for exact commands, first-run failures and targeted resolutions. The checked scope now has601 distinct passing cases:363 non-worker unit/content,53 worker,166 database and19 academic-evaluation tests. Full typecheck passed7 workspace packages before the final tiny KineticsLab label change; the lead owns its subsequent typecheck/build/browser pass. The coverage-table drift and incorrect seed-test enum were repaired by the lead and independently rechecked. Final content24/24 and academic19/19 were rerun after science-content and deterministic-check repairs. The RK4 label repair was read and found to accurately display the actual selected sample time without changing the solver.

## Final mobile containment review

Independently inspected the stable changes to the unit notes page and session LessonReader, including their surrounding layout, selection/reader-anchor logic, RenderedHtml boundary and focus CSS. The session notes now contain horizontal overflow in a labelled section; both notes surfaces are keyboard-focusable with a visible theme-backed outline. This preserves readable wide mathematics without expanding the document or removing keyboard access. The HTMLElement ref matches the semantic section, and selection capture, saved headings and the separate selection controls retain their existing paths. The narrow Biome exemption documents the scroll-region focus requirement; targeted Biome checks pass for both files with no fixes (only the existing configuration deprecation notice). No additional code defect was found in this two-file repair. The worker reports the mobile viewport/hit-target reproduction and live-style containment trial; this reviewer does not present those as independently observed browser results. The rebuilt mobile journey, keyboard/axe checks and Send hit-target verification remain the lead’s final browser gate.
