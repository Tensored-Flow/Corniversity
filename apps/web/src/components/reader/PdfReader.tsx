"use client";
import "pdfjs-dist/legacy/web/pdf_viewer.css";
import "./reader.css";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { PDFDocumentLoadingTask } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { EventBus, PDFLinkService, PDFPageView, PDFViewer } from "pdfjs-dist/legacy/web/pdf_viewer.mjs";
import { type FormEvent, type KeyboardEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ANNOTATION_COLORS,
  type AnchorInput,
  type AnnotationColor,
  areaRect,
  COLOR_LABELS,
  DEFAULT_HIGHLIGHT_COLOR,
  type FileFacts,
  inReadingOrder,
  keptOnNewFile,
  type PendingAnchor,
  pageViewOf,
  placeAnnotations,
  type ReaderAnnotation,
  upsertAnnotation,
} from "./annotations";
import { createAnnotationRequest, deleteAnnotationRequest } from "./api";
import { documentOptions, loadPdfjs, pdfjsAssets } from "./engine";
import type { ReaderDocumentInfo } from "./info";
import { loadPdfBytes, PdfLoadError, type PdfSource } from "./loader";
import { NotesPanel } from "./NotesPanel";
import { PaperPanel } from "./PaperPanel";
import { drawPageAnnotations, type PageViewLike, pageAnchor, pointOnPage, readSelection } from "./page-dom";
import {
  countsAsMove,
  LAST_SENT_KEY,
  lastSentEntry,
  lastSentPosition,
  openingTarget,
  PositionSender,
  positionFromLocation,
  SAVE_DELAY_MS,
  type SavedPosition,
} from "./position";
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

/** A selection the owner made in the pages, as extension points receive it. */
export interface ReaderSelection {
  pageIndex: number;
  quote: string | null;
  anchor: AnchorInput;
}

/**
 * Extension point: an action a later stage adds to the selection bar, after Highlight and Note
 * (the reading companion's Ask). Nothing is shown when none is given.
 */
export interface ReaderSelectionAction {
  id: string;
  label: string;
  run: (selection: ReaderSelection) => void;
  /** A panel (by id) to open after `run`; the selection is then cleared, as Note does. */
  opens?: string;
}

/** Extension point: a panel a later stage adds beside Contents, Find, Notes and Paper (the companion's Ask panel). */
export interface ReaderPanel {
  id: string;
  label: string;
  render: (context: {
    selection: ReaderSelection | null;
    pageIndex: number;
    /** The SHA-256 of the bytes the reader loaded (arXiv's file for a linked Document), once known. */
    loadedSha256: string | null;
  }) => ReactNode;
}

/** The reading room's server actions (each requires the session and acts on the owner's own Document). */
export interface ReaderActions {
  markOpened: (assetId: string) => Promise<void>;
  reportObservedHash: (
    assetId: string,
    observed: { sha256: string; pageCount: number },
  ) => Promise<{ status: "first" | "same" | "changed" } | { error: string }>;
  keepNotesOnNewFile: (
    assetId: string,
    file: { observedSha256: string; pageCount: number; pageViews: [number, number][] },
  ) => Promise<{ accepted: boolean; problems: string[] } | { error: string }>;
  /** The form action that opens another arXiv version of the paper (fields `assetId`, `version`). */
  openArxivVersion: (form: FormData) => Promise<void>;
}

