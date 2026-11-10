# Architecture

A modular monolith (Next.js web app) plus a durable worker and a desktop companion, sharing
typed packages and one PostgreSQL database. No microservices, no separate vector database.

## Topology

```
 Browser ──HTTPS──▶ apps/web (Next.js 16, Node runtime)
                        │  services (packages/db)        ▲ SSE tutoring stream
                        │  enqueue (pg-boss, same tx)    │
                        ▼                                 │
                  PostgreSQL ◀──── apps/worker (pg-boss: ingest, prepare, assess, embed, maintain)
                        ▲
 Desktop ── apps/companion ──outbound HTTPS (device token)──▶ apps/web /api/companion/*
```

- **Local development**: `embedded-postgres` runs PostgreSQL 17 from Node (Docker is not
  installed on the owner's machine). Web and worker are separate processes against it.
- **Production (deployed)**: one Railway project, `corniversity` — PostgreSQL (pgvector template,
  because the standard Railway image has no pgvector), `web`, `worker`. Files are stored as blobs in
  PostgreSQL (`BlobStore` with `pg` and `fs` drivers); a volume would bind to one service only
  and object storage is not available without new billing. Documented deviation from the brief's
  "object storage" preference; S3-compatible driver is a later option.

## Packages and boundaries

| Package | Owns | Must not |
|---|---|---|
| `packages/core` | Zod schemas and types; prerequisite graph; readiness rules; evidence states; scheduling engine; ICS; workload; grounding/citation validation; deterministic academic checks; laboratories; programme routes and next steps; research-studio checks | import DB, Next, or provider SDKs |
| `packages/db` | Drizzle schema, migrations, client, `BlobStore`, **services** (all academic state changes), job names/payload schemas | contain UI or prompts |
| `packages/ai` | `ModelProvider` (Anthropic SDK, fixture), role contracts, prompt templates, structured output parsing, budget accounting, grounding glue | write to the DB directly (services do) |
| `packages/content` | Content schemas, validator, seeder | be imported by the browser |
| `apps/web` | Routes, server components, route handlers, server actions, SSE | run long jobs in requests |
| `apps/worker` | pg-boss queues and handlers | bypass services |
| `apps/companion` | pairing, watching, hashing, upload, status | read books it was not permitted to read |

## Domain operations (service names)

`bootstrapOwner`, `saveOnboardingStep`, `proposeProgramme`, `confirmPlan`, `enrol`, `withdraw`,
`pauseCourse`, `startSession`, `recordTurn`, `submitAttempt`, `reviewAttempt`, `publishFeedback`,
`revealReference`, `recordEvidence`, `recordLabInterpretation`, `createNotebookEntry`,
`scheduleRevision`, `reviewRevisionItem`, `requestResource`, `registerAsset`, `receiveUpload`,
`confirmAssetMetadata`, `setProcessingPermission`, `requestIngestion`, `ingestAsset`,
`importOpenResource`, `createAnnotation`, `proposeReschedule`, `applyReschedule`,
`requestExport`, `buildRecordsBundle`, `openDiscussion`, `recordDiscussionTurn`,
`setPeerMembership`, `updateProfileSettings`, `saveProviderSetting`, `saveBudgetLimits`,
`deletePersonaMemory`, `followProgramme`, `setParticipationStatus`, `proposeProgrammeRoute`,
`applyProgrammeProposal`, `updateStudyPreferences`, `previewCourseLoad`, `createDeadline`,
`withdrawDeadline`, `markDeadlinesMet`, `proposeRollingExtension`, `recordLabPrediction`,
`requestPredictAgain`, `followNewProgrammes`, `resolveProviderState`, `approvePaidUse`,
`withdrawPaidUseApproval`, `planRun`, `recordProviderRun`, `resetOwnerPassword`, and the research
studio's `createProject`, `setShelf`, `saveDraft`, `saveVersion`, `addProvenance`, `addArtifact`,
`requestFeedback`, `requestOralDiscussion`, `holdOralDiscussion` and `projectReport`. UI and model tools both call these; models never write. (`prepareUnit`
is reserved for the content pipeline; units are currently prepared in `content/` and validated.)

## Data model (areas → tables)

- **Identity/consent**: `user`, `session`, `account`, `verification` (better-auth); `learner_profile`,
  `budget_setting`, `provider_setting`, `consent_record`, `device_pairing`, `pairing_code`.
- **Academic structure**: `department`, `programme` (reference id, blocks, electives, methods and paper
  seminar as versioned content), `course`, `course_version` (with catalogue notes), `course_department`
  (cross-listing), `concept`, `course_concept`, `prerequisite_rule`, `teaching_unit`, `unit_exercise`,
  `rubric`, `instructor_artifact`.
- **Library**: `source`, `source_version`, `locator`, `resource_asset`, `asset_blob`,
  `processing_permission`, `extracted_page`, `passage` (FTS `tsvector`), `passage_embedding`
  (created only if pgvector exists), `annotation`, `resource_request`.
- **Study/planning**: `term`, `enrolment`, `availability_window`, `commitment`, `day_off`,
  `plan_version`, `scheduled_session`, `change_proposal`, `calendar_token`, `programme_participation`
  (following, paused or left; never an enrolment), `academic_deadline` (assessment, examination or
  milestone; binding only when the learner switched deadlines on). Study preferences live on
  `learner_profile.study_preferences` and hold only the learner's explicit choices.
- **Learning**: `learning_session`, `conversation`, `message`, `attempt`, `submission_version`,
  `assessment_run`, `feedback_review`, `evidence_event`, `concept_state`, `misconception_record`,
  `revision_item`, `notebook_entry`, `portfolio_artifact`.
- **People/community**: `persona`, `peer_membership`, `society`, `discussion`, `discussion_turn`,
  `persona_memory`.
- **Research studio**: `research_project` (owner, kind, question, shelf and leads, a demonstration
  flag), `research_document` (proposal, methods and report drafts), `research_version`
  (immutable numbered versions), `research_provenance`, `research_artifact` (a blob or a notebook
  entry), `research_feedback` (scripted, live or blocked, with its checks and the provider run),
  `research_oral_request`.
- **Operations**: `job_record`, `provider_run` (per-attempt usage when a server-side fallback
  ran, the worst-case estimate, `running` while a live run holds its worst case, and refused runs
  recorded as `blocked` or `budget_blocked`),
  `audit_event`, `export_record`, `app_setting`. `provider_setting` holds the provider, the model,
  the refusal-fallback choice and the owner's approval of paid use. A partial unique index allows
  one `user` with the role `owner`.

Invariants enforced in services and tests: grades reference exact submission/rubric/run
versions and keep the exercise as answered; citations resolve to immutable `source_version` + `locator`; enrolments reference a
`course_version`; cross-listing never duplicates attempts; instructor artifacts never serialize to
learners; permissions are per action; owner scoping on every query; idempotency keys on
enrolment, assessment, ingestion and ICS UIDs; proposed vs confirmed plans are distinct rows.

## AI orchestration

- Roles: director, convenor (content pipeline), lecturer, tutor, librarian, assessor, seminar
  chair, supervisor, peer. Each has a versioned contract: purpose, allowed tools (server
  functions), required context, forbidden actions, output schema, memory policy, limits.
- Grounding: evidence blocks are tagged `[E1]…[En]`; the model cites tags; the server maps tags to
  locator ids and drops unknown tags, flagging the sentence as uncited. Each turn numbers its
  evidence afresh, so replayed history replaces earlier tags with the labels of the sources they
  resolved to. Tutor passages come from the learner's permitted library by full-text search that
  any word of the question can match, best matches first. A reading-room selection is attributed
  to its page only when it is found on that page.
- Labels: `{source-backed}`, `{derived}`, `{conjecture}`, `{needs-checking}` markers → stored labels.
- Providers: `anthropic` (official SDK 1.3, beta Messages API: `messages.stream` for prose,
  `messages.create` with a Zod output format and the application's own validation for structured
  outputs, an explicit effort per role, optional server-side refusal fallback) and `fixture`, the
  scripted demo (deterministic, keyed by role and scenario). Supported models are an allow-list
  (`packages/ai/src/models.ts`); the default is `claude-opus-5-5`.
- Provider state (`packages/ai/src/state.ts`): `scripted`, `live` (a readable key, a supported
  model and the owner's approval covering the model, the fallback choice and the limits) or
  `blocked` with a stated reason. A blocked run is refused and recorded; nothing scripted
  replaces it. Every stored reply carries the id of the run that produced it, which is how it is
  labelled live or scripted afterwards.
- Budget: per-run, daily and monthly limits, always hard and capped by fixed ceilings. Before a
  live run, under a per-owner database lock, its worst case (the whole output allowance, the
  prompt counted conservatively, and with fallback on a second run whose prompt also carries the
  first attempt's output) is checked against the role's cap and every limit, counting other runs
  still in progress at their worst case; the run is then recorded as `running` and finished with
  its actual usage per attempt, also when the learner leaves mid-reply or the stream fails part
  way. The pricing table carries its date and source URL.
- Assets: `checkAiAssets` reports whether the scripted responses load and which prompt versions
  the build carries (counts and version names, never contents or paths); the health route and
  the worker's start-up log show it.
- Prompt-injection: retrieved text, uploads and persona messages are data; tools are allow-listed
  server functions; outbound fetches are host-allow-listed with SSRF guards.

## Jobs

The worker applies pending migrations on start and, when the deployment sets
`SEED_CONTENT_ON_START=1`, seeds the institution's content (idempotent; never learner data).
pg-boss 12 (`schema: pgboss`), queues: `ingest-asset` (singletonKey = sha256), `prepare-unit`
(singletonKey = unit id), `assess-submission` (singletonKey = submission version id),
`embed-passages`, `export-records`, `maintenance` (cron). Retries with backoff, expiry,
heartbeats for ingestion, dead-letter queues. `job_record` mirrors state for the UI.

## Security

better-auth sessions (secure cookies, origin checks, rate limiting); owner bootstrap requires
`OWNER_EMAIL` + `OWNER_BOOTSTRAP_CODE` and closes after the first account, which a unique index
guarantees even for concurrent submissions; the code is optional once the owner exists and can
then be removed from the deployment. Without email delivery, the owner's password is recovered by
an administrative command run in the worker's shell, never through the website; it revokes every
session (`apps/worker/src/admin/reset-owner-password.ts`). Every route handler
calls `requireSession`; files served only through authorized handlers; companion uses hashed
device tokens; Markdown sanitised (`rehype-sanitize` with KaTeX allow-list); uploads validated
(type, size, page count, decompression limits); secrets redacted from logs.

## Significant decisions

1. Product name Corniversity; brief text retained verbatim as the owner's document.
2. Embedded PostgreSQL for local work (no Docker available) — real Postgres semantics.
3. Blob store in PostgreSQL for production; `fs` driver for local mode.
4. pgvector optional; full-text search always on.
5. better-auth over hand-rolled auth; email+password baseline because email delivery is not set up.
6. Single `claude-opus-5-5` default for all teaching roles; cheaper models are an owner choice.
7. Open-licensed primary materials (MIT OCW CC BY-NC-SA, Neuromatch CC BY, Judson's AATA GFDL,
   Taylor & Wheeler CC BY, Sternberg CC BY-NC-SA, Wendl's explicit permission) may be imported
   from allow-listed hosts with the licence recorded as the basis of the item's permissions;
   everything else, including OpenStax Chemistry 2e (CC BY-NC-SA with an AI-ingestion
   restriction) and unlicensed author-hosted notes, is reference-only unless the owner grants
   permissions per item.
8. Programme blocks reference course units instead of copying them; block readiness, shared work
   items and method coverage are computed from the mapped units (`packages/core/src/programme`),
   so a programme can never claim more than the catalogue holds.
9. Study preferences store only explicit choices and apply defaults in code, so later defaults
   never overwrite an earlier choice; appointments, deadlines and the content sequence are
   separate records with separate rules (`packages/core/src/planning`).
10. Host terms decide imports as well as licences: PubMed Central and nature.com are never import
    hosts, and an import fetches only an exact verified PDF locator, without following redirects.
11. `pnpm dev` runs Next's webpack development server, because the Turbopack development server
    reloads pages in a loop in this monorepo layout on the build machine.
12. No silent fallback: a live model that cannot run is reported as blocked, and the scripted
    demo is chosen explicitly and labelled wherever it speaks.
13. Account recovery is an administrative command, not an email flow, because no mail provider
    is configured; nothing on the website can reset a password.
14. The research studio works from simulations, published or open material, existing datasets used
    as their licence or terms permit (data about people included) and the learner's own reasoning;
    it has no path for recruiting anyone or collecting new data from people.
