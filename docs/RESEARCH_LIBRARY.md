# Research Library (Milestone 20)

The owner's brief *Corniversity Library* asks for a personal library of academic research papers
inside the existing Library: discover, find, import, read the original, annotate, shelve, follow
trails, keep notes, and optionally ask a grounded reading companion. This file is the plan, the
data and service contract, and the decision log. Present tense; update it in the same change that
makes it untrue. (The brief arrived truncated after its section 21.2; the repository's own rules
cover the rest.)

## 1. Reused, not rebuilt

| Existing | Reused as |
|---|---|
| `resource_asset` (status machine, sha256 dedup, private blob store, owner-only file route) | **the Document**: every PDF the reader opens, stored or linked |
| `processing_permission` (six separate actions, unknown by default, recorded basis) | permissions of every Document; the companion needs `external_ai` |
| `reading_progress` | reading position, extended with a position inside the page |
| `annotation` (locator, selected text, note, `needs_repair`) | highlights, page notes, area notes, bookmarks |
| `notebook_entry` (Markdown + KaTeX, full-text search) and `/notebook` | paper notes and the global notes view (no second notes store or page) |
| ingest queue, `extracted_page`, `passage`, full-text search | Text view, in-document server search and companion evidence for **stored** Documents |
| `/api/library/ask`, `streamPersonaTurn`, `[E#]` citation checks | the reading companion |
| `receiveUpload`, `/api/library/upload`, open-import guards | attaching an owner's copy; private copies of openly licensed arXiv PDFs |
| pg-boss queues and `job_record`, `/library/jobs` | arXiv calls, subject-list refreshes, metadata refreshes |
| LibraryHeader, `ui.tsx`, colour roles, notices allowlist, journeys 07/08/15 | every new page |

The institution registry (`source`, `source_version`, `locator`) stays read-only seeded content.
Provider records never enter it: they are *reported by a provider*, not *verified by opening*.
Registry sources that carry a DOI or arXiv id appear in Discover as *From your courses*.

## 2. Information architecture

Everything stays under `/library`. Main navigation is unchanged.

| Route | Screen |
|---|---|
| `/library` | **Library home**, database only: find box, *Continue reading* (≤ 3), saved papers (all · read later · favourites · read), shelves and trails, and the existing **Files** list with its current markup, links, sync badge and `?deleted` notice (Upload, Desktop sync and Jobs are links in the Files header). h1 stays "Library" |
| `/library/find` | **Find papers**: one box (DOI, DOI inside any URL, arXiv id or URL, OpenAlex id or URL, or words), scope *All papers* / *My library*, filters, exact identifier match first; PDF upload link |
| `/library/discover` | **Discover**: your subjects, per subject *New on arXiv*, *Reviews and surveys*, *Most cited*, *Earlier work*; *Cited by 2 or more of your papers*; *Similar to …* ; *From your courses*; *Surprise me* |
| `/library/subjects/[slug]` | subject room: subfields and the same three or four lists |
| `/library/works/[scheme]/[value]` | preview of a paper not in the library (`scheme` = doi, arxiv, openalex); redirects to the paper page when the owner has it |
| `/library/papers/[workId]` | paper page (same `PaperView` component as the preview) |
| `/library/read/[assetId]` | the reader, in its own route group `(reader)` with a full-height layout |
| `/library/shelves`, `/library/trails`, `/library/shelves/[id]`, `/library/trails/[id]` | collections (one table, two kinds) |
| `/notebook?library=1&work=<id>&kind=…` | every library note: highlights, page and area notes, bookmarks, paper notes |
| existing `/library/items/[id]`, `/sources`, `/requests`, `/sync`, `/jobs`, `/upload` | unchanged (an item with a scholarly version redirects to its paper page) |

LibraryHeader: one row of tabs *My library · Discover · Find papers · Shelves · Trails · Sources ·
Books to obtain*; `sync` becomes optional and shows on the home page and material pages only.

## 3. Data model (one additive migration, 0016)

Names avoid the existing "paper work" feature (handwritten work pages). New schema file
`packages/db/src/schema/scholarly.ts`. Every table has `owner_id` (FK user, cascade). Parents carry
`UNIQUE (id, owner_id)` and children use composite FKs `(x_id, owner_id)`, so cross-owner links are
impossible in the database. Text columns with TypeScript unions; no new pgEnums.

