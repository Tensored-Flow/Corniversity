import { describe, expect, it } from "vitest";
import {
  accumulateZoom,
  BACK_STACK_LIMIT,
  type BackEntry,
  chooseView,
  clampPage,
  FIND_STATE,
  findStatus,
  firstParam,
  formatMegabytes,
  isLargeDocument,
  isPresetZoom,
  keyAction,
  LARGE_DOCUMENT_BYTES,
  laterVersions,
  pageViewAvailable,
  popBack,
  printedLabel,
  pushBack,
  requestedPage,
  safeOutlineUrl,
  textViewAvailable,
  wheelZoomFactor,
  zoomSelection,
} from "./rules";

const MB = 1_048_576;

describe("which view opens", () => {
  const base = { requested: undefined, pageAvailable: true, textAvailable: true, sizeBytes: 2 * MB, pageCount: 12 };

  it("opens a stored PDF in Page view by default", () => {
    expect(chooseView(base)).toBe("page");
    expect(chooseView({ ...base, textAvailable: false, pageCount: null })).toBe("page");
  });

  it("follows ?view when that view exists", () => {
    expect(chooseView({ ...base, requested: "text" })).toBe("text");
    expect(chooseView({ ...base, requested: "page" })).toBe("page");
    expect(chooseView({ ...base, requested: "page", pageAvailable: false })).toBe("text");
  });

  it("explains instead of showing pages when Text view is asked for but nothing is extracted", () => {
    expect(chooseView({ ...base, requested: "text", textAvailable: false })).toBe("unavailable");
    expect(chooseView({ ...base, pageAvailable: false, textAvailable: false })).toBe("unavailable");
  });

  it("opens large extracted Documents in Text view, unless the pages are asked for", () => {
    expect(chooseView({ ...base, sizeBytes: 41 * MB })).toBe("text");
    expect(chooseView({ ...base, pageCount: 401 })).toBe("text");
    expect(chooseView({ ...base, sizeBytes: 41 * MB, requested: "page" })).toBe("page");
    // Not extracted: nothing to show as text, so the pages open.
    expect(chooseView({ ...base, sizeBytes: 41 * MB, textAvailable: false })).toBe("page");
  });

  it("ignores unknown view values", () => {
    expect(chooseView({ ...base, requested: "outline" })).toBe("page");
  });

  it("uses 40 MB and 400 pages as the limits, both exclusive", () => {
    expect(isLargeDocument(LARGE_DOCUMENT_BYTES, 400)).toBe(false);
    expect(isLargeDocument(LARGE_DOCUMENT_BYTES + 1, 1)).toBe(true);
    expect(isLargeDocument(1, 401)).toBe(true);
    expect(isLargeDocument(1, null)).toBe(false);
  });
});

describe("view availability", () => {
  it("needs stored bytes of a validated PDF for Page view", () => {
    const pdf = { storageKey: "k", mediaType: "application/pdf" };
    expect(pageViewAvailable({ ...pdf, status: "validated" })).toBe(true);
    expect(pageViewAvailable({ ...pdf, status: "processing" })).toBe(true);
    expect(pageViewAvailable({ ...pdf, status: "processed" })).toBe(true);
    for (const status of ["quarantined", "registered_local", "upload_requested", "rejected", "deleted"])
      expect(pageViewAvailable({ ...pdf, status })).toBe(false);
    expect(pageViewAvailable({ ...pdf, storageKey: null, status: "processed" })).toBe(false);
    expect(pageViewAvailable({ storageKey: "k", mediaType: "application/epub+zip", status: "processed" })).toBe(false);
  });

  it("opens a paper read from arxiv.org in Page view: nothing is stored, the browser fetches arXiv's file", () => {
    const linked = { storageKey: null, mediaType: "application/pdf", status: "linked_remote" };
    expect(pageViewAvailable(linked)).toBe(true);
    expect(textViewAvailable({ status: "linked_remote", pageCount: 12 })).toBe(false);
    expect(chooseView({ requested: "text", pageAvailable: true, textAvailable: false, sizeBytes: 0, pageCount: 12 })).toBe("unavailable");
    expect(chooseView({ requested: undefined, pageAvailable: true, textAvailable: false, sizeBytes: 0, pageCount: null })).toBe("page");
  });

  it("needs processed text with pages for Text view", () => {
    expect(textViewAvailable({ status: "processed", pageCount: 3 })).toBe(true);
    expect(textViewAvailable({ status: "processed", pageCount: null })).toBe(false);
    expect(textViewAvailable({ status: "validated", pageCount: 3 })).toBe(false);
  });
});

