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

Read-only hosted audit: one existing owner, no enrolments, current selected course versions CHE2/CSA1/MAT2302/MAT2611/PHY1. Reviewed upgrades are CHE3/CSA3/MAT2303/MAT2614/PHY2. Existing Railway service console is available; no new SSH key, public database exposure, replacement owner or password change is required.
