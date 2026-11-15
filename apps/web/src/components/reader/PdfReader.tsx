"use client";
import "pdfjs-dist/legacy/web/pdf_viewer.css";
import "./reader.css";
import Link from "next/link";
import type { PDFDocumentLoadingTask } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { EventBus, PDFLinkService, PDFViewer } from "pdfjs-dist/legacy/web/pdf_viewer.mjs";
import { type FormEvent, type KeyboardEvent, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { documentOptions, loadPdfjs, pdfjsAssets } from "./engine";
import { loadPdfBytes, PdfLoadError, type PdfSource } from "./loader";
import {
  accumulateZoom,
  type BackEntry,
  clampPage,
  DEFAULT_ZOOM,
  findStatus,
  isPresetZoom,
  keyAction,
  popBack,
  printedLabel,
  pushBack,
  requestedPage,
  safeOutlineUrl,
  wheelZoomFactor,
  ZOOM_CHOICES,
  zoomSelection,
} from "./rules";

export interface ReaderHeading {
  physicalIndex: number;
  printedLabel: string | null;
  heading: string;
}

export interface PdfReaderProps {
  assetId: string;
  title: string;
  source: PdfSource;
  /** 1-based physical page to open at (from ?page=N or the remembered position). */
  initialPage: number;
  /** Headings detected in the extracted text: the contents when the PDF has no outline. */
  headings: ReaderHeading[];
  backHref: string;
  /** Text view of this Document without a page parameter, when its text is extracted. */
  textHref: string | null;
  /** Remembers the page (0-based) once the reader has moved; omitted, nothing is saved. */
  saveProgress?: (assetId: string, physicalIndex: number) => Promise<void>;
}

interface OutlineNode {
  title: string;
  dest: string | unknown[] | null;
  url: string | null;
  items: OutlineNode[];
}

interface RawOutline {
  title: string;
  dest: string | unknown[] | null;
  url: string | null;
  items: RawOutline[];
}

type Section = "contents" | "find";
type LoadState = { state: "loading" } | { state: "ready" } | { state: "error"; message: string };

const PANEL_KEY = "corniversity-reader-panel";
const PHONE = "(max-width: 640px)";
const SAVE_DELAY_MS = 1200;

function readPanelHidden(): boolean {
  try {
    return window.localStorage.getItem(PANEL_KEY) === "hidden";
  } catch {
    return false;
  }
}

function writePanelHidden(hidden: boolean): void {
  try {
    window.localStorage.setItem(PANEL_KEY, hidden ? "hidden" : "shown");
  } catch {
    // Storage may be unavailable (private window, blocked site data); the choice lasts this visit.
  }
}

function toOutline(items: RawOutline[]): OutlineNode[] {
  return items.map((item) => ({
    title: item.title || "Untitled",
    dest: item.dest ?? null,
    url: safeOutlineUrl(item.url),
    items: toOutline(item.items ?? []),
  }));
}

function failureText(error: unknown): string {
  if (error instanceof PdfLoadError) return `The PDF could not be loaded. ${error.message}`;
  const name = error instanceof Error ? error.name : "";
  if (name === "InvalidPDFException") return "The file could not be read as a PDF.";
  if (name === "PasswordException") return "This PDF is password-protected and cannot be shown here.";
  return "The PDF could not be shown.";
}

const control =
  "inline-flex items-center justify-center gap-1 rounded-[var(--radius-control)] border border-stone-2 bg-paper-2 px-2 py-0.5 text-sm text-ink hover:bg-paper-3 disabled:cursor-not-allowed disabled:opacity-50 sm:px-2.5 sm:py-1";

/**
 * The Page view: the official PDF.js viewer (rendering only visible pages, text and link layers,
 * find) driven imperatively. React renders the container and its div.pdfViewer and nothing
 * inside them; everything below is created and torn down in one effect, safely twice under
 * StrictMode. Links open in a new tab without referrer; internal links and contents entries push a
 * local back stack (PDF.js's history would rewrite the browser history under the router).
 */
export default function PdfReader(props: PdfReaderProps) {
  const { assetId, title, source, initialPage, headings, backHref, textHref } = props;
  const rootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const findInputRef = useRef<HTMLInputElement>(null);
  const engineRef = useRef<{ viewer: PDFViewer; eventBus: EventBus; link: PDFLinkService } | null>(null);
  const locationRef = useRef<BackEntry | null>(null);
  const latest = useRef(props);
  const lastFindRef = useRef("");

  const [attempt, setAttempt] = useState(0);
  const [load, setLoad] = useState<LoadState>({ state: "loading" });
  const [pagesCount, setPagesCount] = useState(0);
  const [page, setPage] = useState<{ number: number; label: string | null }>({ number: 1, label: null });
  const [pageInput, setPageInput] = useState("1");
  const [zoom, setZoom] = useState(() => zoomSelection(1, DEFAULT_ZOOM));
  const [outline, setOutline] = useState<OutlineNode[] | null>(null);
  const [findQuery, setFindQuery] = useState("");
  const [find, setFind] = useState<{ state: number | null; current: number; total: number; previous: boolean }>({
    state: null,
    current: 0,
    total: 0,
    previous: false,
  });
  const [section, setSection] = useState<Section>("contents");
  const [panelHidden, setPanelHidden] = useState(readPanelHidden);
  const [phone, setPhone] = useState(() => window.matchMedia(PHONE).matches);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [backStack, setBackStack] = useState<BackEntry[]>([]);
  const [fullscreen, setFullscreen] = useState(false);
  const fullscreenEnabled = typeof document.documentElement.requestFullscreen === "function" && document.fullscreenEnabled;

  useEffect(() => {
    latest.current = props;
  });

  const recordJump = useCallback(() => {
    const viewer = engineRef.current?.viewer;
    if (!viewer) return;
    const here = locationRef.current ?? { pageNumber: viewer.currentPageNumber, left: null, top: null };
    setBackStack((stack) => pushBack(stack, here));
  }, []);

  const sourceKey = source.kind === "stored" ? source.url : `arxiv:${source.id}v${source.version}`;

  // biome-ignore lint/correctness/useExhaustiveDependencies: the document is reloaded only for a new source or a retry; `source` and `initialPage` are read when it loads
  useEffect(() => {
    const container = containerRef.current;
    const viewerElement = viewerRef.current;
    if (!container || !viewerElement) return;
    const controller = new AbortController();
    const { signal } = controller;
    let disposed = false;
    let task: PDFDocumentLoadingTask | null = null;
    let viewer: PDFViewer | null = null;
    let link: PDFLinkService | null = null;
    let touch: { destroy(): void } | null = null;
    let resize: ResizeObserver | null = null;
    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    let pendingSave: number | null = null;
    let savesAllowed = false;
    let pendingZoom = 1;
    setLoad({ state: "loading" });
    setOutline(null);
    setBackStack([]);
    locationRef.current = null;

    const flushSave = () => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = null;
      const { saveProgress } = latest.current;
      if (pendingSave === null || !saveProgress || document.visibilityState !== "visible") return;
      const index = pendingSave;
      pendingSave = null;
      void saveProgress(assetId, index).catch(() => undefined);
    };

    const zoomBy = (factor: number, origin: [number, number]) => {
      if (!viewer) return;
      const step = accumulateZoom(viewer.currentScale, pendingZoom, factor);
      pendingZoom = step.pending;
      if (step.scaleFactor !== null) viewer.updateScale({ scaleFactor: step.scaleFactor, origin, drawingDelay: 400 });
    };

    (async () => {
      const lib = await loadPdfjs();
      if (disposed) return;
      const loaded = await loadPdfBytes(source, signal);
      if (disposed) return;
      const assets = pdfjsAssets(lib.pdfjs.version, window.location.origin);
      lib.pdfjs.GlobalWorkerOptions.workerSrc = assets.workerSrc;

      const eventBus = new lib.viewer.EventBus();
      class TrackingLinkService extends lib.viewer.PDFLinkService {
        override async goToDestination(dest: string | unknown[]): Promise<void> {
          recordJump();
          return super.goToDestination(dest);
        }
        override goToPage(value: number | string): void {
          recordJump();
          super.goToPage(value);
        }
      }
      const linkService = new TrackingLinkService({
        eventBus,
        externalLinkTarget: lib.viewer.LinkTarget.BLANK,
        externalLinkRel: "noopener noreferrer nofollow",
        ignoreDestinationZoom: true,
      });
      link = linkService;
      const findController = new lib.viewer.PDFFindController({ eventBus, linkService });
      const pdfViewer = new lib.viewer.PDFViewer({
        container,
        viewer: viewerElement,
        eventBus,
        linkService,
        findController,
        // Links only: no form widgets, no annotation storage, no editors, no scripting manager.
        annotationMode: lib.pdfjs.AnnotationMode.ENABLE,
        annotationEditorMode: lib.pdfjs.AnnotationEditorType.DISABLE,
        abortSignal: signal,
      } as ConstructorParameters<typeof lib.viewer.PDFViewer>[0]);
      viewer = pdfViewer;
      linkService.setViewer(pdfViewer);
      engineRef.current = { viewer: pdfViewer, eventBus, link: linkService };

      const on = (name: string, listener: (event: never) => void) => eventBus.on(name, listener as (event: unknown) => void, { signal });
      on("pagesinit", () => {
        pdfViewer.currentScaleValue = DEFAULT_ZOOM;
        const start = clampPage(latest.current.initialPage, pdfViewer.pagesCount);
        if (start !== pdfViewer.currentPageNumber) pdfViewer.currentPageNumber = start;
        // Arriving (including through ?page=N) is not a move; only the reader's own moves are saved.
        savesAllowed = true;
      });
      on("pagechanging", (event: { pageNumber: number; pageLabel?: string | null }) => {
        setPage({ number: event.pageNumber, label: event.pageLabel ?? null });
        setPageInput(String(event.pageNumber));
        if (!savesAllowed) return;
        pendingSave = event.pageNumber - 1;
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(flushSave, SAVE_DELAY_MS);
      });
      on("scalechanging", (event: { scale: number; presetValue?: string }) => setZoom(zoomSelection(event.scale, event.presetValue)));
      on("updateviewarea", (event: { location?: { pageNumber: number; left: number; top: number } }) => {
        if (event.location)
          locationRef.current = { pageNumber: event.location.pageNumber, left: event.location.left, top: event.location.top };
      });
      on("updatefindmatchescount", (event: { matchesCount: { current: number; total: number } }) =>
        setFind((state) => ({ ...state, current: event.matchesCount.current, total: event.matchesCount.total })),
      );
      on("updatefindcontrolstate", (event: { state: number; previous?: boolean; matchesCount?: { current: number; total: number } }) =>
        setFind({
          state: event.state,
          previous: Boolean(event.previous),
          current: event.matchesCount?.current ?? 0,
          total: event.matchesCount?.total ?? 0,
        }),
      );

      container.addEventListener(
        "wheel",
        (event) => {
          if (!event.ctrlKey) return;
          event.preventDefault();
          zoomBy(wheelZoomFactor(event.deltaY, event.deltaMode), [event.clientX, event.clientY]);
        },
        { passive: false, signal },
      );
      touch = new lib.pdfjs.TouchManager({
        container,
        signal,
        onPinching: (origin: [number, number], previousDistance: number, distance: number) => zoomBy(distance / previousDistance, origin),
        onPinchEnd: () => {
          pendingZoom = 1;
        },
        onPanning: (dx: number, dy: number) => pdfViewer.panBy(dx, dy),
      });
      resize = new ResizeObserver(() => {
        // Leaving the reader detaches the container before the effect is cleaned up; the observer
        // then reports a zero size, and nothing may scroll a detached viewer.
        if (!container.isConnected || container.clientWidth === 0) return;
        const named = pdfViewer.currentScaleValue;
        // A named zoom is computed once; recompute it for the new container size.
        if (pdfViewer.pdfDocument && isPresetZoom(named)) pdfViewer.currentScaleValue = named;
      });
      resize.observe(container);
      // A hidden tab does not save; a move made just before hiding is saved when the tab returns.
      document.addEventListener(
        "visibilitychange",
        () => {
          if (document.visibilityState === "visible" && pendingSave !== null && !saveTimer)
            saveTimer = setTimeout(flushSave, SAVE_DELAY_MS);
        },
        { signal },
      );

      task = lib.pdfjs.getDocument(documentOptions(loaded.data, assets));
      const pdfDocument = await task.promise;
      if (disposed) return;
      pdfViewer.setDocument(pdfDocument);
      linkService.setDocument(pdfDocument, null);
      setPagesCount(pdfDocument.numPages);
      const [labels, tree] = await Promise.all([pdfDocument.getPageLabels().catch(() => null), pdfDocument.getOutline().catch(() => null)]);
      if (disposed) return;
      if (labels) {
        pdfViewer.setPageLabels(labels);
        setPage({ number: pdfViewer.currentPageNumber, label: pdfViewer.currentPageLabel });
      }
      setOutline(tree ? toOutline(tree as RawOutline[]) : []);
      setLoad({ state: "ready" });
    })().catch((error: unknown) => {
      if (disposed) return;
      setLoad({ state: "error", message: failureText(error) });
    });

    return () => {
      disposed = true;
      flushSave();
      controller.abort();
      touch?.destroy();
      resize?.disconnect();
      engineRef.current = null;
      viewer?.setDocument(null);
      link?.setDocument(null);
      // Destroys the document and terminates its worker.
      void task?.destroy();
    };
  }, [sourceKey, attempt, assetId, recordJump]);

  // A new ?page=N on the same Document moves the open viewer instead of reloading it.
  useEffect(() => {
    const viewer = engineRef.current?.viewer;
    if (viewer?.pagesCount) viewer.currentPageNumber = clampPage(initialPage, viewer.pagesCount);
  }, [initialPage]);

  useEffect(() => {
    const media = window.matchMedia(PHONE);
    const onChange = () => {
      setPhone(media.matches);
      if (!media.matches) dialogRef.current?.close();
    };
    media.addEventListener("change", onChange);
    const onFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      media.removeEventListener("change", onChange);
      document.removeEventListener("fullscreenchange", onFullscreen);
    };
  }, []);

  const panelShown = phone ? dialogOpen : !panelHidden;
  useEffect(() => {
    if (panelShown && section === "find") findInputRef.current?.focus();
  }, [panelShown, section]);

  function openSection(next: Section) {
    setSection(next);
    if (phone) {
      if (!dialogRef.current?.open) dialogRef.current?.showModal();
      setDialogOpen(true);
    } else if (panelHidden) {
      setPanelHidden(false);
      writePanelHidden(false);
    }
  }

  function togglePanel() {
    const hidden = !panelHidden;
    setPanelHidden(hidden);
    writePanelHidden(hidden);
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  function goToPage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const viewer = engineRef.current?.viewer;
    if (!viewer?.pagesCount) return;
    const typed = pageInput.trim();
    const number = requestedPage(typed) ?? viewer.pageLabelToPageNumber(typed);
    if (number) viewer.currentPageNumber = clampPage(number, viewer.pagesCount);
    else setPageInput(String(viewer.currentPageNumber));
  }

  function changeZoom(value: string) {
    const viewer = engineRef.current?.viewer;
    if (!viewer || value.startsWith("custom:")) return;
    viewer.currentScaleValue = value;
  }

  function runFind(findPrevious: boolean) {
    const engine = engineRef.current;
    const query = findQuery.trim();
    if (!engine || !query) return;
    const again = query === lastFindRef.current;
    lastFindRef.current = query;
    engine.eventBus.dispatch("find", {
      source: null,
      type: again ? "again" : "",
      query,
      caseSensitive: false,
      entireWord: false,
      highlightAll: true,
      findPrevious,
      matchDiacritics: false,
    });
  }

  function jumpToHeading(physicalIndex: number) {
    const viewer = engineRef.current?.viewer;
    if (!viewer?.pagesCount) return;
    recordJump();
    viewer.currentPageNumber = clampPage(physicalIndex + 1, viewer.pagesCount);
    if (phone) closeDialog();
  }

  function followOutline(node: OutlineNode) {
    const engine = engineRef.current;
    if (!engine || !node.dest) return;
    void engine.link.goToDestination(node.dest as string);
    if (phone) closeDialog();
  }

  function goBack() {
    const viewer = engineRef.current?.viewer;
    const { entry, stack } = popBack(backStack);
    setBackStack(stack);
    if (!viewer || !entry) return;
    viewer.scrollPageIntoView({
      pageNumber: clampPage(entry.pageNumber, viewer.pagesCount),
      destArray: entry.left !== null && entry.top !== null ? [null, { name: "XYZ" }, entry.left, entry.top, null] : undefined,
      allowNegativeOffset: true,
      ignoreDestinationZoom: true,
    });
  }

  function onPagesKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const viewer = engineRef.current?.viewer;
    if (!viewer?.pagesCount) return;
    const action = keyAction(event.key, { ctrl: event.ctrlKey, alt: event.altKey, meta: event.metaKey, shift: event.shiftKey }, zoom.value);
    if (!action) return;
    event.preventDefault();
    if (action === "first") viewer.currentPageNumber = 1;
    else if (action === "last") viewer.currentPageNumber = viewer.pagesCount;
    else if (action === "next") viewer.nextPage();
    else viewer.previousPage();
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void rootRef.current?.requestFullscreen().catch(() => undefined);
  }

  const ready = load.state === "ready";
  const label = printedLabel(page.number, page.label);
  const status = findStatus({ query: findQuery, ...find });
  const back = backStack.at(-1);

  const contents: ReactNode =
    outline === null ? (
      <p className="text-sm text-ink-3">Reading the contents…</p>
    ) : outline.length > 0 ? (
      <OutlineList nodes={outline} onFollow={followOutline} />
    ) : headings.length > 0 ? (
      <>
        <p className="mb-2 text-xs text-ink-3">This PDF has no outline. Headings detected in the extracted text:</p>
        <ul className="flex flex-col text-sm">
          {headings.map((entry, i) => (
            <li key={`${entry.physicalIndex}-${i}`}>
              <button
                type="button"
                onClick={() => jumpToHeading(entry.physicalIndex)}
                className="block w-full truncate rounded-sm py-0.5 text-left text-ink-2 hover:text-ink"
              >
                <span className="text-ink-3">{entry.printedLabel ?? entry.physicalIndex + 1}</span> {entry.heading}
              </button>
            </li>
          ))}
        </ul>
      </>
    ) : (
      <p className="text-sm text-ink-3">This PDF has no outline and no headings were detected; use Go to page or Find.</p>
    );

  const findPanel = (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        runFind(false);
      }}
      className="flex flex-col gap-2"
    >
      <label htmlFor="reader-find" className="text-sm text-ink-2">
        Find in this PDF
      </label>
      <input
        id="reader-find"
        ref={findInputRef}
        type="search"
        value={findQuery}
        onChange={(event) => setFindQuery(event.target.value)}
        className="w-full rounded-[var(--radius-control)] border border-stone-2 bg-paper px-3 py-1.5 text-sm text-ink"
        disabled={!ready}
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" className={control} onClick={() => runFind(true)} disabled={!ready || !findQuery.trim()}>
          Previous match
        </button>
        <button type="submit" className={control} disabled={!ready || !findQuery.trim()}>
          Next match
        </button>
      </div>
      <p className="min-h-5 text-sm text-ink-2" role="status">
        {status}
      </p>
    </form>
  );

  const panelBody = section === "contents" ? contents : findPanel;
  const sectionTitle = section === "contents" ? "Contents" : "Find";

  return (
    <div ref={rootRef} className="flex min-h-0 flex-1 flex-col bg-paper">
      <a href="#reader-pages" className="skip-link">
        Skip to the pages
      </a>
      <header className="border-b border-stone bg-paper-2 px-3 py-2 sm:px-4">
        <div className="flex items-center gap-2">
          <Link href={backHref} className={control}>
            Back
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-base text-ink sm:text-lg" title={title}>
            {title}
          </h1>
          {textHref ? (
            <Link href={`${textHref}&page=${page.number}`} className={control}>
              Text view
            </Link>
          ) : null}
          {fullscreenEnabled ? (
            <button type="button" className={control} onClick={toggleFullscreen}>
              {fullscreen ? "Exit full screen" : "Full screen"}
            </button>
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <button
            type="button"
            className={control}
            aria-label="Previous page"
            onClick={() => engineRef.current?.viewer.previousPage()}
            disabled={!ready || page.number <= 1}
          >
            Previous
          </button>
          <form onSubmit={goToPage} className="flex items-center gap-1.5 text-sm text-ink-2">
            <label htmlFor="reader-page" className="max-[641px]:sr-only">
              Page
            </label>
            <input
              id="reader-page"
              inputMode="numeric"
              autoComplete="off"
              value={pageInput}
              onChange={(event) => setPageInput(event.target.value)}
              className="w-14 rounded-[var(--radius-control)] border border-stone-2 bg-paper px-2 py-1 text-sm text-ink"
              disabled={!ready}
            />
            <span>of {pagesCount || "…"}</span>
            {label ? <span className="text-ink-3">printed p. {label}</span> : null}
          </form>
          <button
            type="button"
            className={control}
            aria-label="Next page"
            onClick={() => engineRef.current?.viewer.nextPage()}
            disabled={!ready || page.number >= pagesCount}
          >
            Next
          </button>
          <label htmlFor="reader-zoom" className="sr-only">
            Zoom
          </label>
          <select
            id="reader-zoom"
            value={zoom.value}
            onChange={(event) => changeZoom(event.target.value)}
            className="rounded-[var(--radius-control)] border border-stone-2 bg-paper-2 px-2 py-1 text-sm text-ink"
            disabled={!ready}
          >
            {ZOOM_CHOICES.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
            {zoom.custom ? <option value={zoom.value}>{zoom.label}</option> : null}
          </select>
          <button
            type="button"
            className={control}
            onClick={() => openSection("contents")}
            aria-pressed={phone ? undefined : panelShown && section === "contents"}
            aria-haspopup={phone ? "dialog" : undefined}
          >
            Contents
          </button>
          <button
            type="button"
            className={control}
            onClick={() => openSection("find")}
            aria-pressed={phone ? undefined : panelShown && section === "find"}
            aria-haspopup={phone ? "dialog" : undefined}
          >
            Find
          </button>
          {phone ? null : (
            <button type="button" className={control} onClick={togglePanel}>
              {panelHidden ? "Show panel" : "Hide panel"}
            </button>
          )}
          {back ? (
            <button type="button" className={control} onClick={goBack}>
              Back to page {back.pageNumber}
            </button>
          ) : null}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1 bg-paper-3">
          {/* biome-ignore lint/a11y/useSemanticElements: PDF.js requires its container to be a div */}
          <div
            ref={containerRef}
            id="reader-pages"
            role="region"
            aria-label={`Pages of ${title}`}
            // biome-ignore lint/a11y/noNoninteractiveTabindex: the scrolling pages must take focus so keyboard users can scroll and page through them
            tabIndex={0}
            onKeyDown={onPagesKeyDown}
            className="reader-pages absolute inset-0 overflow-auto"
          >
            <div ref={viewerRef} className="pdfViewer" />
          </div>
          {load.state === "ready" ? null : (
            <div className="absolute inset-0 grid place-items-center p-6">
              {load.state === "loading" ? (
                <p role="status" className="text-sm text-ink-2">
                  Loading the PDF…
                </p>
              ) : (
                <div
                  role="alert"
                  className="max-w-md rounded-[var(--radius-panel)] border border-rust/30 bg-rust-soft px-4 py-3 text-sm text-rust"
                >
                  <p>{load.message}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" className={control} onClick={() => setAttempt((n) => n + 1)}>
                      Try again
                    </button>
                    {textHref ? (
                      <Link href={`${textHref}&page=${page.number}`} className={control}>
                        Text view
                      </Link>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        {!phone && !panelHidden ? (
          <aside aria-labelledby="reader-panel-title" className="w-[300px] shrink-0 overflow-y-auto border-l border-stone bg-paper-2 p-4">
            <h2 id="reader-panel-title" className="mb-3 text-base text-ink">
              {sectionTitle}
            </h2>
            {panelBody}
          </aside>
        ) : null}
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby="reader-dialog-title"
        onClose={() => setDialogOpen(false)}
        className="mx-0 mt-auto mb-0 w-full max-w-none overflow-hidden rounded-t-[var(--radius-panel)] border border-stone bg-paper-2 p-0 text-ink backdrop:bg-ink/30"
      >
        {/* The heading and Close stay in view while a long contents list scrolls. */}
        <div className="flex max-h-[75dvh] flex-col">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-stone px-4 py-3">
            <h2 id="reader-dialog-title" className="text-base text-ink">
              {sectionTitle}
            </h2>
            <button type="button" className={control} onClick={closeDialog}>
              Close
            </button>
          </div>
          <div className="min-h-0 overflow-y-auto px-4 py-3">{phone ? panelBody : null}</div>
        </div>
      </dialog>
    </div>
  );
}

function OutlineList({ nodes, onFollow }: { nodes: OutlineNode[]; onFollow: (node: OutlineNode) => void }) {
  return (
    <ul className="flex flex-col text-sm">
      {nodes.map((node, i) => (
        <li key={`${node.title}-${i}`}>
          {node.dest ? (
            <button
              type="button"
              onClick={() => onFollow(node)}
              className="block w-full rounded-sm py-0.5 text-left text-ink-2 hover:text-ink"
            >
              {node.title}
            </button>
          ) : node.url ? (
            <a
              href={node.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="block py-0.5 text-brass underline underline-offset-4"
            >
              {node.title}
            </a>
          ) : (
            <span className="block py-0.5 text-ink-3">{node.title}</span>
          )}
          {node.items.length ? (
            <div className="border-l border-stone pl-3">
              <OutlineList nodes={node.items} onFollow={onFollow} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