describe("page parameters", () => {
  it("accepts 1-based whole numbers only", () => {
    expect(requestedPage("3")).toBe(3);
    expect(requestedPage(" 12 ")).toBe(12);
    for (const raw of [undefined, "", "0", "-2", "2.5", "1e3", "abc", "1234567"]) expect(requestedPage(raw)).toBeNull();
  });

  it("takes the first of a repeated parameter (Next passes ?page=1&page=2 as an array)", () => {
    expect(firstParam(["1", "2"])).toBe("1");
    expect(firstParam("3")).toBe("3");
    expect(firstParam(undefined)).toBeUndefined();
    expect(firstParam([])).toBeUndefined();
    expect(requestedPage(firstParam(["2", "5"]))).toBe(2);
  });

  it("clamps to the document", () => {
    expect(clampPage(0, 10)).toBe(1);
    expect(clampPage(11, 10)).toBe(10);
    expect(clampPage(4, 10)).toBe(4);
    expect(clampPage(Number.NaN, 10)).toBe(1);
    expect(clampPage(5, 0)).toBe(1);
  });

  it("shows a printed label only when it differs from the physical page", () => {
    expect(printedLabel(3, "1")).toBe("1");
    expect(printedLabel(2, "ii")).toBe("ii");
    expect(printedLabel(3, "3")).toBeNull();
    expect(printedLabel(3, null)).toBeNull();
    expect(printedLabel(3, "  ")).toBeNull();
  });

  it("states sizes in megabytes as the upload limit counts them", () => {
    expect(formatMegabytes(41 * MB)).toBe("41 MB");
    expect(formatMegabytes(4.26 * MB)).toBe("4.3 MB");
    expect(formatMegabytes(10)).toBe("0.1 MB");
  });
});

describe("zoom", () => {
  it("maps PDF.js scales to the select", () => {
    expect(zoomSelection(1.37, "page-width")).toEqual({ value: "page-width", label: "Fit width", custom: false });
    expect(zoomSelection(0.8, "page-fit")).toEqual({ value: "page-fit", label: "Fit page", custom: false });
    expect(zoomSelection(1.25, undefined)).toEqual({ value: "1.25", label: "125%", custom: false });
    expect(zoomSelection(2, "2")).toEqual({ value: "2", label: "200%", custom: false });
    expect(zoomSelection(1.37, undefined)).toEqual({ value: "custom:137", label: "137%", custom: true });
  });

  it("re-applies only named zooms on resize", () => {
    expect(isPresetZoom("page-width")).toBe(true);
    expect(isPresetZoom("page-fit")).toBe(true);
    expect(isPresetZoom("1.5")).toBe(false);
  });

  it("bounds one wheel step and zooms in for wheel up", () => {
    expect(wheelZoomFactor(-100, 0)).toBe(1.25);
    expect(wheelZoomFactor(100, 0)).toBe(0.8);
    expect(wheelZoomFactor(-3, 1)).toBe(1.25);
    const trackpad = wheelZoomFactor(-4, 0);
    expect(trackpad).toBeGreaterThan(1);
    expect(trackpad).toBeLessThan(1.05);
    expect(wheelZoomFactor(0, 0)).toBe(1);
  });

  it("accumulates small factors until the rounded scale changes", () => {
    let pending = 1;
    let applied: number | null = null;
    // Each 0.1% alone rounds back to 100%; together with the next step they reach 101%.
    for (let i = 0; i < 3 && applied === null; i++) {
      const step = accumulateZoom(1, pending, 1.001);
      pending = step.pending;
      applied = step.scaleFactor;
    }
    expect(applied).toBeNull();
    const step = accumulateZoom(1, pending, 1.01);
    expect(step.scaleFactor).toBeCloseTo(1.001 ** 3 * 1.01, 10);
    expect(step.pending).toBe(1);
  });
});

