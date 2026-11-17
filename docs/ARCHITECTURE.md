# Architecture

A modular monolith (Next.js web app) plus a durable worker and a desktop companion, sharing
typed packages and one PostgreSQL database. No microservices, no separate vector database.

## Topology

```
 Browser ──HTTPS──▶ apps/web (Next.js 16, Node runtime) ──▶ OpenAlex, Crossref (through the provider cache)
    │                   │  services (packages/db)        ▲ SSE tutoring stream
    │                   │  enqueue (pg-boss, same tx)    │
    │                   ▼                                 │
    │             PostgreSQL ◀──── apps/worker (pg-boss: ingest, prepare, assess, export, transcribe,
    │                   ▲                         maintain, scholarly) ──▶ arXiv (only caller), OpenAlex, Crossref
    └─▶ arxiv.org/pdf (the reader fetches a linked arXiv PDF in the owner's browser; nothing stored)
 Desktop ── apps/companion ──outbound HTTPS (device token)──▶ apps/web /api/companion/*
```

- **Local development**: `embedded-postgres` runs PostgreSQL 17 from Node (Docker is not
  installed on the owner's machine). Web and worker are separate processes against it.
- **Production (deployed)**: one Railway project, `corniversity` — PostgreSQL (pgvector template,
  because the standard Railway image has no pgvector), `web`, `worker`. Files are stored as blobs in
  PostgreSQL (`BlobStore` with `pg` and `fs` drivers); a volume would bind to one service only
  and object storage is not available without new billing. Documented deviation from the brief's
  "object storage" preference; S3-compatible driver is a later option.

The public web origin is `https://corniversity.up.railway.app`, a Railway-provided service domain routing to port 3000. Both web and worker use that origin as `BETTER_AUTH_URL`; authentication, absolute application redirects, calendar links and new companion pairing URLs derive from it. A hostname change requires both services to restart and the owner to sign in again because cookies are host-bound. Existing companion/calendar clients may retain their previously saved URL.

## Packages and boundaries

| Package | Owns | Must not |
|---|---|---|
| `packages/core` | Zod schemas and types; prerequisite graph; readiness rules; evidence states; scheduling engine; ICS; workload; grounding/citation validation; deterministic academic checks; laboratories; programme routes and next steps; research-studio checks | import DB, Next, or provider SDKs |
| `packages/db` | Drizzle schema, migrations, client, `BlobStore`, **services** (all academic state changes), job names/payload schemas | contain UI or prompts |
| `packages/ai` | `ModelProvider` (Anthropic SDK, the owner's ChatGPT plan, fixture), Sign in with ChatGPT and its credential files, role contracts, prompt templates, structured output parsing, budget accounting, grounding glue | write to the DB directly (services do) |
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
`requestFeedback`, `requestOralDiscussion`, `holdOralDiscussion` and `projectReport`. Course preparation
uses `createPreparationRequest`, `confirmPreparation`, `resumePreparation`, `cancelPreparation`
and `publishDraft`. UI and model tools call services; models never write academic state directly.
Authored units in `content/` and owner-published runtime drafts are distinct paths.
The research library adds, among others, `resolveInput`, `importByIdentifier`, `saveWork`,
`setWorkFlags`, `editWorkFields`, `openArxivVersion`, `recordObservedHash`, `requestPrivateCopy`,
`attachUploadToWork`, `createWorkFromUpload`, `mergeWorks` and `deleteWorkCompletely`
(`services/scholarly-works.ts`); `searchPapers` and `previewPaper` (`services/paper-lists.ts`);
`discoverPage` and `subjectRoom` (`services/discover.ts`); `continueReading` (`services/library-home.ts`);
`createCollection`, `addToCollection`, `moveInCollection` and `setItemReason`
(`services/library-collections.ts`); `saveReadingPosition`, `createAnnotation`, `updateAnnotation`
and `listReadingNotes` (`services/library.ts`); `readerDocument` (`services/reader.ts`); and
`prepareCompanionTurn` and `recordCompanionPermission` (`services/companion.ts`).

## Data model (areas → tables)

- **Identity/consent**: `user`, `session`, `account`, `verification` (better-auth); `learner_profile`,
  `budget_setting`, `provider_setting`, `consent_record`, `device_pairing`, `pairing_code`.
- **Academic structure**: `department`, `programme` (reference id, blocks, electives, methods and paper
  seminar as versioned content), `course`, `course_version` (with catalogue notes), `course_department`
  (cross-listing), `concept`, `course_concept`, `prerequisite_rule`, `teaching_unit`, `unit_exercise`,
  `rubric`, `instructor_artifact`.
- **Library**: `source`, `source_version`, `locator`, `resource_asset`, `asset_blob`,
  `processing_permission`, `extracted_page`, `passage` (FTS `tsvector`), `passage_embedding`
  (created only if pgvector exists), `annotation`, `reading_progress`, `resource_request`.
  - `resource_asset` is the Document of every file the reader opens. A paper's file points at its
    `scholarly_version` (composite key with the owner, `ON DELETE RESTRICT`); `linked_remote` rows
    store no bytes and hold `arxiv:{id}vN` in `sha256` (one linked Document per arXiv version under
    the unique (owner, sha256) index); `observed_sha256` is the hash the owner's browser last received.
    One routine (`placeDocumentBytes` in `services/library.ts`) decides every transition before a blob
    is written and deletes the blob again if the database write fails; a stored arXiv copy returns to
    `linked_remote` when its storage is withdrawn, a soft-deleted row with the same bytes is folded
    into the linked Document they arrive for, a version has at most one live Document, and a soft
    delete never detaches annotations. An anchor's `documentSha256` names the file its rects were
    measured on; they move to a new file of the same Document only when the bytes are the ones the
    reader received or the page geometry passes the drift check (after extraction, or in the reader).
  - `annotation` carries `kind` (note, highlight, bookmark), a colour role, an `anchor` (rects in PDF
    user space; the server fills the engine and the Document key), `quote_matched`, a foreign key to
    `notebook_entry` and a full-text `tsv`. `reading_progress` carries `position`, `last_opened_at` and
    `effective_at` (saves ordered on the database server's clock).
- **Research library** (`schema/scholarly.ts`, docs/RESEARCH_LIBRARY.md): `scholarly_work` (owner-scoped
  paper with per-field provenance, `owner_edited_fields`, integrity notices, referenced OpenAlex ids,
  flags, `merged_into_id` tombstones and a full-text `tsv`), `scholarly_identifier` (unique per owner,
  scheme and value; `current` or `superseded`), `scholarly_version` (arXiv id and version together or
  neither, unique per owner; licence fields written once), `library_collection` and
  `library_collection_item` (shelves and trails), `library_preference` (Discover subjects);
  `notebook_entry.scholarly_work_id` links paper notes. Parents carry UNIQUE (id, owner_id) and children
  composite foreign keys, so no row can point at another owner's row. Provider responses are cached in
  `scholarly_cache.provider_cache`, a schema of its own that backups never read (keyed by the sha256 of
  the request without credentials; 200 and 404 only; purged daily).
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
- **Study continuity and paper work**: `assistance_event` (every help request by kind, with what it
  pointed at and the run that answered; provenance, never evidence), `work_page` (paper pages: private
  blob, order, rotation, metadata stripped), `transcription_version` (numbered; confirmed only with no
  `[[?…]]` mark left), `concept_bridge` (seeded from `content/bridges`), `bridge_visit` (trail, depth,
  exact return path, self-check answer). Notebook entries carry their session and anchor; submissions
  carry the confirmed transcription and pages; attempts carry a draft revision.
- **Issues, review and preparation**: `misconception_record` holds learning issues (status, origin,
  the check and submission that raised or resolved them); `revision_item` carries status, snooze
  date and the issue or exercise it revisits; review choices live on
  `learner_profile.review_preferences`; `unit_exercise.progression` holds the progression.
  `preparation_request` (intake, budget, status), `preparation_stage` (one row per stage and unit,
  with role, lease, artifact and error), `unit_draft` (numbered drafts with their checks) and
  `unit_publication` (one active publication per unit; the seeder skips content for those units).
- **Visual explanations**: `visual_explanation` (storyboard with its render record, check results,
  storyboard hash, and a film in the blob store only when it was recorded from the current
  storyboard; otherwise `film_stale` says why it is withheld). Films are recorded locally with
  `pnpm visuals:render <slug>` into `content/visuals/<slug>/render/` and seeded by the worker.
- **Extension**: `curriculum_proposal` (a subject or reading programme proposed inside an existing
  department, with reused concepts and prepared units, source leads and a decision per overlapping
  course) and `curriculum_proposal_version` (every revision as it was). Publishing writes a course,
  its department link and a version at readiness `proposed` in one transaction, with an id in the
  department's prefix from 901; the seeder never touches such courses, since they are not in `content/`.
- **Research studio**: `research_project` (owner, kind, question, shelf and leads, a demonstration
  flag), `research_document` (proposal, methods and report drafts), `research_version`
  (immutable numbered versions), `research_provenance`, `research_artifact` (a blob or a notebook
  entry), `research_feedback` (scripted, live or blocked, with its checks and the provider run),
  `research_oral_request`.
- **Operations**: `job_record`, `provider_run` (per-attempt usage when a server-side fallback
  ran, the worst-case estimate, `running` while a live run holds its worst case, and refused runs
  recorded as `blocked` or `budget_blocked`),
  `audit_event`, `export_record`, `app_setting`. `provider_setting` holds the provider, the model,
  the refusal-fallback choice, the owner's approval of paid use, and for the ChatGPT plan its model,
  request limits, approval and pause (migration 0013). A partial unique index allows
  one `user` with the role `owner`.

Invariants enforced in services and tests: grades reference exact submission/rubric/run
versions and keep the exercise as answered; citations retain registry `source_version`/`locator` or
owner-library asset/passage identities; enrolments reference a
`course_version`; cross-listing never duplicates attempts; instructor artifacts never serialize to
learners; permissions are per action; owner scoping on every query; idempotency keys on
enrolment, assessment, ingestion and ICS UIDs; proposed vs confirmed plans are distinct rows.

## AI orchestration

- Roles: director, convenor (content pipeline), lecturer, tutor, librarian, assessor, seminar
  chair, supervisor, peer. Each has a versioned contract: purpose, allowed tools (server
  functions), required context, forbidden actions, output schema, memory policy, limits.
- Grounding: evidence blocks are tagged `[E1]…[En]`; the server resolves cited tags to registry
  locations or exact library asset/passage IDs and removes unknown tags. Location-only blocks are
  reading pointers, not evidence that the source text was read. Course retrieval admits only the
  owner's processed, nondeleted, non-local library items with current external-AI permission;
  preparation also restricts them to the source editions assigned to the unit. Full-text search
  uses up to 96 distinct query words, ranked matches first. Tutor/assessor excerpts are bounded
  and labelled when shortened. A reading-room selection is attributed to its page only when
  found on that page.
- Preparation: no source-dependent draft is admitted without actual permitted passages. Up to
  eight excerpts of 2,400 characters enter the convenor prompt; bibliography alone cannot
  reserve a run. Server-recorded supplied passage/locator IDs and planned objectives accompany
  each draft. Publication reruns current structural checks against that provenance; legacy
  drafts without it require preparation and review again. Worked examples become learner-facing
  notes; solutions remain instructor artifacts. These checks do not establish academic truth.
- Dispatch permissions: `sourcePassagesStillPermitted` rechecks the exact cached passages, current
  owner/course association, availability and latest permission in one database snapshot after
  admission, immediately before preparation, assessment or tutor dispatch. A changed source or
  failed check blocks without a provider attempt and releases the reservation when the database
  is available. The check and remote transmission are not literally atomic.
- Tutor context: current learner notes are bounded to 12,000 characters and saved work to 20,000,
  falling back to the latest submission when the draft is empty. Longer text retains the opening
  plus the selected passage or conclusion, with matching omission disclosure in preview and
  prompt. `tutorHistory` filters the bounded replay window by recorded library citation IDs and
  leaves the saved conversation untouched; retained history IDs join the final dispatch guard.
  Uncited historical paraphrases cannot be attributed reliably from citation records alone.
- Labels: `{source-backed}`, `{derived}`, `{conjecture}`, `{needs-checking}` markers → stored labels.
- Providers: `anthropic` (official SDK 1.3, beta Messages API: `messages.stream` for prose,
  `messages.create` with a Zod output format and the application's own validation for structured
  outputs, an explicit effort per role, optional server-side refusal fallback) and `fixture`, the
  scripted demo (deterministic, keyed by role and scenario). Supported models are an allow-list
  (`packages/ai/src/models.ts`); the default is `claude-opus-5-5`. `chatgpt_plan` teaches through
  the owner's own ChatGPT plan by OpenAI's Sign in with ChatGPT, in a local installation only
  (`DEPLOYMENT_MODE=local` served on a loopback address; OpenAI documents plan usage for
  open-source and locally hosted apps and sends remotely hosted ones to its interest form):
  `packages/ai/src/chatgpt-oauth.ts` (registration of a user-defined agent through
  `dynamic_agent_client` with this computer's host id, PKCE, the `127.0.0.1/auth/callback`
  route, ID-token checks, rotating refresh tokens, revocation; tokens only in owner-only files
  under `~/.config/corniversity/chatgpt-plan`), `packages/ai/src/chatgpt-plan.ts` (the public
  Responses API with `store: false` and `stream: true`; a request succeeds only on
  `response.completed`; documented error codes; a usage limit or an eligibility refusal pauses plan
  requests until the owner resumes them) and `packages/db/src/services/chatgpt-plan.ts` (refresh
  under a database lock shared by web and worker; request limits a day and a month that the owner
  approves, decided under the same per-owner lock as paid runs; plan runs cost $0).
- Provider state (`packages/ai/src/state.ts`): `scripted`, `live` (a readable key, a supported
  model and the owner's approval covering the model, the fallback choice and the limits), `plan`
  (the owner's ChatGPT plan, connected, with an approved model and request limits, not paused) or
  `blocked` with a stated reason. A blocked run is refused and recorded; nothing scripted
  replaces it. Every stored reply carries the id of the run that produced it, which is how it is
  labelled live or scripted afterwards.
- Budget: per-run, daily and monthly limits under fixed ceilings, compared in integer
  micro-dollars over UTC days and months (a run counts in the window it started in). Before a live
  run, under a per-owner database lock, its worst case is checked against the role's ceiling and
  every limit: the whole output allowance; the prompt at one token per UTF-8 byte (every token of a
  byte-level tokenizer encodes at least one byte; the provider does not publish its tokenizer, so
  this is a stated assumption, not a proof) plus a framing allowance per message; each image at the
  documented 4,784-token ceiling; priced at the cache-write rate; and, with fallback on, a second
  run whose prompt also carries the first attempt's output. A model without a known price fails
  closed. Other runs count at their worst case while `running` or `unsettled`. SDK retries are off
  so each billable attempt is reserved; a provider call may carry an idempotency key (a duplicate
  is refused) and a parent run (one learner action, several calls). A run finishes with its usage
  per attempt; when the provider may have billed more than it reported (a lost connection, a
  stream broken part way, a process that ended mid-run, found by a fifteen-minute maintenance pass),
  it becomes `unsettled` and keeps its worst case until the owner records the amount the provider
  console shows (audited; never above the worst case). Persona turns replay bounded history (the
  most recent ~24 KB). Role ceilings are sized for the strict bound; the owner's limits are
  separate and always apply. The pricing table carries its date and source URL.
- Assets: `checkAiAssets` reports whether the scripted responses load and which prompt versions
  the build carries (counts and version names, never contents or paths); the health route and
  the worker's start-up log show it.
- Prompt-injection: retrieved text, uploads and persona messages are data; tools are allow-listed
  server functions; outbound fetches are host-allow-listed with SSRF guards.

## Research library and the reader

The contract, decision log and every route's behaviour are in
[RESEARCH_LIBRARY.md](RESEARCH_LIBRARY.md); this section names the parts.

- **Routes** (all under `/library`; main navigation unchanged): `/library` (the home, database
  only: find box, *Continue reading*, saved views, shelves and trails, the Files list),
  `/library/find`, `/library/works/[scheme]/[...value]` (preview of a paper not in the library),
  `/library/papers/[workId]`, `/library/papers/new`, `/library/discover`,
  `/library/subjects/[slug]`, `/library/shelves`, `/library/shelves/[id]`, `/library/trails`,
  `/library/trails/[id]`, the reader `/library/read/[id]` in its own route group `(reader)` with a
  full-height layout, and the existing items, sources, requests, sync, jobs and upload pages.
  Library notes are `/notebook?library=1` with filters by paper, kind, subject and words. Route
  handlers: `/api/library/papers/new` and `/api/library/papers/[workId]/attach` (multipart PDF
  uploads answering with 303 redirects), `/api/library/annotations`, `/api/library/position` and
  `/api/library/ask` (JSON from this site's own pages only, through the annotation routes' guard),
  and the existing upload, requests and owner-only file routes. Each route group has its own
  `not-found.tsx`, so every 404 has exactly one `main`.
- **Providers** (`packages/db/src/scholarly/`): OpenAlex, arXiv and Crossref adapters behind one
  HTTP client (https to fixed hosts, identifiers parsed and encoded, no redirects followed, timeouts,
  bounded retries, zod-validated responses, URLs and keys redacted from errors). No URL is fetched
  from user input. Responses are cached in `scholarly_cache.provider_cache`. Only the worker calls
  arXiv. `SCHOLARLY_PROVIDER=fixture` answers from recorded responses for tests and journeys;
  production and `pnpm local:owner` refuse it.
- **Pure rules** (`packages/core/src/scholarly/`): identifiers, licence classification and the
  private-copy decision (`storageDecision`: only an open licence that arXiv OAI-PMH reported for
  that exact version), permissions, duplicates, anchors, drift, positions, Discover and the
  companion's gates.
- **The reader stack.** `pdfjs-dist` 6.4.299 (pinned exactly; the version unpdf bundles for server
  extraction, asserted equal by a test), legacy build, loaded only in the browser
  (`components/reader/engine.ts`) and wrapped by `PdfReader.tsx` around the official `PDFViewer`,
  `EventBus`, `PDFLinkService` and `PDFFindController`. The worker, WebAssembly decoders, CMaps,
  standard fonts and ICC profiles are copied into `apps/web/public/pdfjs/6.4.299/` by
  `apps/web/scripts/vendor-pdfjs.mjs`, run by the web `dev` and `build` scripts and by
  `scripts/local-owner.ts`, so they load from this origin. Scripting, XFA, forms and annotation
  editors are off. A stored Document is fetched from the owner-only file route; a linked arXiv
  Document is fetched by the browser from `https://arxiv.org/pdf/{id}v{n}` without credentials or
  referrer, checked to be a PDF and hashed, and the hash reported (`recordObservedHash`). The
  production CSP (`apps/web/src/lib/csp.ts`) allows `connect-src` to this site and
  `https://arxiv.org` only, and `'wasm-unsafe-eval'` only on responses under `/pdfjs/`. Panels
  (*Contents*, *Notes*, *Paper*, *Ask*) are an aside on the desktop and a native `<dialog>` on
  phones. Annotations are anchored by rects in PDF user space with the owner's selected quote;
  positions are saved to the server and ordered on its clock.
- **`packages/db/src/services/reader.ts`**: `readerDocument` loads, for its owner only, everything
  the reader shows about one Document: the asset, its paper (merges followed), identifiers, its
  scholarly version and arXiv id, every recorded version of the same arXiv paper, the reading
  position and the annotations. Another owner's id, or an id that is not a UUID, is not found.
- **`packages/db/src/services/companion.ts`**: the reading companion's server side.
  `prepareCompanionTurn` decides in a fixed order (the owner's Document; its state; `external_ai`
  allowed on that Document; what the action needs, through core `decideCompanionAction`) and builds
  bounded evidence (a selection of at most 4,000 characters, page text of at most 6,000; never the
  whole PDF; quoted text neutralised and carried in the owner's message as data). A selection from a
  linked arXiv Document is labelled as not checked against the paper. `recordCompanionPermission`
  records the owner's basis with the licence shown; `appendCompanionRequest` stores the request and
  its evidence before the model runs. `/api/library/ask` streams one answer through
  `streamPersonaTurn`; each request is its own conversation, and a refused run is never replaced by
  scripted text.

## Jobs

The worker applies pending migrations on start and, when the deployment sets
`SEED_CONTENT_ON_START=1`, seeds the institution's content (idempotent; never learner data).
An owner-published unit retains its lesson, exercises and instructor artifacts together during
reseeding; reattaching it to a current course version does not replace that teaching.
pg-boss 12 (`schema: pgboss`), queues: `transcribe-pages` (one per consent; no retry, since a retry
would be a new billable call; consent and pages re-checked when it runs), `ingest-asset` (singletonKey = sha256), `prepare-unit`
(one job per confirmed or resumed preparation request; stages hold leases so a duplicate run skips finished work), `assess-submission` (singletonKey = submission version id),
`embed-passages` (defined, with no handler: pgvector is optional and full-text search serves),
`export-records`, `scholarly-arxiv` (every arXiv request: works' arXiv records,
private copies of openly licensed versions, newest-submission listings; one active job across all
processes through a shared singleton key, at least 3.1 s between requests, Retry-After honoured),
`scholarly-refresh` (a work's OpenAlex metadata and Crossref integrity notices), `scholarly-lists`
(Discover's subject lists from OpenAlex into the provider cache, daily for the owner's subjects and
whenever a page finds a list missing or out of date; it then queues those subjects' arXiv listings
on `scholarly-arxiv`), `maintenance` (cron; each task under its own
schedule key, including the daily provider-cache purge). Retries with backoff, expiry,
heartbeats for ingestion, dead-letter queues. `job_record` mirrors state for the UI.

## Security

better-auth sessions (secure cookies, origin checks, rate limiting); owner bootstrap requires
`OWNER_EMAIL` + `OWNER_BOOTSTRAP_CODE` and closes after the first account, which a unique index
guarantees even for concurrent submissions; the code is optional once the owner exists and can
then be removed from the deployment. Without email delivery, the owner's password is recovered by
an administrative command run in the worker's shell, never through the website; it revokes every
session (`apps/worker/src/admin/reset-owner-password.ts`). Every route handler
calls `requireSession`; files served only through authorized handlers; companion uses hashed
device tokens; Markdown is parsed as one document, then sanitised (`rehype-sanitize` with a
KaTeX allow-list), preserving code fences, lists, reference links and footnotes. Named teaching
environments are wrapped after sanitisation using fixed classes and text-node titles. Uploads are validated
(type, size, page count, decompression limits); secrets redacted from logs. `Permissions-Policy`
allows the microphone to this origin only (`microphone=(self)`), for dictation, which is offered
only after the learner's recorded permission; camera and geolocation stay off. The
Content-Security-Policy is asserted exactly by `csp.test.ts`; images from other sites in owner
Markdown and model output become links. The annotation, position and companion routes accept only
JSON from this site's own pages (`api/library/annotations/guard.ts`), and the paper upload routes
refuse other sites.

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
    demo is chosen explicitly and labelled wherever it speaks. A ChatGPT plan error never moves a
    request to an API key or to scripted text.
13. Account recovery is an administrative command, not an email flow, because no mail provider
    is configured; nothing on the website can reset a password.
14. The research studio works from simulations, published or open material, existing datasets used
    as their licence or terms permit (data about people included) and the learner's own reasoning;
    it has no path for recruiting anyone or collecting new data from people.
15. The owner's local installation (`pnpm local:owner`, http://127.0.0.1:3300) has its own
    database (`corniversity_owner`), data folder and compiled output, so the journeys' development
    stack never touches the owner's records; it keeps uploads in the database so one backup holds
    records and uploads, and it refuses `SCHOLARLY_PROVIDER=fixture` (the script and, through
    `CORNIVERSITY_INSTALLATION=owner`, its web app and worker). Error notices after a redirect
    carry allowlisted codes (`apps/web/src/lib/notices.ts`), never text from the address.

16. The lean study format: a course is its units (notes, problem sheet, tutorial) and its exams.
    An exam answer is an attempt linked to the exam (`attempt.exam_id`), so it is marked by the
    ordinary assessment queue but never appears in a practice session; its score is computed from
    the assessor's checks of the rubric's weighted criteria (`packages/core/src/exams/exam.ts`).
    Units belong to a course's current version, so progress and exams look units up there rather
    than through the version an enrolment points to. Closed book is enforced where attempts are
    created: while an exam runs (until its deadline and grace), no practice attempt can be opened
    on its problems, so hints, solutions and practice feedback have nothing to attach to, and the
    tutor refuses them. The paper's countdown follows the server's clock, and only the server
    decides that time is up. Hidden features keep their routes and data.