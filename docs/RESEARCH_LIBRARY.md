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
| `/library` | **Library home**, database only (no provider call): a find box (a GET form to Find papers) with *Add a paper*, *Discover* and *Library notes* links; *Continue reading* (`continueReading`: at most 3 Documents by `reading_progress.last_opened_at`, newest first, each named by its paper, or the file, with its version and the saved page; the link opens the reader, which restores the place); *Saved papers* with views *All saved · Read later · Favourites · Read · Recently opened* (`?view=`, `listWorks`, 20 a page with `?page=`; a page past the last says so), rows with title, first authors, year, venue, *Fixture data* and an integrity label where recorded, and *Read* where a Document of the paper can be opened (`documentsForWorks`: the most recently opened readable one, else the newest); *Shelves and trails* with their counts, links and a create form (kind, name); and the existing **Files** list with its markup, links, sync badge and `?deleted` notice (Upload, Desktop sync and Jobs are links in the Files header; *Read* where `pageViewAvailable` or `textViewAvailable`). Every view has a plain empty state saying what fills it. h1 stays "Library" |
| `/library/find` | **Find papers**: one box (DOI, DOI inside any URL, arXiv id or URL, OpenAlex id or URL, or words; identifiers are parsed out of links as text, nothing is fetched). An exact identifier opens the paper page when the owner has the paper, else its preview. Words search OpenAlex (*All papers*, 25 a page, pages up to OpenAlex's 10,000 results) or the owner's works (*My library*); filters: published from/to (year), type, field (the subjects of §4), free to read (All papers only). Rows: title, first authors, year, venue, type, *cited by N according to OpenAlex*, *Free to read according to OpenAlex*, *In your library* (`ownerWorkIndex`; a paper the owner removed from the library says *Not in your saved papers* and offers Save again), Save (returns to the same page). A page past the last says so and links back; a link with no identifier and no words says that, and nothing is searched. Provider failures say what happened (fixture recording missing, unavailable, allowance used up with its reset time), never "no results"; in production without `OPENALEX_API_KEY` word search says *OpenAlex browsing needs an API key on this server*. Links to *Add a paper without an identifier* and to Upload |
| `/library/papers/new` | a PDF becomes a new, unidentified paper (`createWorkFromUpload`, optional title, nothing read from the file; other files are refused); the form posts to `/api/library/papers/new` |
| `/library/discover` | **Discover**: your subjects, per subject *New on arXiv*, *Reviews and surveys*, *Most cited*, *Earlier work*; *Cited by 2 or more of your papers*; *Similar to …* ; *From your courses*; *Surprise me* |
| `/library/subjects/[slug]` | subject room: subfields and the same three or four lists |
| `/library/works/[scheme]/[...value]` | preview of a paper not in the library (`scheme` = doi, arxiv, openalex; the value may contain slashes); redirects to the paper page when the owner has it by this or any identifier the provider reports. Otherwise OpenAlex's record (through the provider cache), or Crossref's for a DOI OpenAlex lacks, in `PaperView` with *Save to library* (import, save, queue the Crossref integrity check for a publisher DOI, open the paper page). An arXiv id OpenAlex did not answer for says why and still offers Save, which creates the work and queues its arXiv record. A DOI neither provider knows says so |
| `/library/papers/[workId]` | paper page (same `PaperView` component as the preview; a merged tombstone redirects to its survivor): integrity notices first; title line, authors, date with its precision, venue, type, abstract with its source, identifiers with source and retrieval date, OpenAlex's subjects; *Fixture data* where provenance is fixture. *Read*: an arXiv version (server action `openArxivVersion`, then `/library/read/<assetId>`), a stored file (a stored copy of the latest version replaces its arXiv Read), or for a DOI-only paper the best free-to-read location OpenAlex reports (host and version named) and the publisher's page through doi.org (new tab, `noopener noreferrer`). Flags (favourite, read later, have read), *Remove from library*, *Notes for this paper* (`/notebook?library=1&work=<id>`) and *New note for this paper* (the same view's form). Versions: date, licence as arXiv reported it for that version (or *No licence reported by arXiv for this version*), *Withdrawn on arXiv*, *Read vN*, *Keep a private copy of vN* only where `storageDecision` allows (`requestPrivateCopy`); *Fetching the arXiv record* with automatic refresh while the job runs. Files: stored copies with status, permissions (per action, with basis), extraction, removal (each form acts only on this paper's stored files); *Attach your copy* posts to `/api/library/papers/[workId]/attach` (`attachUploadToWork`, PDFs only; refusals shown with a link to the paper a file belongs to). Shelves and trails, each named and linked (a trail with the paper's step and the next paper: *Trail: X, step 3 of 7; next: Y*, or *the last step*); add with an optional reason, create and add, remove. References, cited by and related (streamed; about 10, *Show more* up to 50; what OpenAlex counted, how many records it returned, and how many are listed; related labelled similarity, not citation). Without JavaScript a streamed part's placeholder links to the page rendered whole (`?full=1`). Possible duplicates with an owner-confirmed merge. *Edit details* (only changed fields become owner edits). *Delete this paper and its notes* behind a confirmation step listing what goes (`workDeletionSummary`); a merged id is refused and opens the survivor |
| `/library/read/[assetId]` | the reader, in its own route group `(reader)` with a full-height layout |
| `/library/shelves`, `/library/trails` | the owner's shelves (or trails) with how many papers each holds, and a form for a new one (name, optional description) |
| `/library/shelves/[id]`, `/library/trails/[id]` | one collection (one table, two kinds; an id of the other kind redirects to its page): the description (owner Markdown and LaTeX through the sanitiser; a trail's holds its question, prerequisites and links to other trails or papers); the papers in the collection's order, each with its note (shelf) or numbered step and reason (trail), both Markdown and LaTeX, *Read* where a Document can be opened, *Move up* and *Move down* (offered in the collection's own order with nothing filtered) and *Remove* (the paper, its notes and files stay; a paper with a note or reason written here asks first on its row, since that text goes with it); a shelf also searches its papers (every word in the title, an author, the venue or the year) and filters by the owner's flags, and orders by *Recently added*; *Add from your library* (`searchMyLibrary` for words, else the recently saved papers not on it; when every match is already there it says so; a trail step takes an optional reason); rename and describe; *Delete* behind a confirmation box that says the papers, their notes and files are kept. Each form returns to its own section (`#…`, named again as `at=`) and its notice is shown inside that section, in view; so do the create forms of `/library` and the list pages and the notebook's *New note for this paper*. No AI-built trails |
| `/notebook?library=1&work=<id>&kind=…&subject=…&q=…` | every library note, newest first (the 100 most recent of each kind; search or filters reach older ones): highlights, page and area notes and bookmarks (`listReadingNotes`; the quote as text, the note through the sanitiser, colour, the paper and version, *Open page N in the reader*; an anchor that needs repair says so and opens the page it was made on; a removed file says so) and paper notes (`paperNotes`: notebook entries with `scholarly_work_id`). Filters: `work`, `kind` (highlight, note, bookmark, paper), `subject` (an OpenAlex field of the papers that carry notes, as OpenAlex classified them), `q` (both searches). With a paper: its title and *New note for this paper* (title, kind, Markdown with LaTeX); a merged paper's id redirects to its survivor's notes; an id that is not the owner's paper says so. `/notebook` keeps every entry (free notes included); a paper note's page names its paper |
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
paper notes set it (the service follows a merged paper to its survivor and refuses any id that is
not the owner's paper); merges re-point it; the notebook filters by it.

**`library_collection`** (`id`, `owner_id`, `kind` shelf | trail, `name`, `description`,
timestamps; unique (owner, kind, lower(name))) and **`library_collection_item`** (`collection_id`,
`owner_id`, `work_id`, `position`, `reason` (a trail step's "why"; a shelf's optional note),
`added_at`; PK (collection, work); composite FKs; work FK `ON DELETE RESTRICT`). A collection's
order is `position`, then `added_at`, then `work_id`; adding appends; moving renumbers the items
1…n in that order with the two swapped, so positions a merge left equal never block a move. A
paper can be on many collections; removing it, or deleting a collection (with its items' reasons),
never touches the paper, its annotations, notebook entries or files. Trail notes are the
description and the step reasons; there is no other trail note store.

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
- `companion.ts`: `decideCompanionAction` (ask a question, explain this passage, explain this
  notation, walk through this proof, explain the background, question this argument, check my
  understanding) with reasons for refusal (`COMPANION_REFUSALS`) before any model call;
  `neutraliseQuotedText`, `neutraliseEvidenceTags` and `quotedLine` for quoted text sent to the model.

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
script, whose run is recorded as live; each stream records only its own requests with
`--record-group`, never re-recording existing ones). Records created in fixture mode carry source
`fixture` and are visibly labelled *Fixture data*. A request with no recording is reported as
unavailable in fixture mode, never as "no results". No PDF is recorded: in fixture mode a request for
an arXiv version's PDF is answered with a generated, deterministic stand-in whose own text says it is
a fixture stand-in for arXiv:{id}v{n} and not arXiv's file, so private copies can be tested. Production
and `pnpm local:owner` refuse `fixture`; the journeys refuse a stack that is not in fixture mode (and
report it through `/api/health`). Journeys answer the browser's `https://arxiv.org/pdf/**` requests
with Playwright route interception, so the tested build has exactly the production CSP.

Find papers, the preview and the paper page read OpenAlex (and Crossref for a DOI OpenAlex lacks)
in the request through the provider cache; the paper page streams its OpenAlex parts (open
locations, references, cited by, related), so it renders from the database first; `?full=1` renders
them in the page instead, for browsers without JavaScript. Find pages are
25 results; cited-by lists ask OpenAlex for the 50 most cited citing works; reference and related
lists are one batch of up to 100 ids, shown in OpenAlex's order. In production without
`OPENALEX_API_KEY`, word searches and these lists (metered) are not requested and say *OpenAlex
browsing needs an API key on this server*; single lookups by identifier still run. A Save queues the
Crossref integrity check (`scholarly-refresh`, task `integrity`) when the work has a publisher DOI
that was never checked.

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
  integrity notices, the latest arXiv job, and each Document's latest private-copy and extraction
  job), `getWorkByIdentifier`, `ownerWorkIndex` (every identifier → work id, used for
  every "in your library" marker), `listWorks(view)`, `searchMyLibrary` (filters: year from/to,
  type, OpenAlex field or subfield among the work's subjects; offset paging), `workDeletionSummary`
  (what deletion would remove, for the confirmation step), `requestIntegrityCheckIfDue` (after a
  save), `openArxivVersion`
  (creates or reuses the linked Document; refuses withdrawn versions), `recordObservedHash`,
  `acceptNewFile` (drift: owner accepts the new observed hash when page geometry matches),
  `keepPrivateCopy` (worker fetch of an open-licence arXiv PDF, promotion in place),
  `attachUploadToWork` and `createWorkFromUpload` (unidentified; both take PDFs only), `possibleDuplicates`, `mergeWorks`
  (owner-initiated; `SELECT … FOR UPDATE` both works; collection items `ON CONFLICT DO NOTHING`;
  trail steps, versions, Documents and notebook links re-pointed; flags combined (earliest
  `saved_at`, OR of favourite and read later, latest `read_at`); A's owner edits win; B becomes a
  tombstone; the full mapping goes to `audit_event`), `refreshWork`, `refreshIntegrity`,
  `deleteWorkCompletely`. Beside it, `paper-lists.ts` reads providers for the pages and writes
  nothing: `searchPapers` (Find's OpenAlex page with filters and markers; a marker says whether the owner's work is saved), `previewPaper` (the owner's
  work, OpenAlex's or Crossref's record, or an arXiv id with the reason OpenAlex did not answer),
  `openAlexRecordForWork`, `paperList` (references, cited by, related), `openAlexBrowsingRefusal`.
- `library-collections.ts`: create, rename, describe, delete, add (follows merges; appends),
  remove (returns the item's note or reason it deleted, so the page can say so), move up/down
  (renumbers, §3), reason; `listCollections` (with item counts);
  `getCollection(view)` (search words over title, authors, venue and year; the owner's flags;
  the collection's order or newest first; each paper keeps its step in the collection's own order,
  and `total` counts the whole collection); `collectionsForWork` (each shelf or trail with the
  paper's step, the number of steps and the previous and next paper).
- `library-home.ts`: `continueReading` (the Documents opened most recently, at most 3 by default,
  with the paper or file name, version and saved page; deleted Documents never) and
  `documentsForWorks` (the live Documents of listed papers, most recently opened first, then newest).
- `notebook.ts` (existing): paper notes: `createEntry` takes `scholarlyWorkId`, `notesPaper`
  (the owner's paper, merges followed), `paperNotes` (by paper, OpenAlex field and words, newest
  first), `libraryNoteSubjects` (the OpenAlex fields of papers that carry library notes).
- `discover.ts`: `discoverPage`, `subjectLists`, `subjectRoom`, `subjectSubfields`,
  `citedByYourPapers`, `similarToRecent`, `fromYourCourses`, `surprise(n)` (seeded from the day and
  `n`), `getDiscoverSubjects`/`setDiscoverSubjects` (the owner's subjects in `library_preference`),
  `refreshSubjectLists` (worker), built from the cache and the owner's works.
- `reader.ts`: `readerDocument` (the Document, its work with merges followed, identifiers, version,
  arXiv versions, reading position and annotations; `null` for another owner's Document).
- `companion.ts`: `companionDocument`, `prepareCompanionTurn` (gates and bounded, neutralised
  evidence; refusals with `companionRefusalKind`), `appendCompanionRequest` (the request with the
  evidence blocks sent), `companionActionOf`, `companionLearnerMessage`, `recordCompanionPermission`
  (through `setPermission`), `latestCompanionExchange` (with the request's action and what was
  sent), `companionLicenceLine`.
- `library.ts` (existing): the Document transitions above; annotation kinds, anchors and
  conflict-checked edits; the reading-position rule; `listReadingNotes` searches in SQL, includes
  highlights and bookmarks, filters by kind, work, collection and `subject` (an OpenAlex field among
  the subjects of the Document's paper), newest first; `reconcileAnnotations` runs after each
  successful re-extraction; `confirmMetadata` no longer clears `sourceVersionId` and refuses
  scholarly Documents; `requestIngestion` changes status and enqueues in one transaction.
- `records.ts`: the export includes works with identifiers, collections with reasons, reading
  positions and annotations with kind, colour, quote and version: `buildRecordsBundle` adds
  `library` (`libraryRecord`: works with flags, identifiers and provenance; shelves and trails with
  their items in order, steps and reasons; reading positions with the paper or file, version and
  page) and gives each annotation its kind, colour, quote, `quote_matched`, page, paper, version
  and anchor. The Markdown export gains a *Research library* section and names each reading note's
  version, kind, colour and page; the notebook JSON carries the annotations; the records JSON
  leaves the library out, as it leaves out notes. Format names are unchanged; the worker builds
  every export.
- Jobs: `scholarly-arxiv` (concurrency 1, spacing), `scholarly-refresh` (works, integrity),
  `scholarly-lists` (subject lists: daily at 05:20 UTC, and on demand from Discover at most once per
  owner, subject and kind per hour), maintenance purge of the cache.

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
  referrerPolicy: 'no-referrer'})` with the URL built from core `parseArxivId`'s normal form, check
  status, content type and `%PDF-`, hash; then hand the bytes to PDF.js, and once every page is known
  report the hash and page count (`recordObservedHash`: first, same or changed). A network failure
  says *Your browser could not fetch the PDF from arXiv (network or arXiv's access policy)*; an error
  status or a response that is not a PDF says so; each with *Open on arXiv* and *Try again*. Stored
  Documents over 40 MB or 400 pages open in Text view (if extracted) with *Open page view (N MB)*. A
  linked Document has no Text view. The page loader is `readerDocument` (services/reader.ts: the
  Document with its version, paper (merges followed), identifiers, sibling arXiv versions, position
  and annotations, for its owner only).
- **Attribution**: for linked Documents a persistent line *arXiv:{id}v{n} · read from arxiv.org ·
  abstract page* (the version notices share it) and the disclosure *Your browser downloads this PDF
  directly from arxiv.org; arXiv sees your IP address and which paper you open.*
- **Views**: `?view=page|text`, `?page=N` (1-based physical page; overrides the remembered
  position) in both; a repeated parameter counts by its first value. The Text view keeps every
  existing label, id (`#page-text`) and parameter; asked for on a linked Document it says *No Text view
  for this paper*.
- **Bar**: *Back to paper* (`/library/papers/<workId>`; *Back* to the item for a Document of no paper)
  · title · version · page n of N (printed label) · previous/next · go to page · zoom select (fit
  width, fit page, percentages; ctrl+wheel and pinch) · Contents · Find · Notes · Paper · Ask · Hide
  panel · Full screen (and *Text view* when the text is extracted). No single-letter shortcuts;
  PageUp, PageDown, Home and End work while the viewer (focusable, named "Pages of <title>") has
  focus. Desktop panel is an aside. On phones and short landscape screens (at most 640 px wide or
  500 px high) the bar is compact: *Back* · title · *Panels*, then previous/next · page · zoom (two
  rows at 390 px, one row at 844 × 390); *Panels* opens a native `<dialog>` with the section switches,
  a visible Close, *Text view* and *Full screen*. Paper panel: title, authors, year and venue as
  reported (with who reported them and when; recorded fixture data is labelled *Fixture data*), the
  exact version with its date and licence attribution, current identifiers linked only from their
  normal form, and *Paper page*.
- **Annotations**: a selection in the pages shows a bar at their foot: *Highlight* (with its colour:
  one of the five roles brass, moss, rust, slate, neutral) · *Note* · *Ask* · *Clear*. A selection is
  anchored on the page where it starts (cut at that page's end), one rect per line in PDF user space,
  `pageView` the unrotated `page.view` size, the owner's selected text as the quote. The Notes panel
  has *Bookmark page* (*Remove bookmark* when the page has one), *Page note* and *Mark area* (two
  clicks on one page, with Cancel and Esc; links and selection pause meanwhile) for the page in view;
  bookmarks and page notes carry a page anchor without rects; a bookmark's ribbon is drawn only while
  the bookmark stands on the file shown (the drift rule below). *Highlight* and *Bookmark page* send
  one request at a time, so a double click makes one annotation. It lists the Document's annotations in
  reading order with *Go to*, *Edit* (note and colour) and *Delete* (confirmed), notes rendered by the
  Markdown and KaTeX sanitiser, quotes as escaped text, and lists the others under *Needs repair*.
  Overlays are drawn into a layer of each page, under the text layer, and re-attached on
  `pagerendered`/`textlayerrendered`. Routes `POST/PATCH/DELETE /api/library/annotations` (PATCH and
  DELETE name the annotation in the body) and `POST /api/library/position` require the session (401),
  then accept JSON only (415) from `Sec-Fetch-Site: same-origin` or a matching Origin (403), then a
  body of the right shape (400); these refusals carry a code, and for an annotation the reader says
  it was refused and nothing changed. A service refusal carries its code and the registered sentence.
  A PATCH whose `expectedUpdatedAt` is stale answers 409 with the current row, which the panel shows
  beside the owner's draft (*Save my draft over it* or *Use the saved version*). *Ask* is not part of the reader itself: the companion adds it through the reader's
  `selectionActions` and `panels` extension points, and nothing is shown without them. A selection
  action receives the selection and may name a panel to open (`opens`; the selection is then cleared,
  as *Note* does); a panel's `render` receives the selection, the page in view and the hash of the
  bytes the reader loaded (`loadedSha256`).
- **Position**: only the owner's own moves are saved: a change of view within 2 s of their input
  (scroll, key, tap, a reader control). Arriving (through `?page=N` or the remembered place),
  resizing and re-layout never save, in either view; the Text view saves after a page change it made
  (its page form navigates on the client). The reader restores the page and the top-left inside it,
  at its fit-width zoom (a zoom chosen on one screen does not suit another); a position whose top and
  left are both 0 names only its page (the Text view's saves) and opens at the top of that page. Every
  position the tab sends is also kept in its `sessionStorage` for 30 s, so a reload (or a return to the
  reader) rendered before the last save reached the server opens where the owner was; `?page=N` still
  wins. Saves wait 1.2 s after the
  last move, one request at a time per tab, each numbered; the route drops a save that arrives after a
  later one from the same tab (kept in the web process's memory). On page hide, and when the tab
  becomes hidden, the latest move is sent with `fetch` and `keepalive`. Opening the reader records
  `markDocumentOpened`.
- **Drift**: an anchor measured on exactly the bytes just loaded, or on the Document key while the
  server reports the same (or first) hash, is drawn. Every other anchor of a linked Document (arXiv's
  file changed, the report failed, or it was made on other bytes or an earlier stored copy) goes
  through the drift check together (page count unchanged when known, every annotated page the same
  size). Equal → drawn. Those known to be on another file show *arXiv's file has changed since these
  notes were made* (or *Some notes were made on another file of this paper*) with *Keep my notes on the
  new file* (`acceptNewFile`), offered only when the same check over every anchored annotation (needs
  repair included, as `acceptNewFile` checks) passes; otherwise the banner says which pages differ.
  When the report failed, anchors on the Document key are drawn without the banner or the offer, and
  the reader says it could not record which file arXiv sent. Not equal → listed as needing repair with
  the reasons, in the reader only, so nothing is stored until the owner acts. If the server refuses
  *Keep*, it marks the notes for repair and the reader lists them with its reasons. An annotation made
  while a change is unaccepted, or before any file is recorded, names the bytes it was measured on
  (the reader reports them; the server keys the anchor with them instead of the Document key and does
  not check its page against the recorded page count, which is another file's). On a stored Document,
  anchors made on another file wait for the server's re-check after extraction.
- **Versions**: the reader names the exact version; the newest later arXiv version that was not
  withdrawn is offered (*A newer version exists: Open arXiv vN*, a server action calling
  `openArxivVersion`); annotations stay where they were made; withdrawn versions, the open one or a
  later one, say *Withdrawn on arXiv* (arXiv's administrators withdraw versions too, so the reader
  does not say who withdrew it).

## 8. The reading companion

Optional and closed by default. In the Page view *Ask* is a reader panel and a button in the
selection bar, which hands the selection to the panel and opens it (the §7 extension points, built by
the client wrapper `CompanionPageView`, since functions cannot cross from the server page); in the
Text view it is a closed *Ask* disclosure in the tools, using the selected passage. Nothing is sent
until the owner presses *Send* (disabled until the page's script runs: without JavaScript the panel
says asking needs it; while a request runs *Send* keeps keyboard focus and ignores another press);
nothing is summarised or offered unasked; the Library works with the panel closed. The panel's state
survives switching panels.

**Actions** (core `COMPANION_ACTIONS`, `decideCompanionAction`): *Ask a question* (the owner's
question), *Explain this passage* (a selection), *Explain this notation* (a selection of at most 300
characters), *Walk through this proof*, *Explain the background*, *Question this argument* (a
selection), *Check my understanding* (the owner's own explanation, at least 20 characters). Other
actions take optional words from the owner (at most 2,000 characters); a selection is at most 4,000.
One request, one streamed answer (`streamPersonaTurn`); each request is its own conversation, so
nothing earlier reaches the model.

**`POST /api/library/ask`** `{assetId, action, pageIndex, selection, text, loadedSha256?}`: the
session (401); JSON from this site's own pages (415, 403: the annotation routes' guard); the body's
shape (400); then `prepareCompanionTurn` (`services/companion.ts`) in the fixed order: the owner's
Document (404; another owner's is not found); its state (409: deleted; on the owner's desktop only; a
stored Document not extracted; a linked Document whose loaded file the reader has not reported, or
whose loaded file differs from the recorded one while notes still drawn as resolved stand on another
file; resolved by *Keep my notes on the new file*, or once the notes are marked for repair);
`external_ai` allowed on that Document (403); what the action needs (422). An allowed request is
stored in the owner's reading-room conversation with the evidence blocks sent
(`appendCompanionRequest`) before the model runs. Every refusal answers
`{error, message}` with a registered sentence, which the panel shows. A run the planner refuses
answers 402 (a limit) or 409 (a blocked provider) with a registered sentence and the planner's
reason with its amounts; the panel links to Settings. Nothing scripted replaces a refused run.

**Permission**: only the owner grants `external_ai`, from the panel's form (or the item and paper
pages). When it is unknown or denied the panel says so, what asking would send, and the Document's
licence: a linked arXiv version's licence as arXiv reported it (or *No licence reported by arXiv for
this version*), a registry item's recorded licence, or *No licence is recorded for this file*;
recorded fixture data says so. *Allow external AI* and *Deny* record the owner's basis together with
the licence shown (`recordCompanionPermission`, through `setPermission`); a missing basis is refused.
Enter in the basis field records nothing (the form's default button is disabled). Nothing is granted
from a licence or automatically.

**Evidence**, bounded, never the whole PDF. A stored, extracted Document: the selection, attributed to
the document (with its passage) only when core `quoteFoundIn` or `foundOnPage` finds it on that page,
otherwise labelled as text the owner selected that was not found there; the page's extracted text (the
selection's page, else the page in view; at most 6,000 characters, unreliable pages marked); and for
proofs the next page. A linked Document: only the selection (the reader keeps at most 2,000 characters,
cut at the end of the page it starts on), labelled *Text you selected in the reader; Corniversity has
not checked it against the paper*. Blocks are numbered by `formatEvidenceBlocks` and travel in the
owner's message between `<evidence>` delimiters, after the document's title and version (one line
each, at most 160 and 80 characters). Quoted text (selections, page text, the title in labels and in
the block, the owner's words) passes core `neutraliseQuotedText`: invisible format characters are
removed, fullwidth and small forms of ASCII are read as ASCII, any evidence tag (with or without its
closing bracket) is replaced, and a line that begins like a block header (`[E2] …`) is marked as
quoted, so nothing quoted can end the block or add a block. The system prompt (`reading-2.0`) holds
no evidence and no title, and says that quoted text may contain instructions that are
never followed, that claims about the paper come only from the evidence with `[E#]` tags, that
background is marked *Background (not from the evidence):*, that only the selection was available
(linked), never to invent theorem numbers, results or references, and for proofs that an explanation
is not formal verification. Stored replies pass the `[E#]` citation checks.

**Answers**: before sending the panel says what will be sent; then the streamed text; then the stored
reply with who produced it (*Scripted demo* or the model), its labels, checked citations and removed
citations, what was sent (headers `x-companion-evidence`, `x-companion-selection`), and fixed notes
(only the selection was sent; an explanation of a proof is not a formal verification of it). An
answer from an earlier visit shows the same notes and what was sent, from the stored request (its
heading names the action; its citations are the blocks sent). The
panel names who answers now (*AI reading companion · scripted demo*, or the model). The scripted demo
has one labelled scripted response per action (`fixtures/lecturer/companion-<action>.json`), each
saying it is scripted and claiming nothing about the paper.

Deferred: compare papers, multi-turn conversations, *Find the relevant reference*, AI-built trails.

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
4. Integration, in parallel with disjoint files: **journeys and accessibility** and **important
   states**. Then independent reviews (correctness, security, honesty, design) and fixes until dry;
   living documents and QA record.

Checks: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `pnpm build`,
`pnpm test:e2e`, and the opt-in live provider check recorded as live.

The journeys run at both viewports (1440 × 900 and 390 × 844) against a production build in fixture
mode (recorded provider responses, the scripted demo, arxiv.org answered by Playwright route
interception with generated PDFs whose text says they are not the paper):

| Journey | Covers |
|---|---|
| 22 `research-loop` | the core loop of the brief's §3 as one session: a new owner's empty library (each part says what fills it and offers the next step); Discover's lists with their explanations, and *Surprise me*; Find by words, an empty search of the library, a DOI link with no DOI; preview and Save; the paper page's references, cited by and related as OpenAlex reports them; an arXiv version read in the reader (contents, find, zoom; highlight, page note with maths, bookmark and position surviving a reload); library notes reopening the page of the highlight and of the note, and a paper note; a shelf with a note and a trail step with its reason, named on the paper page; the companion (closed by default, licence on the permission form, a labelled scripted answer about a selection with what was sent); *Continue reading*; the records export with the paper, the collections and the annotations' kind, page and version. It deletes what it made. Its empty-library test runs only on a fresh database and otherwise skips, saying why, so it runs first after a fresh stack |
| 17, 18, 19, 20, 21 | find, preview and paper; Discover; the reader's annotations, positions, phones, drift and versions; home, shelves, trails and library notes; the companion |
| 04 | Files through the desktop companion, the Text view and its remembered pages |
| 07 | every page and route of the Library, the reader, the notebook, records and `api/library/**`/`api/records/**` refuse a request without a session (with their methods); signed in, an id the owner does not have is not found and returns nothing (a repeated position save for such an id is answered as out of order, also without content) |
| 08 | axe (WCAG 2.2 A/AA, serious and critical) in light and dark on every Library page (each address showing its own page, not a redirect), a notebook entry, and the reader with each panel, the Text view, the phone's *Panels* dialog, the selection bar and the companion's permission form; the reader by keyboard on the desktop (the bar's controls and links, *Contents*, *Find*, *Notes* with *Go to*, *Paper*, *Ask* and *Send*, the selection bar reached by Tab from the pages, *Hide panel*, *Full screen*) with a visible focus ring at each stop; focus moving into an opened panel and back out of the dialog (Escape closes it); a *Contents* entry moving focus to its page, and nothing moving it later; focus kept when a note or a decision replaces its controls; the Page view without JavaScript saying so and offering the Text view, the original file and the way back; touch targets of at least 24 × 24 CSS pixels on the phone in the reader, shelves, trails, notebook and records; named navigation; no transitions under reduced motion. Selecting text in the pages needs a pointer or the browser's caret browsing; the page note is the keyboard alternative to a highlight, and *Mark area* needs a pointer |
| 15 | the registered notices |

## 11. Decision log

| Decision | Why |
|---|---|
| The research library extends the existing Library and its tables | one Document identity for reading position, notes, permissions and the companion; no parallel systems |
| arXiv PDFs are read by the owner's browser from arxiv.org (`linked_remote`); nothing is stored or served | arXiv's terms allow retrieval for personal use and ask services to direct users to arXiv rather than store and serve; most papers in the owner's subjects carry arXiv's non-exclusive licence; arXiv sends `Access-Control-Allow-Origin: *`. The owner may instead choose private copies of non-exclusive papers for personal use (USER_ACTIONS) |
| A linked Document is identified by its arXiv version, not by a hash | arXiv's ETag is not the hash of the served bytes and arXiv regenerates PDFs from source; the browser's hash only detects change |
| Private copies only for open licences reported by arXiv OAI-PMH for that exact version | licences and host terms decide storage per version; provider-reported licences elsewhere are display-only |
| DOI-only papers: *Read* opens the best free-to-read location OpenAlex reports (host and version named) and the publisher's page through doi.org for the DOI OpenAlex names as the work's own (the only publisher DOI when OpenAlex cannot be asked; repository DOIs stay under Identifiers); *Attach your copy* on the paper page makes it readable at once | the common case outside arXiv fields, without an unrestricted fetcher |
| Paper uploads (*Attach your copy*, *Add a paper without an identifier*) are plain multipart forms posting to `/api/library/papers/…`, which answer with 303 redirects and refuse requests from other sites | they work without JavaScript, avoid the 1 MB server-action limit, and stay outside the proxy, which buffers request bodies only up to 10 MB on the `/library` paths it matches |
| No URL is ever fetched from user input | identifiers are parsed out of URLs; no SSRF surface |
| Only the worker calls arXiv, one request at a time | arXiv's rate rule applies across all processes |
| Owner-scoped works with composite foreign keys | single-owner institution with a labelled demo learner; cross-owner links impossible |
| arXiv versions are their own versions even when OpenAlex merges them into the published work | annotations stay on the exact file; licences differ by version |
| Annotations anchored by rects in PDF user space; the owner's selected quote is kept with the note | mathematical PDFs have unreliable text layers; the quote is the owner's own copying for study and is never used as companion or tutor evidence for a linked Document |
| Reading positions ordered on the server's clock | device clocks disagree |
| `/library` stays a database-only home; Discover is one tab over and renders from the cache | the entrance is fast and works when providers fail; existing journeys and links stay valid |
| The home leads with papers (find box, *Continue reading*, saved views, shelves and trails); the Files list keeps its markup below them, and the four count cards that stood above it (files, sources, books to obtain, running jobs) are gone | each count already has its tab or its link in the Files header; "on the shelf" would now be confused with Shelves |
| *Read* on a home or collection row appears only where a Document of the paper exists (the one opened last); an arXiv version never opened is read from the paper page | the home stays database-only and never creates Documents as a side effect of listing papers |
| Shelves and trails are one collection table with a kind | a trail is an ordered shelf with a reason per step |
| A shelf's search runs over its own papers in the service (every word in the title, an author, the venue or the year, accents ignored); moves are offered only in the collection's own order with nothing filtered | collections are small and partial words should match; moving inside a filtered or re-sorted list would be ambiguous |
| Trail notes are the trail's description and its steps' reasons, owner Markdown and LaTeX through the sanitiser; no separate trail note store and no AI-built trails | one place per note; a bibliography is never generated |
| *Remove* on a shelf or trail page asks first, on the paper's row, when a note or reason is written there; the paper page's *Remove* acts at once, with that note shown beside it, and its notice says the note went | the owner's own text is deleted with the paper's place, while the paper and its notes stay |
| Notes stay in `/notebook` with a Library filter | the notebook is the single place for notes |
| Paper notes are written in the notebook's library view (the paper page's *New note for this paper* opens that form); the view merges reading notes and paper notes newest first, at most 100 of each kind | one note form, the notebook's own; older notes are reached by search or filters, as in the notebook |
| No curated lists or trails; *Earlier work* and *From your courses* instead | curation would need every entry verified by opening; counts and registry sources are already factual |
| No *Unexpected connections* | co-classification by a topic model is noise presented as insight |
| References, cited by and related as bounded lists with provenance; counts say what OpenAlex matched | OpenAlex reference lists are incomplete for some fields |
| Reader in its own route group without app chrome; *Hide panel* and *Full screen* instead of a focus mode | a full-height viewer inside the padded app layout fights page scroll |
| Ranged PDF delivery deferred; large stored books open in Text view by default | papers are small; whole-file delivery is simple and correct |
| The companion also offers *Explain the background* and *Question this argument* | the owner's brief lists them among its core capabilities; they use the same gates, evidence and labels (background marked as background; weaknesses put as questions to check) |
| `/api/library/ask` takes the annotation routes' same-origin guard, and its evidence moves into the owner's message | a request can spend money on a live model; quoted text is data, never instructions |
| A changed arXiv file stops the companion only while notes still drawn as resolved stand on another file | with no such notes there is nothing to resolve; the reader's *Keep* resolves the rest, and a refused *Keep* marks them for repair |
| Each companion request is its own conversation | single-turn: nothing earlier reaches the model, and the last request and answer are what the panel shows again |
| Deferred: BibTeX/RIS/Zotero import, browser extension, compare papers, multi-turn companion, *Find the relevant reference*, AI-built trails, embeddings, reflowed view of linked papers, followed authors, iOS-specific testing beyond the WebKit project | outside the core loop of discover → read → understand → follow |
