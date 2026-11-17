import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  arxivAbstractUrl,
  arxivPdfUrl,
  checkPdfResponse,
  failureText,
  isArxivId,
  isPermanentFailure,
  loadPdfBytes,
  PdfLoadError,
  sha256Hex,
} from "./loader";

const pdfBytes = new TextEncoder().encode("%PDF-1.7\n%test fixture, not a real paper\n");
const ok = { ok: true, status: 200, contentType: "application/pdf" };

describe("arXiv URLs", () => {
  it("are built only from valid identifiers and versions", () => {
    expect(arxivPdfUrl("2305.18290", 3)).toBe("https://arxiv.org/pdf/2305.18290v3");
    expect(arxivPdfUrl("math/0309136", 1)).toBe("https://arxiv.org/pdf/math/0309136v1");
    expect(arxivPdfUrl("hep-th/9901001", 2)).toBe("https://arxiv.org/pdf/hep-th/9901001v2");
    expect(arxivAbstractUrl("2305.18290", 3)).toBe("https://arxiv.org/abs/2305.18290v3");
  });

  it("refuse anything that could change the host or path", () => {
    for (const id of [
      "2305.18290v3",
      "../2305.18290",
      "2305.18290/../x",
      "https://evil.example/2305.18290",
      "2305.182",
      "",
      "2305.18290?x=1",
      // Not core's normal form: the old-style subject class is dropped from stored ids.
      "math.GT/0309136",
      " 2305.18290",
      "arXiv:2305.18290",
    ]) {
      expect(isArxivId(id)).toBe(false);
      expect(() => arxivPdfUrl(id, 1)).toThrow();
    }
    for (const version of [0, -1, 1.5, Number.NaN, 1000]) expect(() => arxivPdfUrl("2305.18290", version)).toThrow();
  });
});

describe("response checks", () => {
  it("accepts a successful PDF response", () => {
    expect(checkPdfResponse(ok, pdfBytes)).toEqual({ ok: true });
    expect(checkPdfResponse({ ...ok, contentType: "Application/PDF; charset=binary" }, pdfBytes)).toEqual({ ok: true });
  });

  it("refuses a failed status before looking at the body", () => {
    expect(checkPdfResponse({ ok: false, status: 404, contentType: "application/pdf" }, pdfBytes)).toEqual({
      ok: false,
      reason: "status",
      status: 404,
    });
  });

  it("refuses a response that is not declared a PDF", () => {
    for (const contentType of ["text/html", "application/octet-stream", null, ""])
      expect(checkPdfResponse({ ...ok, contentType }, pdfBytes)).toEqual({ ok: false, reason: "content_type" });
  });

  it("refuses bytes without the PDF signature at the start", () => {
    for (const text of ["<html>", " %PDF-1.7", "%PDF", ""])
      expect(checkPdfResponse(ok, new TextEncoder().encode(text))).toEqual({ ok: false, reason: "signature" });
  });
});

describe("hashing", () => {
  it("is the SHA-256 of the received bytes", async () => {
    expect(await sha256Hex(pdfBytes)).toBe(createHash("sha256").update(pdfBytes).digest("hex"));
  });
});