**`scholarly_work`**: `id`, `owner_id`, `title`, `authors jsonb {name, orcid?, openalexId?}[]`,
`abstract`, `abstract_source` (openalex | arxiv | crossref | owner), `publication_year`,
`publication_date`, `publication_date_precision` (day | year; OpenAlex `YYYY-01-01` placeholders are
stored as year only), `venue`, `work_type` (as reported), `subjects jsonb {id, name, level, score}[]`
(as classified by OpenAlex), `provenance jsonb` (per field `{source, retrievedAt}`),
`owner_edited_fields text[]` (refresh never overwrites them), `integrity_notices jsonb`
(`{type: retraction|correction|expression_of_concern|withdrawal, source: crossref|retraction-watch|openalex|arxiv, concerns: doi or arXiv version, noticeDoi?, date?, label, retrievedAt}[]`),
`integrity_checked_at`, `referenced_openalex_ids text[]` and `references_retrieved_at` (CC0 ids, so
*Cited by 2 or more of your papers* is one query), `metadata_status` (resolved | unidentified),
`merged_into_id` (tombstone after an owner-initiated merge), `saved_at`, `favourite`, `read_later`,
`read_at` (owner only), timestamps, generated `tsv` (title, abstract, author names, GIN).
*Recently opened* is derived from `reading_progress.last_opened_at` of the work's Documents.

**`scholarly_identifier`**: `id`, `owner_id`, `work_id`, `scheme` (doi | arxiv | openalex | pmid |
pmcid), `value` (normalised: DOI lower-case without prefix; arXiv id without version; OpenAlex
`W…`), `source`, `retrieved_at`, `status` (current | superseded). Unique (owner, scheme, value).

**`scholarly_version`**: `id`, `owner_id`, `work_id`, `kind` (preprint | accepted | published |
unknown), `label` ("arXiv v7", "Published version", "Your copy"), `arxiv_id`, `arxiv_version`
(CHECK both null or both set; partial unique (owner, arxiv_id, arxiv_version)), `doi`,
`version_date`, `landing_url` (https only), `licence`, `licence_url`, `licence_source` (arxiv-oai |
openalex | crossref | owner), `licence_retrieved_at` (licence fields are written once, while that
version is the current one in an arXivRaw record, and never overwritten), `withdrawn bool`,
`source`, timestamps. OpenAlex arXiv locations never create versions: they add the arXiv identifier
and enqueue arXiv resolution.

**`resource_asset`** (the Document) gains `scholarly_version_id` (composite FK to the version,
`ON DELETE RESTRICT`), `observed_sha256`, `observed_at`. New status `linked_remote` and origins
`arxiv_link`, `scholarly_upload`, `scholarly_import`. A linked Document stores no bytes
(`storage_key` null, `local_only` false); its `sha256` column holds the placeholder
`arxiv:{id}v{n}` (never a real hash, so the existing unique (owner, sha256) index gives one linked
Document per arXiv version). Its URL is always built from the version's validated id
(`https://arxiv.org/pdf/{id}v{n}`), never stored. `observed_sha256` is the hash of the bytes the
owner's browser received (a drift detector, not an identity).

Document transitions (one routine decides, before any `blobs.put`; a DB failure after `put` deletes
the blob):

