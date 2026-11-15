# Recorded scholarly provider responses

These files are **recorded responses** from the live OpenAlex, arXiv and Crossref APIs, retrieved on
**2026-11-15 between 03:13 and 03:16 UTC** (each entry's exact time is its `retrievedAt` in
`manifest.json`). They were recorded once by `pnpm library:live-check --record` (the two taxonomy
responses re-recorded minutes later with a smaller `select`), with no OpenAlex key and no email
address, spacing arXiv requests 3.5 s apart.

They are provider data as reported, not verified by opening. They are used only by the fixture
provider (`SCHOLARLY_PROVIDER=fixture`, which marks everything it returns as source `fixture`) and by
the adapters' contract tests. Mocked and recorded tests are not live checks; the live check is
`pnpm library:live-check`.

`manifest.json` maps each canonical request (`GET https://host/path?sorted-query`, never containing a
key or email) to its status, content type, body file and retrieval time. Bodies are stored exactly as
received (plus a final newline).

| Provider | Recorded |
|---|---|
| OpenAlex | a filtered search page (`direct preference optimization`, field 17); works by DOI `10.7717/peerj.4375`, by W `W7133208539`, by arXiv `2305.18290` and `hep-th/9711200`; a 404 for an unregistered DOI; a cited-by page (`cites:W7133208539`); the reference and related-work batches of `W7133208539`; `/fields`; `/subfields` of fields 17, 26 and 31; most cited in field 26 |
| arXiv export API | `id_list` for `2305.18290` (CC BY), `1706.03762` (non-exclusive licence), `hep-th/9711200` (old-style id) and `2607.20049` (withdrawn at v2); newest in `cat:math.*` |
| arXiv OAI-PMH (arXivRaw) | the same four ids, and `2611.99999` (`idDoesNotExist`) |
| Crossref | `10.1016/s0140-6736(97)11096-0` (Retraction Watch correction and retraction), `10.7717/peerj.4375`, and a 404 for the arXiv DataCite DOI `10.48550/arxiv.2305.18290` |

No merged OpenAlex id was found among the recorded works (the one id missing from the reference batch,
`W6969036009`, exists but lies outside OpenAlex's default corpus), so the merge case is tested with a
simulated response, labelled as such in the test. No PDF is recorded.

To re-record (about 26 live requests): `pnpm library:live-check --record`. Review the diff before
committing; responses change as the providers update their records.

## Discover (`--record-group discover`)

Recorded on **2026-11-15 between 05:58 and 06:01 UTC**, with no OpenAlex key, by
`scripts/scholarly-record/discover.ts`, which builds every request with the Discover service's own
functions (so they are exactly the requests the worker and the pages send in fixture mode, where the
service fixes the day to 2026-11-15). 42 live OpenAlex requests and 4 live arXiv requests, 3.5 s
apart; ten single-work lookups from a first attempt at choosing the journey's papers were removed
again because nothing requests them.

| Provider | Recorded |
|---|---|
| OpenAlex | Reviews and surveys (type review, 2022–2026), Most cited and Earlier work (before 1990), ten each, most cited first, for mathematics (field 26), physics (31), computer science (17), artificial intelligence (subfield 1702) and chemistry (16); `/subfields` of fields 26, 31, 17 and 16; Surprise me samples (seeded) and their single works for the first and second surprise of the default subjects and the first of the journey's subjects; single works `W2023271753`, `W2086957099` and `W2143981217` (density-functional papers from the physics lists); works related to `W2086957099`; the work both `W2023271753` and `W2086957099` cite |
| arXiv export API | the ten newest submissions in `math.*`, in the thirteen physics archives and categories of `packages/core/src/scholarly/subjects.ts`, in `cs.*` and in `cs.AI` |

The group answers requests that are already recorded from the fixtures and calls the providers only
for the rest, so running it again records nothing that exists.