export interface PdfReaderProps {
  assetId: string;
  title: string;
  source: PdfSource;
  /** 1-based physical page to open at (from ?page=N or the remembered position). */
  initialPage: number;
  /** Whether ?page=N chose that page (then nothing remembered, on the server or in this tab, moves it). */
  pageRequested: boolean;
  /** Where the reader was inside that page last time; null when ?page=N chose the page or nothing is remembered. */
  initialPosition: SavedPosition | null;
  /** Headings detected in the extracted text: the contents when the PDF has no outline. */
  headings: ReaderHeading[];
  backHref: string;
  /** "Back to paper" for a paper's file, "Back" to the item otherwise. */
  backLabel: string;
  /** Text view of this Document without a page parameter, when its text is extracted. */
  textHref: string | null;
  info: ReaderDocumentInfo;
  annotations: ReaderAnnotation[];
  /** A registered notice from the URL (?error=code), already turned into its text; shown while the URL carries it. */
  notice: string | null;
  actions: ReaderActions;
  selectionActions?: ReaderSelectionAction[];
  panels?: ReaderPanel[];
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

type Section = "contents" | "find" | "notes" | "paper" | (string & {});
type LoadState = { state: "loading" } | { state: "ready" } | { state: "error"; message: string; arxiv: boolean };

const PANEL_KEY = "corniversity-reader-panel";
/** Phones, and short landscape screens: panels open in a dialog and the bar is compact. */
const COMPACT = "(max-width: 640px), (max-height: 500px)";
const ARXIV_UNREACHABLE = "Your browser could not fetch the PDF from arXiv (network or arXiv's access policy).";

/** The position this tab last sent for this Document, when recent (position.ts); used once. */
function takeLastSent(assetId: string): SavedPosition | null {
  try {
    const position = lastSentPosition(window.sessionStorage.getItem(LAST_SENT_KEY), assetId, Date.now());
    if (position) window.sessionStorage.removeItem(LAST_SENT_KEY);
    return position;
  } catch {
    return null;
  }
}

function keepLastSent(assetId: string, position: SavedPosition): void {
  try {
    window.sessionStorage.setItem(LAST_SENT_KEY, lastSentEntry(assetId, position, Date.now()));
  } catch {
    // Storage may be unavailable; the reader then opens at the position the server returns.
  }
}

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

function failureText(error: unknown, arxiv: boolean): string {
  if (error instanceof PdfLoadError) {
    if (!arxiv) return `The PDF could not be loaded. ${error.message}`;
    if (error.reason === "network") return ARXIV_UNREACHABLE;
    if (error.reason === "status") return `arXiv answered with status ${error.status ?? "unknown"}, so the PDF could not be shown.`;
    return "arXiv's answer was not a PDF, so nothing was shown.";
  }
  const name = error instanceof Error ? error.name : "";
  if (name === "InvalidPDFException") return "The file could not be read as a PDF.";
  if (name === "PasswordException") return "This PDF is password-protected and cannot be shown here.";
  return "The PDF could not be shown.";
}

const control =
  "inline-flex items-center justify-center gap-1 rounded-[var(--radius-control)] border border-stone-2 bg-paper-2 px-2 py-0.5 text-sm text-ink hover:bg-paper-3 disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 sm:px-2.5 sm:py-1";

/**
 * The Page view: the official PDF.js viewer (rendering only visible pages, text and link layers,
 * find) driven imperatively. React renders the container and its div.pdfViewer and nothing inside
 * them; the viewer is created and torn down in one effect, safely twice under StrictMode. Links open
 * in a new tab without referrer; internal links and contents entries push a local back stack.
 *
 * Annotations are drawn into a layer of each page, re-attached whenever PDF.js renders the page or
 * its text layer. Which ones are drawn follows the drift rule (annotations.ts). The reading position
 * is saved only after the owner's own moves (position.ts), never on arrival.
 */
export default function PdfReader(props: PdfReaderProps) {
  const { assetId, title, source, initialPage, headings, backHref, backLabel, textHref, info } = props;
  const rootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const asideRef = useRef<HTMLElement>(null);
  const panelTitleRef = useRef<HTMLHeadingElement>(null);
  const dialogTitleRef = useRef<HTMLHeadingElement>(null);
  const panelsButtonRef = useRef<HTMLButtonElement>(null);
  const findInputRef = useRef<HTMLInputElement>(null);
  const selectionBarRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<{ viewer: PDFViewer; eventBus: EventBus; link: PDFLinkService } | null>(null);
  const locationRef = useRef<BackEntry | null>(null);
  const latest = useRef(props);
  const lastFindRef = useRef("");
  const loadedShaRef = useRef<string | null>(null);
  /** Marks the owner's own input, so the next change of view counts as a move (set by the load effect). */
  const intentRef = useRef<() => void>(() => undefined);

  const [attempt, setAttempt] = useState(0);
  const [load, setLoad] = useState<LoadState>({ state: "loading" });
  const [pagesCount, setPagesCount] = useState(0);
  const [page, setPage] = useState<{ number: number; label: string | null }>({ number: 1, label: null });
  const [pageInput, setPageInput] = useState("1");
  const [labels, setLabels] = useState<string[] | null>(null);
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
  /** Counts the owner's requests to open a panel, so focus can move into it (see the effect after `openSection`). */
  const [panelFocus, setPanelFocus] = useState(0);
  const [panelHidden, setPanelHidden] = useState(readPanelHidden);
  const [compact, setCompact] = useState(() => window.matchMedia(COMPACT).matches);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [backStack, setBackStack] = useState<BackEntry[]>([]);
  const [fullscreen, setFullscreen] = useState(false);
  const fullscreenEnabled = typeof document.documentElement.requestFullscreen === "function" && document.fullscreenEnabled;

  const [annotations, setAnnotations] = useState<ReaderAnnotation[]>(props.annotations);
  const [facts, setFacts] = useState<FileFacts | null>(null);
  const [selection, setSelection] = useState<PendingAnchor | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [composer, setComposer] = useState<PendingAnchor | null>(null);
  const [color, setColor] = useState<AnnotationColor>(DEFAULT_HIGHLIGHT_COLOR);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [marking, setMarking] = useState<{ first: { pageNumber: number; point: [number, number] } | null } | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [keep, setKeep] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });
  /** Why the server did not keep the notes on the new file, after the owner asked. */
  const [keepRefusal, setKeepRefusal] = useState<string[] | null>(null);
  /** A highlight or bookmark request is in flight: a second click must not create a duplicate. */
  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);
  // The notice stays while the URL carries ?error; Dismiss takes it out of the URL, so the same refusal
  // arriving again through a redirect (the newer-version form) is shown again.
  const searchParams = useSearchParams();
  const notice = searchParams.has("error") ? props.notice : null;

  useEffect(() => {
    latest.current = props;
  });

  const placement = useMemo(
    () =>
      placeAnnotations(
        annotations,
        facts ?? {
          documentKey: info.documentKey,
          linked: info.linked,
          loadedSha256: null,
          observed: "pending",
          pageCount: 0,
          pageViews: [],
          previousPageCount: info.pageCount,
        },
      ),
    [annotations, facts, info.documentKey, info.linked, info.pageCount],
  );
  // Ribbons follow the drift rule: only bookmarks that stand on this file.
  const bookmarks = useMemo(() => new Set(placement.bookmarks.map((a) => a.pageIndex)), [placement]);
  const drawnRef = useRef(placement.drawn);
  const bookmarksRef = useRef(bookmarks);
  const focusedRef = useRef(focused);
  drawnRef.current = placement.drawn;
  bookmarksRef.current = bookmarks;
  focusedRef.current = focused;

  const pageViewFor = useCallback((pageNumber: number): PageViewLike | null => {
    const viewer = engineRef.current?.viewer;
    if (!viewer || pageNumber < 1 || pageNumber > viewer.pagesCount) return null;
    return (viewer.getPageView(pageNumber - 1) as unknown as PageViewLike | undefined) ?? null;
  }, []);

  const drawPage = useCallback(
    (pageNumber: number) => {
      const pageView = pageViewFor(pageNumber);
      if (!pageView) return;
      const index = pageNumber - 1;
      drawPageAnnotations(
        pageView,
        drawnRef.current.filter((a) => a.pageIndex === index),
        { bookmarked: bookmarksRef.current.has(index), focusedId: focusedRef.current },
      );
    },
    [pageViewFor],
  );

  const recordJump = useCallback(() => {
    const viewer = engineRef.current?.viewer;
    if (!viewer) return;
    const here = locationRef.current ?? { pageNumber: viewer.currentPageNumber, left: null, top: null };
    setBackStack((stack) => pushBack(stack, here));
  }, []);

  const sourceKey = source.kind === "stored" ? source.url : `arxiv:${source.id}v${source.version}`;

  // biome-ignore lint/correctness/useExhaustiveDependencies: the document is reloaded only for a new source or a retry; `source`, the opening place and the actions are read when it loads
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
    let pendingZoom = 1;
    let lastIntent: number | null = null;
    const arxiv = source.kind === "arxiv";
    setLoad({ state: "loading" });
    setOutline(null);
    setBackStack([]);
    setFacts(null);
    locationRef.current = null;
    loadedShaRef.current = null;

    const sender = new PositionSender({
      assetId,
      tab: crypto.randomUUID(),
      now: () => performance.now(),
      post: (body, keepalive) =>
        fetch("/api/library/position", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body,
          keepalive,
        }),
      sent: (position) => keepLastSent(assetId, position),
    });
    const markIntent = () => {
      lastIntent = performance.now();
    };
    intentRef.current = markIntent;
    const scheduleSave = () => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        saveTimer = null;
        // A hidden tab does not save; what it had was sent with keepalive as it was hidden.
        if (document.visibilityState === "visible") sender.flush();
      }, SAVE_DELAY_MS);
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
      loadedShaRef.current = loaded.observedSha256;
      const assets = pdfjsAssets(lib.pdfjs.version, window.location.origin);
      lib.pdfjs.GlobalWorkerOptions.workerSrc = assets.workerSrc;

      const eventBus = new lib.viewer.EventBus();
      class TrackingLinkService extends lib.viewer.PDFLinkService {
        override async goToDestination(dest: string | unknown[]): Promise<void> {
          recordJump();
          markIntent();
          await super.goToDestination(dest);
          // PDF.js moves keyboard focus to the destination page's text when that page next reports its text
          // rendered. A page already rendered reports nothing until a zoom or width change redraws it, and
          // focus would then jump into the pages from wherever the owner is. Report it now: focus moves at
          // once, as it does for a page that renders after the jump, and nothing is left waiting.
          const view: PDFPageView | undefined = this.pdfViewer?.getPageView(this.pdfViewer.currentPageNumber - 1);
          if (view?.renderingState === lib.viewer.RenderingStates.FINISHED && view.textLayer)
            this.eventBus.dispatch("textlayerrendered", { source: view, pageNumber: view.id, error: null });
        }
        override goToPage(value: number | string): void {
          recordJump();
          markIntent();
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
        // What this tab sent just before a reload may not have reached the server when the page was rendered.
        const sentHere = latest.current.pageRequested ? null : takeLastSent(assetId);
        const start = clampPage(sentHere ? sentHere.pageIndex + 1 : latest.current.initialPage, pdfViewer.pagesCount);
        // Arriving (through ?page=N or the remembered place) is not a move: nothing here is saved.
        const target = openingTarget(start, sentHere ?? latest.current.initialPosition);
        if (target.destArray)
          pdfViewer.scrollPageIntoView({
            pageNumber: start,
            destArray: target.destArray,
            allowNegativeOffset: true,
            ignoreDestinationZoom: true,
          });
        else if (start !== pdfViewer.currentPageNumber) pdfViewer.currentPageNumber = start;
      });
      on("pagesloaded", (event: { pagesCount: number }) => {
        const pageViews: [number, number][] = [];
        for (let i = 0; i < event.pagesCount; i++) {
          const view = (pdfViewer.getPageView(i) as unknown as PageViewLike | undefined)?.pdfPage?.view;
          pageViews.push(view ? pageViewOf(view) : [0, 0]);
        }
        const base: FileFacts = {
          documentKey: latest.current.info.documentKey,
          linked: arxiv,
          loadedSha256: loaded.observedSha256,
          observed: arxiv ? "pending" : "same",
          pageCount: event.pagesCount,
          pageViews,
          previousPageCount: latest.current.info.pageCount,
        };
        setFacts(base);
        if (!arxiv || !loaded.observedSha256) return;
        // The browser reports what it received from arxiv.org; the server says whether it is the file it knew.
        latest.current.actions
          .reportObservedHash(assetId, { sha256: loaded.observedSha256, pageCount: event.pagesCount })
          .then((result) => {
            if (!disposed) setFacts({ ...base, observed: "status" in result ? result.status : "unknown" });
          })
          .catch(() => {
            if (!disposed) setFacts({ ...base, observed: "unknown" });
          });
      });
      on("pagerendered", (event: { pageNumber: number }) => drawPage(event.pageNumber));
      on("textlayerrendered", (event: { pageNumber: number }) => drawPage(event.pageNumber));
      on("pagechanging", (event: { pageNumber: number; pageLabel?: string | null }) => {
        setPage({ number: event.pageNumber, label: event.pageLabel ?? null });
        setPageInput(String(event.pageNumber));
      });
      on("scalechanging", (event: { scale: number; presetValue?: string }) => setZoom(zoomSelection(event.scale, event.presetValue)));
      on("updateviewarea", (event: { location?: { pageNumber: number; left: number; top: number } }) => {
        if (!event.location) return;
        locationRef.current = { pageNumber: event.location.pageNumber, left: event.location.left, top: event.location.top };
        const now = performance.now();
        if (!countsAsMove(lastIntent, now)) return;
        // A scroll that keeps going (momentum, a held key) stays the owner's move.
        lastIntent = now;
        sender.moved(positionFromLocation(event.location, pdfViewer.currentScale));
        scheduleSave();
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

      for (const name of ["wheel", "keydown", "pointerdown", "touchstart"] as const)
        container.addEventListener(name, markIntent, { passive: true, signal });
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
      // The position is sent with keepalive as the tab is hidden or the page goes away.
      document.addEventListener(
        "visibilitychange",
        () => {
          if (document.visibilityState === "hidden") sender.flush(true);
          else if (sender.hasPending()) scheduleSave();
        },
        { signal },
      );
      window.addEventListener("pagehide", () => sender.flush(true), { signal });

      task = lib.pdfjs.getDocument(documentOptions(loaded.data, assets));
      const pdfDocument = await task.promise;
      if (disposed) return;
      pdfViewer.setDocument(pdfDocument);
      linkService.setDocument(pdfDocument, null);
      setPagesCount(pdfDocument.numPages);
      const [pageLabels, tree] = await Promise.all([
        pdfDocument.getPageLabels().catch(() => null),
        pdfDocument.getOutline().catch(() => null),
      ]);
      if (disposed) return;
      if (pageLabels) {
        pdfViewer.setPageLabels(pageLabels);
        setLabels(pageLabels);
        setPage({ number: pdfViewer.currentPageNumber, label: pdfViewer.currentPageLabel });
      }
      setOutline(tree ? toOutline(tree as RawOutline[]) : []);
      setLoad({ state: "ready" });
    })().catch((error: unknown) => {
      if (disposed) return;
      setLoad({ state: "error", message: failureText(error, arxiv), arxiv });
    });

    return () => {
      disposed = true;
      if (saveTimer) clearTimeout(saveTimer);
      sender.flush(true);
      intentRef.current = () => undefined;
      controller.abort();
      touch?.destroy();
      resize?.disconnect();
      engineRef.current = null;
      viewer?.setDocument(null);
      link?.setDocument(null);
      // Destroys the document and terminates its worker.
      void task?.destroy();
    };
  }, [sourceKey, attempt, assetId, recordJump, drawPage]);

  // Opening the reader is recorded for *Continue reading*; it never moves the saved position.
  useEffect(() => {
    void latest.current.actions.markOpened(assetId).catch(() => undefined);
  }, [assetId]);

  // A new ?page=N on the same Document moves the open viewer; arriving there is not a move, so it is not saved.
  useEffect(() => {
    const viewer = engineRef.current?.viewer;
    if (viewer?.pagesCount) viewer.currentPageNumber = clampPage(initialPage, viewer.pagesCount);
  }, [initialPage]);

  // Annotations, bookmarks or the focused note changed: redraw every page's layer.
  // biome-ignore lint/correctness/useExhaustiveDependencies: placement, bookmarks and focus are read through refs by drawPage
  useEffect(() => {
    const viewer = engineRef.current?.viewer;
    if (!viewer?.pagesCount) return;
    for (let n = 1; n <= viewer.pagesCount; n++) drawPage(n);
  }, [placement, bookmarks, focused, drawPage, load.state]);

  useEffect(() => {
    const media = window.matchMedia(COMPACT);
    const onChange = () => {
      setCompact(media.matches);
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

  // A text selection in the pages offers Highlight, Note (and any added action) and Clear.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const read = () => {
      const next = readSelection(container, pageViewFor);
      // Using the selection bar (its colour list) must not drop the selection it acts on.
      if (!next && selectionBarRef.current?.contains(document.activeElement)) return;
      setSelection(next);
      setSelectionError(null);
    };
    const onChange = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(read, 120);
    };
    document.addEventListener("selectionchange", onChange);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("selectionchange", onChange);
    };
  }, [pageViewFor]);

  // Mark area: two clicks on one page, with Cancel (and Esc). Links and text selection pause meanwhile.
  const markingRef = useRef(marking);
  markingRef.current = marking;
  // biome-ignore lint/correctness/useExhaustiveDependencies: openSection reads the current state when it runs
  useEffect(() => {
    const container = containerRef.current;
    if (!marking || !container) return;
    const onClick = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const hit = pointOnPage(event.target, event.clientX, event.clientY, pageViewFor);
      const current = markingRef.current;
      if (!hit || !current) return;
      if (!current.first || current.first.pageNumber !== hit.pageNumber) {
        setMarking({ first: { pageNumber: hit.pageNumber, point: hit.point } });
        return;
      }
      const rect = areaRect(current.first.point, hit.point);
      const anchor = pageAnchor(hit.pageView);
      if (!rect || !anchor) return;
      setMarking(null);
      setComposer({ pageIndex: hit.pageNumber - 1, anchor: { ...anchor, rects: [rect] }, quote: null, source: "area" });
      openSection("notes");
    };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setMarking(null);
    };
    container.addEventListener("click", onClick, { capture: true });
    document.addEventListener("keydown", onKey);
    return () => {
      container.removeEventListener("click", onClick, { capture: true });
      document.removeEventListener("keydown", onKey);
    };
  }, [marking, pageViewFor]);

  const panelShown = compact ? dialogOpen : !panelHidden;
  useEffect(() => {
    if (panelShown && section === "find") findInputRef.current?.focus();
  }, [panelShown, section]);
  // A panel the owner opened takes keyboard focus, unless a control inside it already did (Find's box,
  // a note being written, the companion's action): on the desktop the panel sits after the pages, whose
  // PDF links would otherwise all lie between the bar's buttons and the panel.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per request to open a panel, after the panel has rendered
  useEffect(() => {
    if (!panelFocus) return;
    const area = compact ? dialogRef.current : asideRef.current;
    if (!area || area.contains(document.activeElement)) return;
    (compact ? dialogTitleRef : panelTitleRef).current?.focus();
  }, [panelFocus]);

  function openSection(next: Section, focus = false) {
    setSection(next);
    if (focus) setPanelFocus((n) => n + 1);
    if (compact) {
      if (!dialogRef.current?.open) dialogRef.current?.showModal();
      setDialogOpen(true);
    } else if (panelHidden) {
      setPanelHidden(false);
      writePanelHidden(false);
    }
  }

  function openPanels() {
    if (!dialogRef.current?.open) dialogRef.current?.showModal();
    setDialogOpen(true);
  }

  function togglePanel() {
    const hidden = !panelHidden;
    setPanelHidden(hidden);
    writePanelHidden(hidden);
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  /** The dialog returns focus to what had it; when that is gone (the selection bar), focus goes to Panels. */
  function onDialogClose() {
    setDialogOpen(false);
    const active = document.activeElement;
    if (!active || active === document.body) panelsButtonRef.current?.focus();
  }

  /** After the selection bar acts and goes, keyboard focus returns to the pages instead of being lost. */
  function returnFocusFromSelectionBar() {
    if (selectionBarRef.current?.contains(document.activeElement)) containerRef.current?.focus({ preventScroll: true });
  }

  function goToPage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const viewer = engineRef.current?.viewer;
    if (!viewer?.pagesCount) return;
    const typed = pageInput.trim();
    const number = requestedPage(typed) ?? viewer.pageLabelToPageNumber(typed);
    if (number) {
      intentRef.current();
      viewer.currentPageNumber = clampPage(number, viewer.pagesCount);
    } else setPageInput(String(viewer.currentPageNumber));
  }

  function turnPage(direction: "next" | "previous") {
    const viewer = engineRef.current?.viewer;
    if (!viewer) return;
    intentRef.current();
    if (direction === "next") viewer.nextPage();
    else viewer.previousPage();
  }

  function changeZoom(value: string) {
    const viewer = engineRef.current?.viewer;
    if (!viewer || value.startsWith("custom:")) return;
    intentRef.current();
    viewer.currentScaleValue = value;
  }

  function runFind(findPrevious: boolean) {
    const engine = engineRef.current;
    const query = findQuery.trim();
    if (!engine || !query) return;
    const again = query === lastFindRef.current;
    lastFindRef.current = query;
    intentRef.current();
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
    intentRef.current();
    viewer.currentPageNumber = clampPage(physicalIndex + 1, viewer.pagesCount);
    if (compact) closeDialog();
  }

  function followOutline(node: OutlineNode) {
    const engine = engineRef.current;
    if (!engine || !node.dest) return;
    void engine.link.goToDestination(node.dest as string);
    if (compact) closeDialog();
  }

  function goBack() {
    const viewer = engineRef.current?.viewer;
    const { entry, stack } = popBack(backStack);
    setBackStack(stack);
    if (!viewer || !entry) return;
    intentRef.current();
    viewer.scrollPageIntoView({
      pageNumber: clampPage(entry.pageNumber, viewer.pagesCount),
      destArray: entry.left !== null && entry.top !== null ? [null, { name: "XYZ" }, entry.left, entry.top, null] : undefined,
      allowNegativeOffset: true,
      ignoreDestinationZoom: true,
    });
  }

  function jumpToAnnotation(a: ReaderAnnotation) {
    const viewer = engineRef.current?.viewer;
    if (!viewer?.pagesCount) return;
    recordJump();
    intentRef.current();
    const pageNumber = clampPage(a.pageIndex + 1, viewer.pagesCount);
    const rects = placement.drawn.some((d) => d.id === a.id) ? (a.anchor?.rects ?? []) : [];
    if (rects.length) {
      // A little above and left of the marked text, in PDF user space (y grows upwards).
      const top = Math.max(...rects.map((r) => r[3])) + 36;
      const left = Math.min(...rects.map((r) => r[0])) - 36;
      viewer.scrollPageIntoView({
        pageNumber,
        destArray: [null, { name: "XYZ" }, left, top, null],
        allowNegativeOffset: true,
        ignoreDestinationZoom: true,
      });
      setFocused(a.id);
    } else viewer.scrollPageIntoView({ pageNumber });
    if (compact) closeDialog();
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

  function dismissNotice() {
    const url = new URL(window.location.href);
    url.searchParams.delete("error");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void rootRef.current?.requestFullscreen().catch(() => undefined);
  }

  // --- annotations --------------------------------------------------------------------------------

  function clearSelection() {
    document.getSelection()?.removeAllRanges();
    setSelection(null);
    setSelectionError(null);
  }

  /** Runs one highlight or bookmark request at a time; a click while one is in flight does nothing. */
  async function creatingOne(run: () => Promise<void>) {
    if (creatingRef.current) return;
    creatingRef.current = true;
    setCreating(true);
    try {
      await run();
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  }

  async function highlightSelection() {
    const current = selection;
    if (!current) return;
    const fromBar = Boolean(selectionBarRef.current?.contains(document.activeElement));
    await creatingOne(async () => {
      const result = await createAnnotationRequest({
        assetId,
        kind: "highlight",
        physicalIndex: current.pageIndex,
        color,
        anchor: current.anchor,
        ...(loadedShaRef.current ? { loadedSha256: loadedShaRef.current } : {}),
      });
      if (!result.ok) {
        setSelectionError(result.message);
        return;
      }
      setAnnotations((list) => upsertAnnotation(list, result.value));
      if (fromBar) containerRef.current?.focus({ preventScroll: true });
      clearSelection();
    });
  }

  function noteSelection() {
    if (!selection) return;
    setComposer(selection);
    setNoteError(null);
    clearSelection();
    openSection("notes", true);
  }

  /** An added selection action (the companion's Ask): it receives the selection, then may open its panel. */
  function runSelectionAction(action: ReaderSelectionAction) {
    if (!selection) return;
    action.run({ pageIndex: selection.pageIndex, quote: selection.quote, anchor: selection.anchor });
    if (!action.opens) return;
    clearSelection();
    openSection(action.opens, true);
  }

  async function saveComposer(note: string): Promise<string | null> {
    if (!composer) return null;
    const result = await createAnnotationRequest({
      assetId,
      kind: "note",
      physicalIndex: composer.pageIndex,
      noteMarkdown: note,
      ...(composer.anchor.rects.length ? { color } : {}),
      anchor: composer.anchor,
      ...(loadedShaRef.current ? { loadedSha256: loadedShaRef.current } : {}),
    });
    if (!result.ok) return result.message;
    setAnnotations((list) => upsertAnnotation(list, result.value));
    setComposer(null);
    return null;
  }

  async function toggleBookmark() {
    setNoteError(null);
    const index = page.number - 1;
    // The bookmark whose ribbon this page shows; one listed under Needs repair is not this file's.
    const existing = placement.bookmarks.find((a) => a.pageIndex === index);
    await creatingOne(async () => {
      if (existing) {
        const result = await deleteAnnotationRequest(existing.id);
        if (result.ok) setAnnotations((list) => list.filter((a) => a.id !== existing.id));
        else setNoteError(result.message);
        return;
      }
      const pageView = pageViewFor(page.number);
      const anchor = pageView ? pageAnchor(pageView) : null;
      if (!anchor) return;
      const result = await createAnnotationRequest({
        assetId,
        kind: "bookmark",
        physicalIndex: index,
        anchor,
        ...(loadedShaRef.current ? { loadedSha256: loadedShaRef.current } : {}),
      });
      if (result.ok) setAnnotations((list) => upsertAnnotation(list, result.value));
      else setNoteError(result.message);
    });
  }

  function startPageNote() {
    const pageView = pageViewFor(page.number);
    const anchor = pageView ? pageAnchor(pageView) : null;
    if (!anchor) return;
    setNoteError(null);
    setComposer({ pageIndex: page.number - 1, anchor, quote: null, source: "page" });
  }

  function startMarkArea() {
    setNoteError(null);
    clearSelection();
    if (compact) closeDialog();
    setMarking({ first: null });
  }

  async function keepNotesOnNewFile() {
    const current = facts;
    const loaded = loadedShaRef.current;
    if (!current || !loaded) return;
    setKeep({ busy: true, error: null });
    const result = await props.actions
      .keepNotesOnNewFile(assetId, { observedSha256: loaded, pageCount: current.pageCount, pageViews: current.pageViews })
      .catch(() => ({ error: "The server could not be reached, so nothing was changed. Try again." }));
    if ("error" in result) {
      setKeep({ busy: false, error: result.error });
      return;
    }
    // Refused, the server marked every anchored note for repair; the reader shows the same, and why.
    setAnnotations((list) => keptOnNewFile(list, info.documentKey, result.accepted));
    if (result.accepted) setFacts({ ...current, observed: "same" });
    setKeepRefusal(result.accepted ? null : result.problems);
    setKeep({ busy: false, error: null });
  }

  const ready = load.state === "ready";
  const label = printedLabel(page.number, page.label);
  const status = findStatus({ query: findQuery, ...find });
  const back = backStack.at(-1);
  const pageLabel = (index: number) => {
    const printed = printedLabel(index + 1, labels?.[index]);
    return printed ? `page ${index + 1} (printed ${printed})` : `page ${index + 1}`;
  };
  const listedNotes = inReadingOrder([...placement.drawn, ...placement.listed]);
  const extraPanels = props.panels ?? [];
  const readerSelection: ReaderSelection | null = selection
    ? { pageIndex: selection.pageIndex, quote: selection.quote, anchor: selection.anchor }
    : null;
  const version = info.version;
  const arxivFacts = version?.arxiv ?? null;
  // The exact version's state on arXiv: withdrawn, a newer version to open, later versions withdrawn.
  const versionNotices: ReactNode[] = version
    ? [
        version.withdrawn ? (
          <span key="withdrawn" className="text-rust">
            This version: Withdrawn on arXiv
          </span>
        ) : null,
        version.newest ? (
          <form key="newest" action={props.actions.openArxivVersion} className="flex items-center gap-2">
            <input type="hidden" name="assetId" value={assetId} />
            <input type="hidden" name="version" value={version.newest.version} />
            <span>A newer version exists:</span>
            <button type="submit" className="text-brass underline underline-offset-4">
              Open {version.newest.label}
            </button>
          </form>
        ) : null,
        ...version.withdrawnLater.map((v) => <span key={`withdrawn-${v.version}`}>{v.label}: Withdrawn on arXiv</span>),
      ].filter(Boolean)
    : [];

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
        onKeyDown={(event) => {
          // In the phone dialog one Esc closes it; a search field would spend the first Esc clearing itself.
          if (event.key !== "Escape" || !dialogRef.current?.open) return;
          event.preventDefault();
          closeDialog();
        }}
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

  const notesPanel = (
    <NotesPanel
      notes={listedNotes}
      repair={placement.repair}
      problems={placement.problems.length ? placement.problems : (keepRefusal ?? [])}
      pageLabel={pageLabel}
      currentPage={page.number}
      ready={ready}
      busy={creating}
      bookmarked={bookmarks.has(page.number - 1)}
      composer={composer}
      composerColor={color}
      onComposerColor={setColor}
      onToggleBookmark={() => void toggleBookmark()}
      onPageNote={startPageNote}
      onMarkArea={startMarkArea}
      onSaveComposer={saveComposer}
      onCancelComposer={() => setComposer(null)}
      onJump={jumpToAnnotation}
      onChanged={(row) => setAnnotations((list) => upsertAnnotation(list, row))}
      onDeleted={(id) => setAnnotations((list) => list.filter((a) => a.id !== id))}
      error={noteError}
    />
  );

  const sections: { id: Section; label: string }[] = [
    { id: "contents", label: "Contents" },
    { id: "find", label: "Find" },
    { id: "notes", label: "Notes" },
    { id: "paper", label: "Paper" },
    ...extraPanels.map((p) => ({ id: p.id, label: p.label })),
  ];
  const panelBody: ReactNode =
    section === "contents" ? (
      contents
    ) : section === "find" ? (
      findPanel
    ) : section === "notes" ? (
      notesPanel
    ) : section === "paper" ? (
      <PaperPanel info={info} title={title} />
    ) : (
      (extraPanels
        .find((p) => p.id === section)
        ?.render({ selection: readerSelection, pageIndex: page.number - 1, loadedSha256: loadedShaRef.current }) ?? null)
    );
  const sectionTitle = sections.find((s) => s.id === section)?.label ?? "Contents";

  return (
    <div ref={rootRef} className="flex min-h-0 flex-1 flex-col bg-paper">
      <a href="#reader-pages" className="skip-link">
        Skip to the pages
      </a>
      <header className="border-b border-stone bg-paper-2 px-3 py-1.5 sm:px-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <div className="flex min-w-[15rem] flex-[1_1_15rem] items-center gap-2">
            <Link href={backHref} className={control} aria-label={backLabel}>
              {compact ? "Back" : backLabel}
            </Link>
            <h1 className="min-w-0 flex-1 truncate text-base text-ink sm:text-lg" title={title}>
              {title}
            </h1>
            {version && !compact ? <span className="shrink-0 text-sm text-ink-3">{version.label}</span> : null}
            {compact ? (
              <button ref={panelsButtonRef} type="button" className={control} onClick={openPanels} aria-haspopup="dialog">
                Panels
              </button>
            ) : (
              <>
                {textHref ? (
                  // Not prefetched: its href changes on every page turn, and each prefetch is a server request.
                  <Link href={`${textHref}&page=${page.number}`} prefetch={false} className={control}>
                    Text view
                  </Link>
                ) : null}
                {fullscreenEnabled ? (
                  <button type="button" className={control} onClick={toggleFullscreen}>
                    {fullscreen ? "Exit full screen" : "Full screen"}
                  </button>
                ) : null}
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <button
              type="button"
              className={control}
              aria-label="Previous page"
              onClick={() => turnPage("previous")}
              disabled={!ready || page.number <= 1}
            >
              Previous
            </button>
            <form onSubmit={goToPage} className="flex items-center gap-1.5 text-sm text-ink-2">
              <label htmlFor="reader-page" className={compact ? "sr-only" : ""}>
                Page
              </label>
              <input
                id="reader-page"
                inputMode="numeric"
                autoComplete="off"
                value={pageInput}
                onChange={(event) => setPageInput(event.target.value)}
                className="w-12 rounded-[var(--radius-control)] border border-stone-2 bg-paper px-2 py-1 text-sm text-ink sm:w-14"
                disabled={!ready}
              />
              <span>of {pagesCount || "…"}</span>
              {label && !compact ? <span className="text-ink-3">printed p. {label}</span> : null}
            </form>
            <button
              type="button"
              className={control}
              aria-label="Next page"
              onClick={() => turnPage("next")}
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
            {compact ? null : (
              <>
                {sections.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={control}
                    onClick={() => openSection(s.id, true)}
                    aria-pressed={panelShown && section === s.id}
                  >
                    {s.label}
                  </button>
                ))}
                <button type="button" className={control} onClick={togglePanel}>
                  {panelHidden ? "Show panel" : "Hide panel"}
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {info.linked && arxivFacts ? (
        // The attribution names the exact version, so the version notices share its line.
        <div className="border-b border-stone bg-paper-2 px-3 py-1 text-xs text-ink-2 sm:px-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <span>
              arXiv:{arxivFacts.display} · read from arxiv.org ·{" "}
              <a href={arxivFacts.absUrl} target="_blank" rel="noopener noreferrer" className="text-brass underline underline-offset-4">
                abstract page
              </a>
            </span>
            {versionNotices}
          </div>
          <p className="text-ink-3">
            Your browser downloads this PDF directly from arxiv.org; arXiv sees your IP address and which paper you open.
          </p>
        </div>
      ) : version && (versionNotices.length || compact) ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-stone bg-paper-2 px-3 py-1 text-xs text-ink-2 sm:px-4">
          {compact ? <span className="text-ink">{version.label}</span> : null}
          {versionNotices}
        </div>
      ) : null}
      {notice ? (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 border-b border-rust/30 bg-rust-soft px-3 py-1.5 text-sm text-rust sm:px-4"
        >
          <p>{notice}</p>
          <button type="button" className="shrink-0 underline underline-offset-4" onClick={dismissNotice}>
            Dismiss
          </button>
        </div>
      ) : null}
      {placement.drift.length ? (
        <div
          role="status"
          className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-brass/30 bg-brass-soft px-3 py-1.5 text-sm text-brass-strong sm:px-4"
        >
          <p>
            {facts?.observed === "changed"
              ? "arXiv's file has changed since these notes were made."
              : "Some notes were made on another file of this paper."}{" "}
            Its pages have the same sizes, so they are drawn.
          </p>
          {placement.keepProblems.length ? (
            <p>
              They cannot be kept on this file, because notes listed under Needs repair are on pages that differ:{" "}
              {placement.keepProblems.join(" ")}
            </p>
          ) : (
            <button type="button" className={control} onClick={() => void keepNotesOnNewFile()} disabled={keep.busy}>
              {keep.busy ? "Keeping…" : "Keep my notes on the new file"}
            </button>
          )}
          {keep.error ? <p className="text-rust">{keep.error}</p> : null}
        </div>
      ) : null}
      {placement.unverified.length ? (
        <p role="status" className="border-b border-stone bg-paper-2 px-3 py-1.5 text-sm text-ink-2 sm:px-4">
          Corniversity could not record which file your browser received from arXiv, so it cannot tell whether the file changed since your
          notes were made. The pages have the same sizes, so the notes are drawn.
        </p>
      ) : null}
      {keepRefusal ? (
        <p role="status" className="border-b border-rust/30 bg-rust-soft px-3 py-1.5 text-sm text-rust sm:px-4">
          Your notes were not kept on the new file{keepRefusal.length ? `: ${keepRefusal.join(" ")}` : "."} They are listed under Needs
          repair.
        </p>
      ) : null}

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
            className={["reader-pages absolute inset-0 overflow-auto", marking ? "reader-marking" : ""].join(" ")}
          >
            <div ref={viewerRef} className="pdfViewer" />
          </div>
          {back ? (
            <button type="button" className={`${control} absolute top-2 left-2 shadow-sm`} onClick={goBack}>
              Back to page {back.pageNumber}
            </button>
          ) : null}
          {marking ? (
            <div
              role="status"
              className="absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-2 border-t border-stone bg-paper-2 px-3 py-2 text-sm text-ink"
            >
              <p className="min-w-0 flex-1">
                {marking.first
                  ? `Now click the opposite corner on page ${marking.first.pageNumber}.`
                  : "Mark area: click one corner of the area on a page."}
              </p>
              <button type="button" className={control} onClick={() => setMarking(null)}>
                Cancel
              </button>
            </div>
          ) : selection ? (
            <div
              ref={selectionBarRef}
              role="toolbar"
              aria-label="Selected text"
              onMouseDown={(event) => {
                // Keep the selection while its buttons are used (a select still opens).
                if (!(event.target instanceof HTMLSelectElement)) event.preventDefault();
              }}
              className="absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-2 border-t border-stone bg-paper-2 px-3 py-2 text-sm text-ink"
            >
              <span className={compact ? "sr-only" : "text-ink-2"}>Selection on {pageLabel(selection.pageIndex)}:</span>
              {/* aria-disabled while the request runs, so the button keeps keyboard focus (a second press is ignored). */}
              <button type="button" className={control} onClick={() => void highlightSelection()} aria-disabled={creating || undefined}>
                Highlight
              </button>
              <label htmlFor="reader-selection-colour" className="sr-only">
                Highlight colour
              </label>
              <select
                id="reader-selection-colour"
                value={color}
                onChange={(event) => setColor(event.target.value as AnnotationColor)}
                className="rounded-[var(--radius-control)] border border-stone-2 bg-paper-2 px-2 py-0.5 text-sm text-ink"
              >
                {ANNOTATION_COLORS.map((c) => (
                  <option key={c} value={c}>
                    {COLOR_LABELS[c]}
                  </option>
                ))}
              </select>
              <button type="button" className={control} onClick={noteSelection}>
                Note
              </button>
              {(props.selectionActions ?? []).map((action) => (
                <button key={action.id} type="button" className={control} onClick={() => runSelectionAction(action)}>
                  {action.label}
                </button>
              ))}
              <button
                type="button"
                className={control}
                onClick={() => {
                  returnFocusFromSelectionBar();
                  clearSelection();
                }}
              >
                Clear
              </button>
              {selectionError ? (
                <p role="alert" className="w-full text-rust">
                  {selectionError}
                </p>
              ) : null}
            </div>
          ) : null}
          {load.state === "ready" ? null : (
            <div className="absolute inset-0 grid place-items-center p-6">
              {load.state === "loading" ? (
                <p role="status" className="text-sm text-ink-2">
                  {source.kind === "arxiv" ? "Loading the PDF from arxiv.org…" : "Loading the PDF…"}
                </p>
              ) : (
                <div
                  role="alert"
                  className="max-w-md rounded-[var(--radius-panel)] border border-rust/30 bg-rust-soft px-4 py-3 text-sm text-rust"
                >
                  <p>{load.message}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {load.arxiv && arxivFacts ? (
                      <a href={arxivFacts.pdfUrl} target="_blank" rel="noopener noreferrer" className={control}>
                        Open on arXiv
                      </a>
                    ) : null}
                    <button type="button" className={control} onClick={() => setAttempt((n) => n + 1)}>
                      Try again
                    </button>
                    {textHref ? (
                      <Link href={`${textHref}&page=${page.number}`} prefetch={false} className={control}>
                        Text view
                      </Link>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        {!compact && !panelHidden ? (
          <aside
            ref={asideRef}
            aria-labelledby="reader-panel-title"
            className="w-[320px] shrink-0 overflow-y-auto border-l border-stone bg-paper-2 p-4"
          >
            <h2 id="reader-panel-title" ref={panelTitleRef} tabIndex={-1} className="mb-3 text-base text-ink">
              {sectionTitle}
            </h2>
            {panelBody}
          </aside>
        ) : null}
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby="reader-dialog-title"
        onClose={onDialogClose}
        className="mx-0 mt-auto mb-0 w-full max-w-none overflow-hidden rounded-t-[var(--radius-panel)] border border-stone bg-paper-2 p-0 text-ink backdrop:bg-ink/30"
      >
        {/* The heading, the section switches and Close stay in view while a long list scrolls. */}
        <div className="flex max-h-[80dvh] flex-col">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-stone px-4 py-2">
            <h2 id="reader-dialog-title" ref={dialogTitleRef} tabIndex={-1} className="text-base text-ink">
              {sectionTitle}
            </h2>
            <button type="button" className={control} onClick={closeDialog}>
              Close
            </button>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 border-b border-stone px-4 py-2">
            {sections.map((s) => (
              <button key={s.id} type="button" className={control} onClick={() => setSection(s.id)} aria-pressed={section === s.id}>
                {s.label}
              </button>
            ))}
          </div>
          <div className="min-h-0 overflow-y-auto px-4 py-3">{compact ? panelBody : null}</div>
          {compact && (textHref || fullscreenEnabled) ? (
            <div className="flex shrink-0 flex-wrap gap-2 border-t border-stone px-4 py-2">
              {textHref ? (
                <Link href={`${textHref}&page=${page.number}`} prefetch={false} className={control}>
                  Text view
                </Link>
              ) : null}
              {fullscreenEnabled ? (
                <button type="button" className={control} onClick={toggleFullscreen}>
                  {fullscreen ? "Exit full screen" : "Full screen"}
                </button>
              ) : null}
            </div>
          ) : null}
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