| From | Event | To |
|---|---|---|
| — | open an arXiv version | `linked_remote` (insert on conflict do nothing, reselect) |
| `linked_remote` | *Keep a private copy* (open licence) or the owner uploads a copy for that version | same row: real sha256, `storage_key`, `quarantined` → `validated` → existing flow |
| stored arXiv-version Document | withdraw private storage / remove copy | same row back to `linked_remote` (blob and derived text deleted; annotations, position, permissions kept) |
| soft-deleted row, same bytes uploaded | revive | `quarantined`; `private_cloud_store` allowed ("re-added by the owner"), every other earlier decision revoked, metadata and course ids from the new upload (a paper's file: from its work, `validated`), annotations re-attached, audit `asset:revive` |
| soft-deleted row, same bytes arrive for a `linked_remote` Document | owner's copy or private copy | the deleted row is folded into the linked row (annotations and, if the linked row has none, the position move; the empty row and its old decisions go; audit `asset:fold`), then promoted as above |
| stored row, same bytes | upload | duplicate (existing behaviour) |
| any row | `registerLocalAsset` matches a linked row | audit only; never rewrites it |

Attaching bytes that already exist: an asset with no version is adopted; one bound to a version of
the same work is reused; one bound to another work is refused ("This file is already attached to
another paper in your library.") with a link to that paper. A soft-deleted row is attached nowhere
(it is revived for, or folded into, the paper it now arrives for). A version has at most one live
Document: other bytes for a version whose file is stored are refused, and bytes a live item already
holds are refused for a version with a linked Document, with the instruction to delete that item
first (its notes then come along). An anchor's `documentSha256` names the file its rects were
measured on: a transition re-keys anchors only when the new bytes are the ones the reader received
(`observed_sha256`); otherwise the drift check decides (after extraction for a stored Document,
with the extracted page geometry; in the reader for a linked one). A soft delete never nulls
`annotation.asset_id` (it sets `needs_repair`; readers check `deleted_at`). Linked Documents have no
Delete; requests to extract or store them through the old item forms are refused with a registered
notice.

**`reading_progress`** gains `position jsonb` (`{pageIndex, top, left, zoom}` in PDF user space),
`last_opened_at`, `effective_at`. One service writes `physical_index` and `position` together.
Saves are ordered on the **server clock**: the client sends `changedAgoMs` (time since the reader
last moved, by `performance.now()`); the server computes `effective_at = now() − clamp(changedAgoMs,
0, 10 min)` and accepts only a later `effective_at`. Arriving through `?page=N` does not save until
the reader moves; hidden tabs do not save; a per-tab sequence drops out-of-order requests.

**`annotation`** gains `kind` (note | highlight | bookmark; default note), `color` (a colour-role
name), `anchor jsonb` (`{v: 1, coordSpace: 'pdf_user_space', pageIndex, pageView: [w, h], rotate,
rects: [x1, y1, x2, y2][], quote?, engine, documentSha256}`; the server fills `documentSha256` and
`engine`), `quote_matched bool`, `notebook_entry_id` gets a real FK (set null), generated `tsv`
(note + selected text, GIN). An annotation with rects stays drawable whenever its document and page
exist; quote disagreement only sets `quote_matched = false`. Edits carry `expectedUpdatedAt` (409 on
conflict, both texts shown).

**`notebook_entry`** gains `scholarly_work_id` (composite FK, set null; index (owner, work)):
paper notes set it; merges re-point it; the notebook filters by it.

**`library_collection`** (`id`, `owner_id`, `kind` shelf | trail, `name`, `description`,
timestamps; unique (owner, kind, lower(name))) and **`library_collection_item`** (`collection_id`,
`owner_id`, `work_id`, `position`, `reason` (a trail step's "why"; a shelf's optional note),
`added_at`; PK (collection, work); composite FKs; work FK `ON DELETE RESTRICT`).

**`library_preference`** (`owner_id` PK, `subjects text[]`, `updated_at`): the owner's subjects
(default mathematics, physics, computer science, artificial intelligence).

**Provider cache** (`provider_cache`: `key` = sha256 of the canonical request without credentials,
`provider`, `status`, `payload jsonb`, `fetched_at`, `expires_at`) lives outside backups (its own
schema or an explicit exclusion in `backup.ts`). No raw query or owner id is stored. 429 and 5xx are
never cached; 404 is cached for 24 hours; the daily maintenance job deletes expired rows after a
grace period and caps the table.

Deleting: *Remove from library* clears `saved_at`. *Delete this paper and its notes* (confirmed,
audited, for the exact id confirmed: a merged paper is refused, never resolved to its survivor)
removes the work, its identifiers, versions, linked Documents, stored copies (blobs and text),
annotations and positions; notebook entries stay and lose the link. Nothing else ever deletes
annotations.

## 4. Pure rules (`packages/core/src/scholarly/`, unit-tested)

- `identifiers.ts`: `normaliseDoi` (`^10\.\d{4,9}/\S+$`, length cap), `parseArxivId` (new and old
  style, `vN`), `parseOpenAlexId` (`^W\d+$`), `recogniseInput(raw)`: doi.org and any other URL whose
  path contains a DOI (by string parsing only, stripping `vN`, `.full`, `.pdf`, query and fragment),
  arxiv.org abs/pdf URLs, openalex.org URLs, bare identifiers; anything else is a title search that
  shows the URL's host. **No URL is ever fetched.** `identifiersFromOpenAlex` (W, every DOI, arXiv
  ids from 10.48550 DOIs and `pmh:oai:arXiv.org:` location ids, pmid, pmcid),
  `identifiersFromArxiv`.
- `licence.ts`: exact, table-driven `classifyLicence(value, source)` after normalising URL forms
  (http/https, www, trailing slash, `legalcode`, `deed.xx`, versions): `open` (CC BY, CC BY-SA, CC0,
  public domain) | `open_nc_nd` | `arxiv_nonexclusive` (including `assumed-1991-2003`) |
  `restricted` (Crossref TDM, publisher-specific, software licences) | `unknown`. No prefix or
  substring matching. `storageDecision(version)`: a private copy is possible only for an `open`
  licence whose source is `arxiv-oai` for that exact version; OpenAlex and Crossref licences are
  display-only ("as reported by OpenAlex for this location"); Crossref entries count only for
  content-version vor/am after their embargo, and disagreement means unknown.
- `permissions.ts` (scholarly): a private copy records `local_read`, `local_extract` and
  `private_cloud_store` allowed with the basis "licence reported by arXiv OAI-PMH on <date> for vN:
  <licence>" and `share` denied; `external_ai` is never granted from a licence. Linked Documents
  record no permissions on linking.
- `dedupe.ts`: identifier match (authoritative), normalised-title similarity (suggestion only).
- `anchors.ts`: anchor schema (zod), rect normalisation, quote comparison (NFKC, all whitespace
  removed), drift check (page count and page views equal).
- `position.ts`: clamping and the server-clock ordering rule.
- `text.ts`: `providerText(value)` turns any provider string (HTML, JATS, MathML, entities) into
  plain text, keeping `$…$` maths; `safeExternalUrl(value)` accepts https (and http for display
  only) and nothing else.
- `subjects.ts`: subject slugs → OpenAlex field or subfield ids and arXiv categories; primary
  subjects first; every OpenAlex field reachable.
- `discover.ts`: factual explanations ("Cited by 3 papers in your library"; "Similar to *X* in
  OpenAlex (similarity, not a citation)"; "Most cited in OpenAlex (a count, not a judgement of
  importance)"), seeds, ordering.
- `companion.ts`: `decideCompanionAction` (question, explain passage, explain notation, walk through
  proof, check my understanding) with reasons for refusal before any model call.

## 5. Scholarly providers (`packages/db/src/scholarly/`)

Facts checked on 2026-11-15 against official documentation and with live requests.

| Provider | Used for | Rules |
|---|---|---|
| OpenAlex | search and filters, subject lists, single works by DOI/W/arXiv, cited by (`cites:`), references (`referenced_works`), related (`related_works`, labelled similarity), locations and their licences, taxonomy | optional `OPENALEX_API_KEY`, sent only as `Authorization: Bearer`. Without a key the server shares a small daily allowance per IP; an exhausted budget is reported with its reset time and never retried. Single lookups are free, lists and searches metered. `page` paging (≤ 10,000 results). A response whose id differs from the requested one is a merge: add the new W, mark the old one superseded |
| arXiv | identity and versions (`export.arxiv.org/api/query?id_list`), licence and version history with withdrawals (OAI-PMH `arXivRaw`), newest papers per category, private copies (`https://export.arxiv.org/pdf/{id}v{n}`) | ≤ 1 request per 3 s on one connection across all processes: **only the worker calls arXiv**, through a pg-boss queue with concurrency 1 and ≥ 3.1 s between requests, honouring Retry-After. Web requests enqueue and read results from the database or cache |
| Crossref | corrections and retractions for Crossref DOIs (`updated-by`, Retraction Watch); bibliographic detail when OpenAlex lacks it | public pool; `CROSSREF_MAILTO` only if the owner sets one; never `OWNER_EMAIL` or a made-up address. arXiv DOIs are DataCite and not covered |
| Unpaywall, Semantic Scholar | not integrated | OpenAlex carries the open-access data; Semantic Scholar needs a key and attribution |

One HTTP client: https to fixed hosts only, identifiers validated and `encodeURIComponent`-encoded
into paths, `redirect: 'manual'`, timeouts (10 s metadata, 20 s arXiv API, 90 s PDF with a streaming
size cap), at most 3 retries with jittered back-off for 429/5xx honouring `Retry-After`, no retry on
other 4xx, zod-validated responses, errors with URLs and keys redacted.

`SCHOLARLY_PROVIDER=live|fixture` (default `live`). `fixture` is an in-process provider reading
recorded responses from `packages/db/src/scholarly/fixtures/` (captured once by an opt-in live
script, whose run is recorded as live). Records created in fixture mode carry source `fixture` and are
visibly labelled *Fixture data*. Production and `pnpm local:owner` refuse `fixture`; the journeys
refuse a stack that is not in fixture mode (and report it through `/api/health`). Journeys answer the
browser's `https://arxiv.org/pdf/**` requests with Playwright route interception, so the tested
build has exactly the production CSP.

Cache lifetimes: taxonomy 30 days; works, references, cited-by and related 7 days; search pages and
subject lists 24 hours (stale lists are shown with their date and refreshed in the background);
Crossref status 7 days. Works in the library keep their own copy, so a failed refresh changes
nothing. Subject lists and arXiv listings are refreshed by worker jobs; pages render from the cache
and say *Not fetched yet* with an auto-refresh when it is empty.

Imports: fetch and normalise outside any transaction; then, in a short transaction, take
`pg_advisory_xact_lock` on each incoming identifier in sorted order and resolve the works holding
any of them: none → create; one → attach (missing identifiers `ON CONFLICT DO NOTHING`); two or more
→ attach to the work matched by the strongest identifier (arXiv > DOI > W), skip identifiers held by
the other, and record a possible duplicate (never fail, never merge automatically). Invariant: a
version with an arXiv id implies an arXiv identifier on the same work. A unique violation retries the
resolve step once. Imports and refreshes follow `merged_into_id`. An arXiv import creates the work at
once from the parsed id (and OpenAlex's record if it has one); versions, licence and withdrawals
arrive through the worker job, and the paper page says *Fetching the arXiv record* until then.

## 6. Services (`packages/db/src/services/`, integration-tested)

Top-level files, so the notices test sees their messages. Every function takes `ownerId`, validates
ids (UUID, `W…`, DOI, arXiv) before any query, checks ownership, and takes the provider client as a
parameter so tests use fixtures. Every service has a test that another owner's id is not found.

- `scholarly-works.ts`: `resolveInput`, `importByIdentifier`, `importFromOpenAlexRecord`,
  `applyArxivRecord` (worker), `saveWork`, `unsaveWork`, `setWorkFlags`, `editWorkFields` (records
  `owner_edited_fields`), `getWork` (work, identifiers, versions, Documents with permissions,
  integrity notices), `getWorkByIdentifier`, `ownerWorkIndex` (every identifier → work id, used for
  every "in your library" marker), `listWorks(view)`, `searchMyLibrary`, `openArxivVersion`
  (creates or reuses the linked Document; refuses withdrawn versions), `recordObservedHash`,
  `acceptNewFile` (drift: owner accepts the new observed hash when page geometry matches),
  `keepPrivateCopy` (worker fetch of an open-licence arXiv PDF, promotion in place),
  `attachUploadToWork`, `createWorkFromUpload` (unidentified), `possibleDuplicates`, `mergeWorks`
  (owner-initiated; `SELECT … FOR UPDATE` both works; collection items `ON CONFLICT DO NOTHING`;
  trail steps, versions, Documents and notebook links re-pointed; flags combined (earliest
  `saved_at`, OR of favourite and read later, latest `read_at`); A's owner edits win; B becomes a
  tombstone; the full mapping goes to `audit_event`), `refreshWork`, `refreshIntegrity`,
  `deleteWorkCompletely`.
- `library-collections.ts`: create, rename, describe, delete, add, remove, move up/down, reason.
- `discover.ts`: `discoverPage(ownerId, day)`, `subjectRoom`, `surprise(ownerId, seed)`,
  `citedByYourPapers`, built from the cache and the owner's works.
- `library.ts` (existing): the Document transitions above; annotation kinds, anchors and
  conflict-checked edits; the reading-position rule; `listReadingNotes` searches in SQL, includes
  highlights and bookmarks, filters by kind, work, collection; `reconcileAnnotations` runs after each
  successful re-extraction; `confirmMetadata` no longer clears `sourceVersionId` and refuses
  scholarly Documents; `requestIngestion` changes status and enqueues in one transaction.
- `records.ts`: the export includes works with identifiers, collections with reasons, reading
  positions and annotations with kind, colour, quote and version.
- Jobs: `scholarly-arxiv` (concurrency 1, spacing), `scholarly-refresh` (works, subject lists,
  integrity), maintenance purge of the cache.

## 7. The reader

`pdfjs-dist@6.4.299` (exact; the engine unpdf 2.1.0 bundles; a pdf.js security advisory overrides
this parity and is bumped alone), legacy build, the official `PDFViewer`, `EventBus`,
`PDFLinkService` and `PDFFindController` wrapped imperatively in a client-only component inside the
`(reader)` route group's full-height layout (its own `main#main` and skip link). Worker, wasm
decoders, CMaps, standard fonts and ICC profiles are copied to `apps/web/public/pdfjs/6.4.299/` by a
vendor script run from the web `dev` and `build` scripts and `scripts/local-owner.ts`. Scripting,
XFA, forms and annotation editors are off; links open in a new tab with `noopener noreferrer`; no
`PDFHistory` (a local back stack). Server extraction pins unpdf's options so installing pdfjs-dist
does not change extracted text, and a test asserts both engines are the same version.

- **CSP**: `connect-src 'self' https://arxiv.org` (exactly); `'wasm-unsafe-eval'` only on responses
  under `/pdfjs/` (the worker), verified on a production build; a test asserts the exact production
  CSP.
- **Loading**: stored Document → fetch the owner-only file route, no hashing. Linked arXiv Document →
  `fetch('https://arxiv.org/pdf/{id}v{n}', {mode: 'cors', credentials: 'omit', redirect: 'error',
  referrerPolicy: 'no-referrer'})`, check status, content type and `%PDF-`, hash, report
  `observed_sha256`; then hand the bytes to PDF.js. Failure says *Your browser could not fetch the PDF
  from arXiv (network or arXiv's access policy)* with *Open on arXiv* and *Try again*. Stored
  Documents over 40 MB or 400 pages open in Text view (if extracted) with *Open page view (N MB)*.
- **Attribution**: for linked Documents a persistent line *arXiv:{id}v{n} · read from arxiv.org ·
  abstract page* and the disclosure *Your browser downloads this PDF directly from arxiv.org; arXiv
  sees your IP address and which paper you open.*
- **Views**: `?view=page|text`, `?page=N` (1-based physical page; overrides the remembered
  position) in both. The Text view keeps every existing label, id (`#page-text`) and parameter.
- **Bar**: Back to paper · title · version · page n of N (printed label) · previous/next · go to page
  · zoom select (fit width, fit page, percentages; ctrl+wheel and pinch) · Contents · Notes · Paper
  · Ask · Hide panel · Full screen. No single-letter shortcuts; PageUp, PageDown, Home and End work
  while the viewer (focusable, named "Pages of <title>") has focus. Desktop panel is an aside; on
  phones panels open in a native `<dialog>` with a visible Close.
- **Annotations**: selection → *Highlight · Note · Ask · Clear*; *Bookmark page*; *Page note*;
  *Mark area* (two clicks with Cancel, for pages whose text layer is unusable). Overlays are
  re-attached on `pagerendered`/`textlayerrendered`. Routes `POST/PATCH/DELETE
  /api/library/annotations` and `POST /api/library/position` accept JSON only and require
  `Sec-Fetch-Site: same-origin` or a matching Origin; position uses `fetch` with `keepalive` on page
  hide.
- **Drift**: if a linked Document's observed hash changes, the reader compares page count and page
  views with the anchors; equal → annotations are drawn with *arXiv's file has changed since these
  notes were made* and *Keep my notes on the new file*; otherwise they are listed as needing repair.
- **Versions**: the reader names the exact version; when a newer version exists it links to it;
  annotations stay where they were made; withdrawn versions say *Withdrawn on arXiv* (arXiv's
  administrators withdraw versions too, so the reader does not say who withdrew it).

## 8. The reading companion

Closed by default (*Ask* panel). It extends `/api/library/ask` with an action (question, explain
passage, explain notation, walk through proof, check my understanding) chosen by
`decideCompanionAction`, keeping the gate order: owner, Document state, `external_ai` allowed on
that Document (only the owner grants it, with the licence shown and a basis recorded). Evidence for a
stored, extracted Document: the selection (attributed to the paper only when found on the page), the
page, and for proofs the next page. For a linked Document: only the selection, labelled *Text you
selected in the reader; Corniversity has not checked it against the paper*. Evidence moves out of the
system prompt into a delimited block with the rule that quoted text may contain instructions that
are never followed (prompt version bumped). Single-turn, scripted fixtures labelled, refusals show
their reason, budget refusals are explained. Compare papers, multi-turn conversations and AI-built
trails are deferred.

## 9. Discover, honestly

The owner's subjects live in `library_preference` (the four primary subjects until the owner
chooses; none is a valid choice with its own empty state), chosen on `/library/discover` with a
checkbox form. Per subject, ten rows each (Discover shows five, the subject room all ten), most cited
first where a count applies: *New on arXiv* (the ten newest submissions in the subject's arXiv
categories; primary subjects only), *Reviews and surveys* (OpenAlex type review, published in the
last five calendar years), *Most cited* and *Earlier work* (published before 1990), each count named
as OpenAlex's ("Cited by N works in OpenAlex"). Subject lists are read from the provider cache only:
the worker fetches them, the OpenAlex lists on the `scholarly-lists` queue and the arXiv listings on
`scholarly-arxiv` (the only queue that calls arXiv), daily at 05:20 UTC for every chosen subject (and
the defaults while an owner has not chosen) and whenever a page finds a list missing or out of date
(at most one job per owner, subject and kind an hour, recorded in the owner's jobs). A missing list
says *Not fetched yet* while its job is queued or running, and with JavaScript the page refreshes
itself until it arrives (and says so only then); *Check again* reloads the page, also without
JavaScript. A stale list keeps its rows and date and says what its refresh is doing: refreshing in
the background while the job is queued or running, what the job reported when the refresh failed, or,
when the hour's job has already finished, the hour after which the page asks again; a list the hour's
job finished but the cache no longer holds says the same instead of *Not fetched yet*. A failed fetch
shows what the job reported (allowance spent with its reset time, rate limited, unavailable, not
recorded in fixture mode), never an empty list. A failed *Save* returns to its list and shows its
notice there.

Across subjects, rendered at once from the cache when it holds them fresh, else fetched in the request
and streamed (a stale cached list shows its date meanwhile; without JavaScript a streamed list says to
reload, since the server caches it either way): *Cited by 2 or more of your papers* (core
`citedByLibrary` over the saved papers' `referenced_openalex_ids`, papers already in the library left
out, titles from one OpenAlex batch); *Similar to <title>* (OpenAlex's `related_to` works of the most
recently saved paper that has an OpenAlex identifier, labelled similarity, not a citation; when no
saved paper has one, it says so); *From your courses* (registry sources of
the courses the owner takes whose address carries a DOI or arXiv id, found by parsing only;
read-only, no Save); *Surprise me*, fetched only when asked: one review with an abstract, free to read
according to OpenAlex and not retracted, from a field outside the owner's subjects, chosen by OpenAlex
sampling with a seed from the day and the count of surprises asked for (*Another*), its abstract from
the single work. Rows show title, first three authors, year, the count or arXiv submission date, an
*In your library* marker (`ownerWorkIndex`) or *Save* (`importByIdentifier`, then `saveWork`), and
link to the paper page or the preview. Every list names its provider and retrieval date; fixture data
is labelled *Fixture data*. In fixture mode recorded responses sit behind the same cache (under keys
of their own), so lists arrive only through the worker's jobs, and the day is the recording day
(2026-11-15), which fixes seeds and year ranges. No feeds, scores, streaks, reading-time counts or AI
summaries. Without an OpenAlex key in production, OpenAlex lists say *OpenAlex browsing needs an API
key on this server* and the worker asks OpenAlex for none, while lookups by identifier still work.

## 10. Build order and checks

1. In parallel: **foundation** (core rules, schema and migration, scholarly adapters and fixtures,
   services, transitions, fixes, jobs, notices, shared header, stub routes; one migration owner) and
   **reader core** (pdfjs, vendor script, CSP, `(reader)` route group, Page and Text views, loading,
   navigation, zoom, outline, find, links), each verified independently.
2. In parallel with disjoint files: **find and paper** (find, preview, paper page, discover,
   subjects, worker jobs) and **reader features** (annotations, positions, panels, phones, linked
   arXiv loading, drift, versions).
3. In parallel: **library home, collections and notes** (home, shelves, trails, notebook filters,
   records export) and **companion**.
4. Integration: journeys 04/07/08/15 updated, a research-library journey at both viewports against a
   production build on an empty database in fixture mode, browser review.
5. Independent reviews (correctness, security, honesty, design) and fixes until dry; living
   documents and QA record.

Checks: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `pnpm build`,
`pnpm test:e2e`, and the opt-in live provider check recorded as live.

## 11. Decision log

| Decision | Why |
|---|---|
| The research library extends the existing Library and its tables | one Document identity for reading position, notes, permissions and the companion; no parallel systems |
| arXiv PDFs are read by the owner's browser from arxiv.org (`linked_remote`); nothing is stored or served | arXiv's terms allow retrieval for personal use and ask services to direct users to arXiv rather than store and serve; most papers in the owner's subjects carry arXiv's non-exclusive licence; arXiv sends `Access-Control-Allow-Origin: *`. The owner may instead choose private copies of non-exclusive papers for personal use (USER_ACTIONS) |
| A linked Document is identified by its arXiv version, not by a hash | arXiv's ETag is not the hash of the served bytes and arXiv regenerates PDFs from source; the browser's hash only detects change |
| Private copies only for open licences reported by arXiv OAI-PMH for that exact version | licences and host terms decide storage per version; provider-reported licences elsewhere are display-only |
| DOI-only papers: *Read* opens the best open location (host and version named) or the publisher page; *Attach your copy* on the paper page makes it readable at once | the common case outside arXiv fields, without an unrestricted fetcher |
| No URL is ever fetched from user input | identifiers are parsed out of URLs; no SSRF surface |
| Only the worker calls arXiv, one request at a time | arXiv's rate rule applies across all processes |
| Owner-scoped works with composite foreign keys | single-owner institution with a labelled demo learner; cross-owner links impossible |
| arXiv versions are their own versions even when OpenAlex merges them into the published work | annotations stay on the exact file; licences differ by version |
| Annotations anchored by rects in PDF user space; the owner's selected quote is kept with the note | mathematical PDFs have unreliable text layers; the quote is the owner's own copying for study and is never used as companion or tutor evidence for a linked Document |
| Reading positions ordered on the server's clock | device clocks disagree |
| `/library` stays a database-only home; Discover is one tab over and renders from the cache | the entrance is fast and works when providers fail; existing journeys and links stay valid |
| Shelves and trails are one collection table with a kind | a trail is an ordered shelf with a reason per step |
| Notes stay in `/notebook` with a Library filter | the notebook is the single place for notes |
| No curated lists or trails; *Earlier work* and *From your courses* instead | curation would need every entry verified by opening; counts and registry sources are already factual |
| No *Unexpected connections* | co-classification by a topic model is noise presented as insight |
| References, cited by and related as bounded lists with provenance; counts say what OpenAlex matched | OpenAlex reference lists are incomplete for some fields |
| Reader in its own route group without app chrome; *Hide panel* and *Full screen* instead of a focus mode | a full-height viewer inside the padded app layout fights page scroll |
| Ranged PDF delivery deferred; large stored books open in Text view by default | papers are small; whole-file delivery is simple and correct |
| Deferred: BibTeX/RIS/Zotero import, browser extension, compare papers, multi-turn companion, AI-built trails, embeddings, reflowed view of linked papers, followed authors, iOS-specific testing beyond the WebKit project | outside the core loop of discover → read → understand → follow |
