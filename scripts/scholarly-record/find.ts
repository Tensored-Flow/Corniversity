// Recording group "find" (`pnpm library:live-check --record-group find`): the OpenAlex and Crossref
// requests that Find papers, the paper preview and the paper page make for the research-library
// journey (tests/e2e/17-research-library.spec.ts) and the paper-lists integration tests. No arXiv
// request is made here. Requests already in the manifest are not repeated (recordings are never
// re-recorded). The request shapes match packages/db/src/services/paper-lists.ts: Find pages of
// FIND_PAGE_SIZE (25) and cited-by lists of PAPER_LIST_MAX (50), most cited first.
import type { OpenAlexWorkRecord } from "../../packages/db/src/scholarly/index";
import type { RecordGroup } from "./types";

const FIND_PAGE_SIZE = 25;
const PAPER_LIST_MAX = 50;
const SEARCH = "direct preference optimization";
/** W lookups already recorded by the foundation's recording (never repeated). */
const RECORDED_W = new Set(["W7133208539"]);

const find: RecordGroup = async (client, { check, checkNotFound }) => {
  // Find papers: words, two pages, and one set of filters (Computer Science, 2023 to 2024, free to read).
  const first = await check(
    "OpenAlex search page 1",
    () => client.openalexSearch({ search: SEARCH, page: 1, perPage: FIND_PAGE_SIZE }),
    (l) => `${l.items.length} of ${l.count ?? "?"}`,
  );
  await check(
    "OpenAlex search page 2",
    () => client.openalexSearch({ search: SEARCH, page: 2, perPage: FIND_PAGE_SIZE }),
    (l) => `${l.items.length} of ${l.count ?? "?"}`,
  );
  await check(
    "OpenAlex search with filters",
    () =>
      client.openalexSearch({
        search: SEARCH,
        filters: { fieldId: "17", publicationYear: { from: 2023, to: 2024 }, isOa: true },
        page: 1,
        perPage: FIND_PAGE_SIZE,
      }),
    (l) => `${l.items.length} of ${l.count ?? "?"}`,
  );
  // Save from a result row looks the work up by W: the first two rows of page 1.
  for (const item of (first?.items ?? []).filter((i) => !RECORDED_W.has(i.openalexId)).slice(0, 2)) {
    await check(
      `OpenAlex W ${item.openalexId} (result row)`,
      () => client.openalexWork({ scheme: "openalex", value: item.openalexId }),
      (w) => w.returnedId,
    );
  }

  // The paper page of a work: its record by W, then references, related works and cited by.
  const paperPage = async (label: string, record: OpenAlexWorkRecord, withRecord: boolean) => {
    if (withRecord)
      await check(
        `${label}: OpenAlex W ${record.openalexId}`,
        () => client.openalexWork({ scheme: "openalex", value: record.openalexId }),
        (w) => w.returnedId,
      );
    await check(
      `${label}: references`,
      () => client.openalexReferences(record),
      (b) => `${b.items.length} items, ${b.missing.length} missing`,
    );
    await check(
      `${label}: related`,
      () => client.openalexRelated(record),
      (b) => `${b.items.length} items, ${b.missing.length} missing`,
    );
    await check(
      `${label}: cited by`,
      () => client.openalexCitedBy(record.openalexId, { perPage: PAPER_LIST_MAX }),
      (l) => `${l.items.length} of ${l.count ?? "?"}`,
    );
  };

  // DPO (W7133208539): its record, references and related works are recorded already; cited by
  // in pages of 50 and Crossref for its NeurIPS DOI (the integrity check after saving) are not.
  await check(
    "DPO: cited by",
    () => client.openalexCitedBy("W7133208539", { perPage: PAPER_LIST_MAX }),
    (l) => `${l.items.length} of ${l.count ?? "?"}`,
  );
  await check(
    "Crossref 10.52202/075280-2338 (DPO's DOI)",
    () => client.crossrefWork("10.52202/075280-2338"),
    (w) => `${w.integrityNotices.length} notices`,
  );

  // The state of OA (DOI 10.7717/peerj.4375, a DOI-only paper): its page by W.
  const peerj = await check(
    "PeerJ: OpenAlex W W2741809807",
    () => client.openalexWork({ scheme: "openalex", value: "W2741809807" }),
    (w) => w.returnedId,
  );
  if (peerj) await paperPage("PeerJ", peerj.record, false);

  // A retracted paper (Crossref and Retraction Watch notices are recorded already): OpenAlex by DOI, then its page.
  const retracted = await check(
    "Retracted: OpenAlex DOI 10.1016/s0140-6736(97)11096-0",
    () => client.openalexWork({ scheme: "doi", value: "10.1016/s0140-6736(97)11096-0" }),
    (w) => w.returnedId,
  );
  if (retracted) await paperPage("Retracted", retracted.record, true);

  // Maldacena (arXiv hep-th/9711200, OpenAlex W2166248051): its page by W and Crossref for its DOI.
  const maldacena = await check(
    "Maldacena: OpenAlex W W2166248051",
    () => client.openalexWork({ scheme: "openalex", value: "W2166248051" }),
    (w) => w.returnedId,
  );
  if (maldacena) await paperPage("Maldacena", maldacena.record, false);
  await check(
    "Crossref 10.1023/a:1026654312961 (Maldacena's DOI)",
    () => client.crossrefWork("10.1023/a:1026654312961"),
    (w) => `${w.integrityNotices.length} notices`,
  );

  // arXiv ids by OpenAlex: a non-exclusive paper, a withdrawn one, and one that does not exist.
  const attention = await check(
    "OpenAlex arXiv 1706.03762",
    () => client.openalexWork({ scheme: "arxiv", value: "1706.03762" }),
    (w) => w.returnedId,
  );
  if (attention)
    await check(
      `Attention: OpenAlex W ${attention.record.openalexId}`,
      () => client.openalexWork({ scheme: "openalex", value: attention.record.openalexId }),
      (w) => w.returnedId,
    );
  try {
    const withdrawn = await client.openalexWork({ scheme: "arxiv", value: "2607.20049" });
    console.log(`PASS  OpenAlex arXiv 2607.20049: ${withdrawn.returnedId}`);
  } catch (error) {
    console.log(`PASS  OpenAlex arXiv 2607.20049: ${(error as { code?: string }).code ?? "error"} (recorded as answered)`);
  }
  await checkNotFound("OpenAlex arXiv 2611.99999 (no such id)", () => client.openalexWork({ scheme: "arxiv", value: "2611.99999" }));

  // A DOI neither provider knows (OpenAlex's 404 is recorded already): Crossref's answer.
  await checkNotFound("Crossref unregistered DOI", () => client.crossrefWork("10.7717/corniversity-no-such-work"));
};

export default find;
