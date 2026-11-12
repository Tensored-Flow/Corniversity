# Evidence
Baseline inspection: clean main 1216ffa; Linux SSH available; public health endpoint healthy.

- Baseline: 336 core/AI/content/companion/web tests; 152 DB integration tests; 39 worker tests passed on isolated Linux clusters. No live provider calls.
- Linux install needed existing @embedded-postgres/linux-x64 package postinstall explicitly allowed; frozen lockfile unchanged.
- Geometry source URLs repaired from independently fetched official PDFs; provenance inventory is /tmp/corniversity-maths-source-inventory.json on SSH host.

- Baseline targeted browser run: 5/6 pass; isolated lean-course journey failed because it assumed orientation was completed by spec01. Added explicit completeOrientation helper for standalone journey; no production change or test assertion removed.

## Integrated engine checks
Core/AI/web/companion:327tests across40files passed. Full database integration157tests across23files passed on isolated5438 cluster. Linux QA revealed Windows-specific test-storage paths and cwd fallback; changed four test config/setup files to node:os.tmpdir so tests no longer create C:/ or PostgreSQL artifacts inside the checkout. Worker regression rerun follows.

### Final pre-release gate disposition

All 53 distinct targeted browser cases pass across desktop and mobile after focused repair/reruns. Initial run:49 pass/4 failures. First rerun:18/19 pass, resolving both source-blocking tests after worker restart and the mobile selection/Send flow after formula containment; axe then exposed the older visual-player scroll region. Final rebuilt mobile accessibility run:3/3 pass, axe reports no violations on the listed pages. Unit notes, session lesson and visual diagrams now have keyboard-accessible contained overflow with visible focus. Independent code review covers the lesson changes; lead checked the identical labelled-section pattern for diagrams. Final lint, seven-package typecheck and production build pass after all UI changes.

The last science typography pass changes whitespace only in40Markdown files: all non-whitespace content is identical and code/delimited maths are byte-for-byte unchanged. Final content tests24/24 and academic evaluations19/19 pass after review metadata; generated coverage is refreshed. Credential-signature/path scan of staged changes found no credentials or auth-state files. Source bodies and runtime credentials remain outside git.

Read-only hosted audit: one existing owner, no enrolments, current selected course versions CHE2/CSA1/MAT2302/MAT2611/PHY1. Reviewed source editions are CHE3/CSA3/MAT2303/MAT2614/PHY2; these are not the database revision sequence numbers. Existing Railway service console is available; no new SSH key, public database exposure, replacement owner or password change is required.


### Production release and enrolment — 12 November 2026

Reviewed source commit: `36ae0c3baf61bc139b9b6bf76f12d6f3b53fabc7`, branch `codex/university-teaching-quality`, draft PR https://github.com/Tensored-Flow/Corniversity/pull/1. The existing Railway project was reused; main was not merged. Worker deployment `bd7dfc36-f7ec-4e2d-aaf5-de7ac4f7e2f8` and web deployment `11c199fd-ebe4-45c1-aa44-135b4ee49477` both report SUCCESS. Worker startup migrated successfully and seeded five changed course revisions with 81 unchanged. Public `/api/health` at 05:34:26 UTC reports `ok:true`, database `ok`, migrations `current`, seven of seven scripted assets, tutor 1.4 and assessor 1.3.

The authenticated service console checked the single existing owner and recomputed the seed content hash from each deployed course specification, unit specification, lesson, exercise and instructor artifact. Each hash matched its current database revision before mutation. Normal `enrol()` calls for all five courses ran in one database transaction; subsequent `listEnrolments()` returned five active enrolled records. Before release there were no enrolments. No replacement account, password reset, provider change, new SSH credential or public database exposure was needed. Existing learning records were not reset.

| Course | Source edition | Current DB revision | Verified enrolment |
|---|---:|---:|---|
| CHE-101 | 3 | 3 | active / enrolled |
| PHY-210 | 2 | 2 | active / enrolled |
| MAT-230 | 3 | 3 | active / enrolled |
| MAT-261 | 4 | 2 | active / enrolled |
| CSA-210 | 3 | 2 | active / enrolled |

The first preflight incorrectly compared database revision counters with source edition numbers. It stopped before the transaction and made no enrolment changes. The corrected preflight checks actual content hashes and source editions separately, then enrols.

The hosted teacher configuration remains `fixture`. The tutor and generation improvements are deployed, but scripted responses do not establish live pedagogical quality. No app model call or subscription/API generation was used, and no live-provider connection was enabled. Signed-in production learner journeys remain untested; browser acceptance ran against the isolated fixture account.

Final release-documentation review found no remaining material claim issue. The temporary Linux QA web/worker/database and local port-forward were stopped; ports 3330, 3331 and 5547 are no longer listening. Hosted health remained healthy at 05:42:17 UTC. Test data is preserved locally.
