"use client";
import { useEffect, useRef, useState } from "react";
import { RenderedHtml } from "@/components/RenderedHtml";
import { Button } from "@/components/ui";
import { saveReaderAnchorAction } from "./actions";
import { useWorkspace } from "./Workspace";

function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 80) || "section"
  );
}

/**
 * The lesson as a reading. Headings get stable anchors derived from their text; the heading in
 * view is saved on the server (so another device opens the reading at the same place) and the
 * saved one is scrolled to on arrival. Selecting text offers to ask about it or note it; the
 * selection stays until replaced or cleared, so clicking into a panel does not lose it.
 */
export function LessonReader({ sessionId, html, initialAnchor }: { sessionId: string; html: string; initialAnchor?: string | null }) {
  const container = useRef<HTMLDivElement>(null);
  const { selection, setSelection, requestHelp, requestNote } = useWorkspace();
  const [resumedAt, setResumedAt] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "failed">("idle");
  const lastSaved = useRef(initialAnchor ?? "");

  useEffect(() => {
    const root = container.current;
    if (!root) return;
    const headings = [...root.querySelectorAll<HTMLElement>("h2, h3")];
    const seen = new Map<string, number>();
    for (const h of headings) {
      const base = slug(h.textContent ?? "");
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      h.dataset.anchor = n === 1 ? base : `${base}-${n}`;
      h.tabIndex = -1;
    }
    if (initialAnchor) {
      const target = headings.find((h) => h.dataset.anchor === initialAnchor);
      if (target) {
        target.scrollIntoView({ block: "start" });
        setResumedAt(target.textContent ?? initialAnchor);
      }
    }
    // The section being read is the last heading above 40% of the viewport (or the first heading,
    // before any has scrolled past); it is saved a moment after the reader settles there.
    let timer: ReturnType<typeof setTimeout> | undefined;
    let frame = 0;
    const current = () => {
      // A lesson folded away (for reference in a tutorial) has no visible headings and no position.
      const shown = headings.filter((h) => h.getClientRects().length > 0);
      if (shown.length === 0) return undefined;
      const line = window.innerHeight * 0.4;
      let anchor = shown[0]?.dataset.anchor;
      for (const h of shown) if (h.getBoundingClientRect().top <= line) anchor = h.dataset.anchor;
      return anchor;
    };
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const anchor = current();
        if (!anchor || anchor === lastSaved.current) return;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          void saveReaderAnchorAction(sessionId, anchor)
            .then((r) => {
              if (r.ok) lastSaved.current = anchor;
              setSaveState(r.ok ? "saved" : "failed");
            })
            .catch(() => setSaveState("failed"));
        }, 2000);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
      if (timer) clearTimeout(timer);
    };
  }, [sessionId, initialAnchor]);

  useEffect(() => {
    const onSelect = () => {
      const sel = document.getSelection();
      const root = container.current;
      if (!sel || sel.isCollapsed || !root || !sel.anchorNode || !root.contains(sel.anchorNode)) return;
      const text = sel.toString().replace(/\s+\n/g, "\n").trim();
      if (text.length >= 3) setSelection({ origin: "lesson", text: text.slice(0, 2000) });
    };
    document.addEventListener("selectionchange", onSelect);
    return () => document.removeEventListener("selectionchange", onSelect);
  }, [setSelection]);

  const lessonSelection = selection?.origin === "lesson" ? selection : null;
  return (
    <div>
      {resumedAt ? (
        <p className="mb-3 text-xs text-ink-3" role="status">
          Resumed at “{resumedAt}”, where you were last reading.
        </p>
      ) : null}
      <div ref={container}>
        <RenderedHtml html={html} />
      </div>
      <p className="mt-3 text-[0.7rem] text-ink-3" aria-live="polite">
        {saveState === "failed"
          ? "Your reading position could not be saved; it will be tried again as you read."
          : saveState === "saved"
            ? "Reading position saved on the server."
            : "Your place in the reading is saved as you go."}
      </p>
      {lessonSelection ? (
        <div className="sticky bottom-3 z-10 mt-4 rounded-[var(--radius-panel)] border border-brass/50 bg-paper-2 p-3 shadow-sm">
          <p className="line-clamp-2 text-xs text-ink-2">
            <span className="font-medium text-ink">Selected:</span> “{lessonSelection.text}”
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => requestHelp("question")}>
              Ask about this
            </Button>
            <Button type="button" variant="secondary" onClick={() => requestNote()}>
              Note this
            </Button>
            <Button type="button" variant="quiet" onClick={() => setSelection(null)}>
              Clear selection
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
