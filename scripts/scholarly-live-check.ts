// Opt-in live check of the research library's scholarly providers: five real requests through the
// live client (OpenAlex search, OpenAlex DOI lookup, arXiv export API, arXiv OAI-PMH arXivRaw,
// Crossref DOI), printing pass or fail for each. Its output is a live check; the unit and contract
// tests use recorded fixtures and are not.
//
//   pnpm library:live-check            five live requests
//   pnpm library:live-check --record   re-record packages/db/src/scholarly/fixtures (about 26 requests)
//
// arXiv calls are spaced 3.5 s apart (arXiv allows one request every three seconds). No email
// address is sent unless the owner set CROSSREF_MAILTO; OPENALEX_API_KEY, when set, is sent only as
// an Authorization header. Neither is ever printed.
import { join, resolve } from "node:path";
import { loadRootEnv } from "../packages/db/src/env";
import {
  createScholarlyClient,
  LiveTransport,
  type OpenAlexWorkRecord,
  redact,
  type ScholarlyClient,
  ScholarlyProviderError,
} from "../packages/db/src/scholarly/index";
import { RecordingTransport } from "../packages/db/src/scholarly/recording";

loadRootEnv();
const setting = (name: string) => {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
};
const settings = { OPENALEX_API_KEY: setting("OPENALEX_API_KEY"), CROSSREF_MAILTO: setting("CROSSREF_MAILTO") };
if (settings.CROSSREF_MAILTO && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.CROSSREF_MAILTO)) {
  console.error("CROSSREF_MAILTO is set but is not an email address; fix it or leave it unset.");
  process.exit(1);
}
const secrets = [settings.OPENALEX_API_KEY, settings.CROSSREF_MAILTO];
const record = process.argv.includes("--record");
const ARXIV_GAP_MS = 3500;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const live = new LiveTransport({ openalexApiKey: settings.OPENALEX_API_KEY ?? null, crossrefMailto: settings.CROSSREF_MAILTO ?? null });
const fixturesDir = resolve(import.meta.dirname, "..", "packages", "db", "src", "scholarly", "fixtures");
const recorder = record ? new RecordingTransport(live, fixturesDir) : null;
const client: ScholarlyClient = createScholarlyClient(recorder ?? live);

console.log(`Scholarly live check, ${new Date().toISOString()}`);
console.log(`OpenAlex key: ${settings.OPENALEX_API_KEY ? "configured" : "not configured (shared keyless allowance)"}`);
console.log(`Crossref pool: ${settings.CROSSREF_MAILTO ? "polite (CROSSREF_MAILTO set)" : "public (no email sent)"}`);
if (record) console.log(`Recording into ${join("packages", "db", "src", "scholarly", "fixtures")}`);

let failures = 0;
async function check<T>(label: string, run: () => Promise<T>, summarise: (value: T) => string): Promise<T | null> {
  try {
    const value = await run();
    console.log(`PASS  ${label}: ${summarise(value)}`);
    return value;
  } catch (error) {
    failures++;
    const reason =
      error instanceof ScholarlyProviderError ? `${error.code}: ${error.message}` : error instanceof Error ? error.message : String(error);
    console.log(`FAIL  ${label}: ${redact(reason, secrets)}`);
    return null;
  }
}

async function checkNotFound(label: string, run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
    failures++;
    console.log(`FAIL  ${label}: expected not found, got a record`);
  } catch (error) {
    if (error instanceof ScholarlyProviderError && error.code === "not_found") console.log(`PASS  ${label}: not found, as expected`);
    else {
      failures++;
      console.log(`FAIL  ${label}: ${redact(error instanceof Error ? error.message : String(error), secrets)}`);
    }
  }
}

const quoted = (text: string | null) => (text ? `"${text.length > 70 ? `${text.slice(0, 69)}…` : text}"` : "(no title)");

