import { describe, expect, it } from "vitest";
import { LINKED_DOCUMENT_GRANTS, NEVER_GRANTED_FROM_LICENCE, privateCopyBasis, privateCopyPermissions } from "./permissions";

const version = {
  arxivId: "2305.18290",
  arxivVersion: 3,
  licence: "http://creativecommons.org/licenses/by/4.0/",
  licenceSource: "arxiv-oai" as const,
  licenceRetrievedAt: new Date("2026-11-13T00:21:59Z"),
};

describe("scholarly permissions", () => {
  it("records local read, local extraction and private storage as allowed on the arXiv licence, and sharing as denied", () => {
    const result = privateCopyPermissions(version);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const basis = "licence reported by arXiv OAI-PMH on 2026-11-13 for v3: http://creativecommons.org/licenses/by/4.0/";
    expect(result.grants).toEqual([
      { action: "local_read", status: "allowed", basis },
      { action: "local_extract", status: "allowed", basis },
      { action: "private_cloud_store", status: "allowed", basis },
      { action: "share", status: "denied", basis: "Third-party material; sharing and export stay off by default." },
    ]);
  });

  it("never grants external AI or external embedding from a licence", () => {
    const result = privateCopyPermissions({ ...version, licence: "http://creativecommons.org/publicdomain/zero/1.0/" });
    expect(result.ok).toBe(true);
    if (result.ok) for (const action of NEVER_GRANTED_FROM_LICENCE) expect(result.grants.some((g) => g.action === action)).toBe(false);
    expect(NEVER_GRANTED_FROM_LICENCE).toContain("external_ai");
  });

  it("refuses with the storage reason when no private copy is possible", () => {
    expect(privateCopyPermissions({ ...version, licence: "http://arxiv.org/licenses/nonexclusive-distrib/1.0/" })).toMatchObject({
      ok: false,
    });
    expect(privateCopyPermissions({ ...version, licenceSource: "openalex", licence: "cc-by" })).toMatchObject({ ok: false });
  });

  it("records nothing when an arXiv version is linked", () => {
    expect(LINKED_DOCUMENT_GRANTS).toEqual([]);
    expect(privateCopyBasis("2026-11-15", 7, "x")).toBe("licence reported by arXiv OAI-PMH on 2026-11-15 for v7: x");
  });
});