describe("loading", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fetches a stored Document once, same-origin, without hashing", async () => {
    const fetchMock = vi.fn(async () => new Response(pdfBytes, { headers: { "content-type": "application/pdf" } }));
    vi.stubGlobal("fetch", fetchMock);
    const loaded = await loadPdfBytes({ kind: "stored", url: "/api/library/assets/x/file" }, new AbortController().signal);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/library/assets/x/file");
    expect(init.credentials).toBe("same-origin");
    expect(loaded.observedSha256).toBeNull();
    expect(Array.from(loaded.data)).toEqual(Array.from(pdfBytes));
  });

  it("fetches an arXiv version without cookies, referrer or redirects and reports its hash", async () => {
    const fetchMock = vi.fn(async () => new Response(pdfBytes, { headers: { "content-type": "application/pdf" } }));
    vi.stubGlobal("fetch", fetchMock);
    const loaded = await loadPdfBytes({ kind: "arxiv", id: "2305.18290", version: 3 }, new AbortController().signal);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://arxiv.org/pdf/2305.18290v3");
    expect(init).toMatchObject({ mode: "cors", credentials: "omit", redirect: "error", referrerPolicy: "no-referrer" });
    expect(loaded.observedSha256).toBe(createHash("sha256").update(pdfBytes).digest("hex"));
  });

  it("reports a refused response with its reason", async () => {
    vi.stubGlobal("fetch", async () => new Response("<html>blocked</html>", { status: 200, headers: { "content-type": "text/html" } }));
    const error = await loadPdfBytes({ kind: "arxiv", id: "2305.18290", version: 3 }, new AbortController().signal).catch((e) => e);
    expect(error).toBeInstanceOf(PdfLoadError);
    expect((error as PdfLoadError).reason).toBe("content_type");
  });

  it("reports a network failure as such and passes an abort through", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("Failed to fetch");
    });
    const failed = await loadPdfBytes({ kind: "arxiv", id: "2305.18290", version: 3 }, new AbortController().signal).catch((e) => e);
    expect((failed as PdfLoadError).reason).toBe("network");

    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal("fetch", async () => {
      throw new DOMException("aborted", "AbortError");
    });
    const aborted = await loadPdfBytes({ kind: "stored", url: "/x" }, controller.signal).catch((e) => e);
    expect(aborted).not.toBeInstanceOf(PdfLoadError);
    expect((aborted as Error).name).toBe("AbortError");
  });
});

describe("failureText", () => {
  const named = (name: string) => Object.assign(new Error("pdf.js"), { name });
  afterEach(() => vi.unstubAllGlobals());

  it("says an arXiv failure in arXiv's terms: unreachable, the status it answered, or not a PDF", () => {
    expect(failureText(new PdfLoadError("network", "arxiv", "The PDF could not be fetched."), true)).toBe(
      "Your browser could not fetch the PDF from arXiv (network or arXiv's access policy).",
    );
    expect(failureText(new PdfLoadError("status", "arxiv", "x", 403), true)).toBe(
      "arXiv answered with status 403, so the PDF could not be shown.",
    );
    expect(failureText(new PdfLoadError("status", "arxiv", "x"), true)).toBe(
      "arXiv answered with status unknown, so the PDF could not be shown.",
    );
    for (const reason of ["content_type", "signature"] as const) {
      expect(failureText(new PdfLoadError(reason, "arxiv", "x"), true)).toBe("arXiv's answer was not a PDF, so nothing was shown.");
    }
  });

  it("gives a stored file's failure with the loader's own message", async () => {
    vi.stubGlobal("fetch", async () => new Response("missing", { status: 404, headers: { "content-type": "text/plain" } }));
    const error = await loadPdfBytes({ kind: "stored", url: "/x" }, new AbortController().signal).catch((e) => e);
    expect(failureText(error, false)).toBe("The PDF could not be loaded. The server did not return the file (status 404).");
  });

  it("names the files PDF.js refuses, and says nothing it does not know about anything else", () => {
    expect(failureText(named("InvalidPDFException"), false)).toBe("The file could not be read as a PDF.");
    expect(failureText(named("PasswordException"), true)).toBe("This PDF is password-protected and cannot be shown here.");
    expect(failureText(new Error("boom"), false)).toBe("The PDF could not be shown.");
    expect(failureText("not an error", true)).toBe("The PDF could not be shown.");
  });

  it("treats only a file PDF.js refuses as permanent, so Try again is offered for everything else", () => {
    expect(isPermanentFailure(named("InvalidPDFException"))).toBe(true);
    expect(isPermanentFailure(named("PasswordException"))).toBe(true);
    expect(isPermanentFailure(new PdfLoadError("network", "arxiv", "x"))).toBe(false);
    expect(isPermanentFailure(new Error("boom"))).toBe(false);
    expect(isPermanentFailure("not an error")).toBe(false);
  });
});