if (!record) {
  await check(
    "OpenAlex search (words + field filter 17)",
    () => client.openalexSearch({ search: "direct preference optimization", filters: { fieldId: "17" }, perPage: 5 }, { cache: "refresh" }),
    (l) =>
      `${l.items.length} of ${l.count ?? "?"} results; first ${quoted(l.items[0]?.title ?? null)}; retrieved ${l.provenance.retrievedAt}`,
  );
  await check(
    "OpenAlex work by DOI 10.7717/peerj.4375",
    () => client.openalexWork({ scheme: "doi", value: "10.7717/peerj.4375" }, { cache: "refresh" }),
    (w) =>
      `${w.returnedId} ${quoted(w.record.title)}; ${w.record.identifiers.length} identifiers; retrieved ${w.record.provenance.retrievedAt}`,
  );
  await check(
    "arXiv export API id_list 2305.18290",
    () => client.arxivEntries([{ id: "2305.18290", version: null }], { cache: "refresh" }),
    (r) =>
      `${r.entries.map((e) => `${e.id}v${e.version}`).join(", ")} ${quoted(r.entries[0]?.title ?? null)}; retrieved ${r.provenance.retrievedAt}`,
  );
  await sleep(ARXIV_GAP_MS);
  await check(
    "arXiv OAI-PMH arXivRaw 2305.18290",
    () => client.arxivRaw("2305.18290", { cache: "refresh" }),
    (r) => {
      const last = r.versions[r.versions.length - 1];
      return `${r.versions.length} versions; licence ${last?.licence ?? "none"} attached to v${last?.version ?? "?"}; OAI responseDate ${r.responseDate}; retrieved ${r.provenance.retrievedAt}`;
    },
  );
  await check(
    "Crossref work 10.1016/s0140-6736(97)11096-0",
    () => client.crossrefWork("10.1016/s0140-6736(97)11096-0", { cache: "refresh" }),
    (w) =>
      `${quoted(w.title)}; ${w.integrityNotices.length} integrity notices (${w.integrityNotices.map((n) => `${n.type} via ${n.source}`).join(", ")}); retrieved ${w.provenance.retrievedAt}`,
  );
} else {
  // OpenAlex: one filtered search page, single works (DOI, W, arXiv new and old style, a missing DOI),
  // a cited-by page, the reference and related batches of one work, the taxonomy, one subject list.
  await check(
    "OpenAlex search",
    () => client.openalexSearch({ search: "direct preference optimization", filters: { fieldId: "17" }, perPage: 5 }),
    (l) => `${l.items.length} items`,
  );
  await check(
    "OpenAlex DOI",
    () => client.openalexWork({ scheme: "doi", value: "10.7717/peerj.4375" }),
    (w) => w.returnedId,
  );
  const dpo = await check(
    "OpenAlex W",
    () => client.openalexWork({ scheme: "openalex", value: "W7133208539" }),
    (w) => w.returnedId,
  );
  await check(
    "OpenAlex arXiv",
    () => client.openalexWork({ scheme: "arxiv", value: "2305.18290" }),
    (w) => w.returnedId,
  );
  await check(
    "OpenAlex arXiv old style",
    () => client.openalexWork({ scheme: "arxiv", value: "hep-th/9711200" }),
    (w) => w.returnedId,
  );
  await checkNotFound("OpenAlex missing DOI", () => client.openalexWork({ scheme: "doi", value: "10.7717/corniversity-no-such-work" }));
  await check(
    "OpenAlex cited by",
    () => client.openalexCitedBy("W7133208539", { perPage: 5 }),
    (l) => `${l.items.length} of ${l.count}`,
  );
  const work: OpenAlexWorkRecord | undefined = dpo?.record;
  if (work) {
    await check(
      "OpenAlex references batch",
      () => client.openalexReferences(work),
      (b) => `${b.items.length} items, ${b.missing.length} missing`,
    );
    await check(
      "OpenAlex related batch",
      () => client.openalexRelated(work),
      (b) => `${b.items.length} items, ${b.missing.length} missing`,
    );
  }
  const fields = await check(
    "OpenAlex fields",
    () => client.openalexFields(),
    (f) => `${f.length} fields`,
  );
  const primary = (fields ?? [])
    .filter((f) => ["Mathematics", "Physics and Astronomy", "Computer Science"].includes(f.name))
    .map((f) => f.id);
  if (primary.length > 0)
    await check(
      "OpenAlex subfields",
      () => client.openalexSubfields(primary),
      (s) => `${s.length} subfields`,
    );
  const mathematics = (fields ?? []).find((f) => f.name === "Mathematics");
  if (mathematics)
    await check(
      "OpenAlex most cited in Mathematics",
      () =>
        client.openalexSearch(
          { filters: { fieldId: mathematics.id }, sort: "cited_by_count:desc", perPage: 5 },
          { cacheKind: "subject_list" },
        ),
      (l) => `${l.items.length} items`,
    );

  // arXiv: export API for a CC BY paper, a non-exclusive one, an old-style id and a withdrawn one;
  // OAI-PMH arXivRaw for the same and for an id that does not exist; one category listing.
  const arxivCalls: [string, () => Promise<unknown>][] = [
    ["arXiv entry 2305.18290", () => client.arxivEntries([{ id: "2305.18290", version: null }])],
    ["arXiv entry 1706.03762", () => client.arxivEntries([{ id: "1706.03762", version: null }])],
    ["arXiv entry hep-th/9711200", () => client.arxivEntries([{ id: "hep-th/9711200", version: null }])],
    ["arXiv entry 2607.20049", () => client.arxivEntries([{ id: "2607.20049", version: null }])],
    ["arXivRaw 2305.18290", () => client.arxivRaw("2305.18290")],
    ["arXivRaw 1706.03762", () => client.arxivRaw("1706.03762")],
    ["arXivRaw hep-th/9711200", () => client.arxivRaw("hep-th/9711200")],
    ["arXivRaw 2607.20049", () => client.arxivRaw("2607.20049")],
    ["arXiv newest math.*", () => client.arxivNewest(["math.*"], 5)],
  ];
  for (const [index, [label, run]] of arxivCalls.entries()) {
    if (index > 0) await sleep(ARXIV_GAP_MS);
    await check(label, run, () => "recorded");
  }
  await sleep(ARXIV_GAP_MS);
  await checkNotFound("arXivRaw 2611.99999 (no such id)", () => client.arxivRaw("2611.99999"));

  // Crossref: a DOI with Retraction Watch notices, an ordinary DOI, an arXiv (DataCite) DOI it lacks.
  await check(
    "Crossref retraction",
    () => client.crossrefWork("10.1016/s0140-6736(97)11096-0"),
    (w) => `${w.integrityNotices.length} notices`,
  );
  await check(
    "Crossref ordinary",
    () => client.crossrefWork("10.7717/peerj.4375"),
    (w) => quoted(w.title),
  );
  await checkNotFound("Crossref DataCite DOI", () => client.crossrefWork("10.48550/arxiv.2305.18290"));

  recorder?.writeManifest(
    `Responses recorded from the live providers by \`pnpm library:live-check --record\` (${new Date().toISOString().slice(0, 10)}). ` +
      "Recorded provider data, not verified by opening; used only by the fixture provider and contract tests.",
  );
  console.log(`Recorded ${recorder?.recorded.length ?? 0} responses.`);
}

console.log(failures === 0 ? "All checks passed." : `${failures} check(s) failed.`);
process.exitCode = failures === 0 ? 0 : 1;
