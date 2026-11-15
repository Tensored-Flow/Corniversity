import { describe, expect, it } from "vitest";
import { type DocumentInfoInput, documentInfo, identifierHref } from "./document-info";

const ASSET = {
  id: "00000000-0000-4000-8000-000000000001",
  sha256: "arxiv:2305.18290v1",
  status: "linked_remote",
  pageCount: 12,
  filename: "2305.18290v1.pdf",
};

function input(overrides: Partial<DocumentInfoInput> = {}): DocumentInfoInput {
  return {
    asset: ASSET,
    work: {
      id: "00000000-0000-4000-8000-0000000000aa",
      title: "Direct Preference Optimization",
      authors: [{ name: "Rafael Rafailov" }, { name: "Archit Sharma" }],
      publicationYear: 2023,
      venue: null,
      provenance: {
        title: { source: "fixture", retrievedAt: "2026-11-15T09:00:00.000Z" },
        authors: { source: "fixture", retrievedAt: "2026-11-15T09:00:01.000Z" },
      },
    },
    identifiers: [
      { scheme: "arxiv", value: "2305.18290", source: "fixture", status: "current" },
      { scheme: "doi", value: "10.48550/arxiv.2305.18290", source: "fixture", status: "current" },
      { scheme: "openalex", value: "W4378770815", source: "fixture", status: "superseded" },
    ],
    version: {
      label: "arXiv v1",
      versionDate: new Date("2023-05-29T17:57:46Z"),
      withdrawn: false,
      licence: null,
      licenceSource: null,
      licenceRetrievedAt: null,
      source: "fixture",
    },
    arxiv: { id: "2305.18290", version: 1 },
    arxivVersions: [
      { version: 1, label: "arXiv v1", withdrawn: false },
      { version: 2, label: "arXiv v2", withdrawn: false },
      { version: 3, label: "arXiv v3", withdrawn: false },
    ],
    ...overrides,
  };
}

describe("identifier links", () => {
  it("are built only from values in the normal form the core parsers give", () => {
    expect(identifierHref("doi", "10.7717/peerj.4375")).toBe("https://doi.org/10.7717/peerj.4375");
    expect(identifierHref("doi", "10.1016/s0140-6736(97)11096-0")).toBe("https://doi.org/10.1016/s0140-6736(97)11096-0");
    expect(identifierHref("arxiv", "hep-th/9711200")).toBe("https://arxiv.org/abs/hep-th/9711200");
    expect(identifierHref("openalex", "W2741809807")).toBe("https://openalex.org/W2741809807");
    expect(identifierHref("pmid", "29456894")).toBe("https://pubmed.ncbi.nlm.nih.gov/29456894/");
    expect(identifierHref("pmcid", "PMC5815332")).toBe("https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5815332/");
  });

  it("are not built from anything else", () => {
    for (const [scheme, value] of [
      ["doi", "https://evil.example/10.1/x"],
      ["doi", "10.1/x"],
      ["doi", "10.7717/PEERJ.4375"],
      ["arxiv", "javascript:alert(1)"],
      ["arxiv", "2305.18290v3"],
      ["openalex", "W1/../../x"],
      ["pmid", "123abc"],
      ["pmcid", "5815332"],
      ["isbn", "9780000000000"],
    ])
      expect(identifierHref(scheme!, value!), `${scheme}:${value}`).toBeNull();
  });

  it("encodes characters a DOI may carry so they stay in the path", () => {
    expect(identifierHref("doi", "10.1000/a#b?c")).toBe("https://doi.org/10.1000/a%23b%3Fc");
  });
});

describe("the reader's document info", () => {
  it("names the exact version, links the newest later one and the arXiv pages built from the validated id", () => {
    const info = documentInfo(input());
    expect(info.linked).toBe(true);
    expect(info.documentKey).toBe("arxiv:2305.18290v1");
    expect(info.version).toMatchObject({
      label: "arXiv v1",
      date: "2023-05-29",
      withdrawn: false,
      newest: { version: 3, label: "arXiv v3" },
      withdrawnLater: [],
      arxiv: {
        display: "2305.18290v1",
        absUrl: "https://arxiv.org/abs/2305.18290v1",
        pdfUrl: "https://arxiv.org/pdf/2305.18290v1",
      },
    });
  });

  it("labels fixture data as such, lists current identifiers only and links the paper page", () => {
    const paper = documentInfo(input()).paper!;
    expect(paper.fixture).toBe(true);
    expect(paper.sources).toEqual([{ name: "recorded fixtures", day: "2026-11-15" }]);
    expect(paper.identifiers.map((i) => i.label)).toEqual(["arXiv", "DOI"]);
    expect(paper.href).toBe("/library/papers/00000000-0000-4000-8000-0000000000aa");
  });

  it("names a live provider and its retrieval day, and a licence with who reported it", () => {
    const info = documentInfo(
      input({
        work: { ...input().work!, provenance: { title: { source: "openalex", retrievedAt: "2026-11-14T08:00:00.000Z" } } },
        identifiers: [{ scheme: "arxiv", value: "2305.18290", source: "arxiv", status: "current" }],
        version: {
          ...input().version!,
          label: "arXiv v3",
          licence: "http://creativecommons.org/licenses/by/4.0/",
          licenceSource: "arxiv-oai",
          licenceRetrievedAt: new Date("2026-11-15T00:00:00Z"),
        },
        arxiv: { id: "2305.18290", version: 3 },
      }),
    );
    expect(info.paper!.fixture).toBe(false);
    expect(info.paper!.sources).toEqual([{ name: "OpenAlex", day: "2026-11-14" }]);
    expect(info.version!.licence).toEqual({ name: "CC BY 4.0", attribution: "as reported by arXiv OAI-PMH on 2026-11-15" });
    expect(info.version!.newest).toBeNull();
  });

  it("says a later version was withdrawn instead of linking it", () => {
    const info = documentInfo(
      input({
        arxiv: { id: "2607.20049", version: 1 },
        arxivVersions: [
          { version: 1, label: "arXiv v1", withdrawn: false },
          { version: 2, label: "arXiv v2", withdrawn: true },
        ],
      }),
    );
    expect(info.version!.newest).toBeNull();
    expect(info.version!.withdrawnLater).toEqual([{ version: 2, label: "arXiv v2" }]);
  });

  it("a Document of no paper falls back to its item", () => {
    const info = documentInfo(
      input({
        asset: { ...ASSET, sha256: "c".repeat(64), status: "processed" },
        work: null,
        version: null,
        arxiv: null,
        identifiers: [],
        arxivVersions: [],
      }),
    );
    expect(info).toMatchObject({
      linked: false,
      paper: null,
      version: null,
      item: { filename: "2305.18290v1.pdf", href: `/library/items/${ASSET.id}` },
    });
  });
});
