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
- **Production (prepared)**: one Railway project — PostgreSQL (pgvector template, because the
  standard Railway image has no pgvector), `web`, `worker`. Files are stored as blobs in
  PostgreSQL (`BlobStore` with `pg` and `fs` drivers); a volume would bind to one service only
  and object storage is not available without new billing. Documented deviation from the brief's
  "object storage" preference; S3-compatible driver is a later option.

## Packages and boundaries

| Package | Owns | Must not |
|---|---|---|
| `packages/core` | Zod schemas and types; prerequisite graph; readiness rules; evidence states; scheduling engine; ICS; workload; grounding/citation validation; deterministic academic checks | import DB, Next, or provider SDKs |
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
`deletePersonaMemory`. UI and model tools both call these; models never write. (`prepareUnit`
is reserved for the content pipeline; units are currently prepared in `content/` and validated.)

## Data model (areas → tables)

- **Identity/consent**: `user`, `session`, `account`, `verification` (better-auth); `learner_profile`,
  `budget_setting`, `provider_setting`, `consent_record`, `device_pairing`, `pairing_code`.
- **Academic structure**: `department`, `programme`, `course`, `course_version`, `course_department`
  (cross-listing), `concept`, `course_concept`, `prerequisite_rule`, `teaching_unit`, `unit_exercise`,
  `rubric`, `instructor_artifact`.
- **Library**: `source`, `source_version`, `locator`, `resource_asset`, `asset_blob`,
  `processing_permission`, `extracted_page`, `passage` (FTS `tsvector`), `passage_embedding`
  (created only if pgvector exists), `annotation`, `resource_request`.
- **Study/planning**: `term`, `enrolment`, `availability_window`, `commitment`, `day_off`,
  `plan_version`, `scheduled_session`, `change_proposal`, `calendar_token`.
- **Learning**: `learning_session`, `conversation`, `message`, `attempt`, `submission_version`,
  `assessment_run`, `feedback_review`, `evidence_event`, `concept_state`, `misconception_record`,
  `revision_item`, `notebook_entry`, `portfolio_artifact`.
- **People/community**: `persona`, `peer_membership`, `society`, `discussion`, `discussion_turn`,
  `persona_memory`.
- **Operations**: `job_record`, `provider_run`, `audit_event`, `export_record`, `app_setting`.

Invariants enforced in services and tests: grades reference exact submission/rubric/run
versions; citations resolve to immutable `source_version` + `locator`; enrolments reference a
`course_version`; cross-listing never duplicates attempts; instructor artifacts never serialize to
learners; permissions are per action; owner scoping on every query; idempotency keys on
enrolment, assessment, ingestion and ICS UIDs; proposed vs confirmed plans are distinct rows.

## AI orchestration

- Roles: director, convenor (content pipeline), lecturer, tutor, librarian, assessor, seminar
  chair, supervisor, peer. Each has a versioned contract: purpose, allowed tools (server
  functions), required context, forbidden actions, output schema, memory policy, limits.
- Grounding: evidence blocks are tagged `[E1]…[En]`; the model cites tags; the server maps tags to
  locator ids and drops unknown tags, flagging the sentence as uncited.
- Labels: `{source-backed}`, `{derived}`, `{conjecture}`, `{needs-checking}` markers → stored labels.
- Providers: `anthropic` (official SDK, `messages.stream` for prose, `messages.parse` +
  `zodOutputFormat` for structured outputs, default model `claude-opus-5-5`, configurable per
  role) and `fixture` (deterministic, keyed by role and scenario). Runtime defaults to fixture
  until the owner configures a provider and budget.
- Budget: per-run, daily and monthly caps; estimate before run; record actual usage per
  `provider_run`; hard stop; pricing table carries date and source URL.
- Prompt-injection: retrieved text, uploads and persona messages are data; tools are allow-listed
  server functions; outbound fetches are host-allow-listed with SSRF guards.

## Jobs

pg-boss 12 (`schema: pgboss`), queues: `ingest-asset` (singletonKey = sha256), `prepare-unit`
(singletonKey = unit id), `assess-submission` (singletonKey = submission version id),
`embed-passages`, `export-records`, `maintenance` (cron). Retries with backoff, expiry,
heartbeats for ingestion, dead-letter queues. `job_record` mirrors state for the UI.

## Security

better-auth sessions (secure cookies, origin checks, rate limiting); owner bootstrap requires
`OWNER_EMAIL` + `OWNER_BOOTSTRAP_CODE` and closes after the first account; every route handler
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
