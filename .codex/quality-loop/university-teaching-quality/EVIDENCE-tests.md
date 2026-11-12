# Independent non-browser regression evidence — 12 November 2026

Run by the independent code reviewer on the Linux checkout `/home/leon/work/Corniversity`, branch `codex/university-teaching-quality`, Node24.18.1 / pnpm12.16.1. The lead owns lint, production build, browser journeys and deployment. Test databases are disposable clusters on5438/5439, separate from the QA app and all production/owner data. Provider contract tests use local doubles or fixtures; no external model API or ChatGPT subscription was used.

## Completed checks

| Check | Observed result |
|---|---|
| `pnpm test` first phase (core/AI/content/companion/web) |362/363 passed across46 files. The sole failure was the generated MBI07 coverage table lagging the completed CSA-210 units. The chained worker phase therefore did not run in this command. |
| Targeted content coverage after lead regeneration |3/3 passed. This resolves the sole first-phase failure; previously passing cases were not repeated without a new reason. |
| `pnpm test:integration` |166/166 passed across23 database files,21.31s. |
| `pnpm typecheck` |Passed all7 workspace packages. |
| `pnpm eval:academic` |19/19 fixed academic-evaluation cases passed. These are deterministic regression cases, not certification of all course material or a live-model assessment. |
| Full worker suite |52/53 passed across10 files,18.09s. The sole failure was the updated seed test expecting `prepared` instead of the actual domain enum `teaching_available`; core/programme/progress.ts maps that enum to the UI wording “Prepared”. The targeted seed suite now passes8/8 after the enum correction. |

The full DB suite covers owner isolation, permissions, library deletion, source freshness, provider reservation concurrency, publication, study state, exams, backups and restore. Worker tests cover ingestion, local-provider preparation and assessment, reseeding, isolated account recovery, transcription and related handlers. The synthetic recovery tests do not reset a real owner account.

## Targeted engineering evidence already recorded in CODE_REVIEW.md

Source-boundary database12/12; final preparation/assessment25/25; Markdown/history/provider-dispatch16/16. Admission-time permission withdrawal, source removal, edition/course changes and guard-query rejection send no model request and settle the reserved run with zero cost. Stored assessment citations preserve asset/passage identity. Full-document rendering preserves fenced code, lists, references and footnotes while retaining sanitisation.

## Final targeted rechecks and scope

After the lead corrected the enum expectation, the seed-idempotence suite passes8/8. After the final science-content/hint and kinetics-check changes, the complete content project24/24 and academic evaluations19/19 pass together. These resolve both failures from the full-suite attempts. The checked regression scope comprises363 non-worker unit/content tests,53 worker tests,166 database integration tests and19 academic evaluation cases (601 distinct cases); passing unaffected suites were not needlessly repeated.

The KineticsLab readout repair was independently inspected: its selected RK4 sample is unchanged, but the label now uses that sample’s actual time and says nearest. For dt2 and requested time5, index3 correctly labels time6; requests beyond the simulated range correctly use the final available sample time. No numerical algorithm or state mutation changed. The lead owns the requested browser checks for those cases and the subsequent build/typecheck.

This file does not claim a final build/browser/release result. Later repairs may require relevant checks again; assess that from the final diff.