describe("keys while the pages have focus", () => {
  const none = { ctrl: false, alt: false, meta: false, shift: false };

  it("goes to the first and last page with Home and End", () => {
    expect(keyAction("Home", none, "page-width")).toBe("first");
    expect(keyAction("End", none, "1.5")).toBe("last");
  });

  it("turns pages with PageUp and PageDown only when a page fits", () => {
    expect(keyAction("PageDown", none, "page-fit")).toBe("next");
    expect(keyAction("PageUp", none, "page-fit")).toBe("previous");
    expect(keyAction("PageDown", none, "page-width")).toBeNull();
  });

  it("has no single-letter shortcuts and leaves modified keys alone", () => {
    for (const key of ["n", "p", "j", "k", "f", "+", "-", " "]) expect(keyAction(key, none, "page-fit")).toBeNull();
    expect(keyAction("Home", { ...none, ctrl: true }, "page-fit")).toBeNull();
    expect(keyAction("End", { ...none, shift: true }, "page-fit")).toBeNull();
  });
});

describe("the internal-link back stack", () => {
  const at = (pageNumber: number, top: number | null = 700): BackEntry => ({ pageNumber, left: 0, top });

  it("returns to where the reader was, most recent first", () => {
    let stack = pushBack([], at(1));
    stack = pushBack(stack, at(4));
    const first = popBack(stack);
    expect(first.entry).toEqual(at(4));
    expect(popBack(first.stack).entry).toEqual(at(1));
    expect(popBack([])).toEqual({ entry: null, stack: [] });
  });

  it("does not repeat the same place and keeps a bounded history", () => {
    expect(pushBack([at(2)], at(2))).toHaveLength(1);
    let stack: BackEntry[] = [];
    for (let i = 1; i <= BACK_STACK_LIMIT + 5; i++) stack = pushBack(stack, at(i));
    expect(stack).toHaveLength(BACK_STACK_LIMIT);
    expect(stack[0]!.pageNumber).toBe(6);
  });
});

describe("find status", () => {
  it("states counts plainly", () => {
    const base = { query: "loss", previous: false, current: 2, total: 7 };
    expect(findStatus({ ...base, state: FIND_STATE.FOUND })).toBe("2 of 7 matches");
    expect(findStatus({ ...base, state: FIND_STATE.FOUND, current: 1, total: 1 })).toBe("1 of 1 match");
    expect(findStatus({ ...base, state: FIND_STATE.NOT_FOUND, total: 0 })).toBe("No matches");
    expect(findStatus({ ...base, state: FIND_STATE.PENDING })).toBe("Searching…");
    expect(findStatus({ ...base, state: FIND_STATE.WRAPPED })).toBe("2 of 7 matches (continued from the start)");
    expect(findStatus({ ...base, state: FIND_STATE.WRAPPED, previous: true })).toBe("2 of 7 matches (continued from the end)");
    expect(findStatus({ ...base, query: " ", state: FIND_STATE.FOUND })).toBe("");
    expect(findStatus({ ...base, state: null })).toBe("");
  });
});

describe("outline links", () => {
  it("links only http and https", () => {
    expect(safeOutlineUrl("https://arxiv.org/abs/2305.18290")).toBe("https://arxiv.org/abs/2305.18290");
    expect(safeOutlineUrl("http://example.org/a")).toBe("http://example.org/a");
    for (const url of ["javascript:alert(1)", "data:text/html,x", "file:///c:/x", "mailto:a@b.c", "not a url", null, undefined])
      expect(safeOutlineUrl(url)).toBeNull();
  });
});

describe("later arXiv versions", () => {
  const versions = [
    { version: 1, label: "arXiv v1", withdrawn: false },
    { version: 2, label: "arXiv v2", withdrawn: false },
    { version: 3, label: "arXiv v3", withdrawn: false },
  ];

  it("links the newest later version and nothing from the newest", () => {
    expect(laterVersions(1, versions)).toEqual({ newest: versions[2], withdrawn: [] });
    expect(laterVersions(3, versions)).toEqual({ newest: null, withdrawn: [] });
  });

  it("names withdrawn later versions without linking them", () => {
    const withdrawnLast = [versions[0]!, { version: 2, label: "arXiv v2", withdrawn: true }];
    expect(laterVersions(1, withdrawnLast)).toEqual({ newest: null, withdrawn: [withdrawnLast[1]] });
    const withdrawnMiddle = [versions[0]!, { version: 2, label: "arXiv v2", withdrawn: true }, versions[2]!];
    expect(laterVersions(1, withdrawnMiddle)).toEqual({ newest: versions[2], withdrawn: [withdrawnMiddle[1]] });
  });
});
