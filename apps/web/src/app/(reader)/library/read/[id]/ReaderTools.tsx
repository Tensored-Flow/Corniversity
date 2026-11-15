"use client";
import { useEffect, useState } from "react";
import { AskPanel } from "@/components/reader/AskPanel";
import { type AskActions, type AskPanelData, createAskStore } from "@/components/reader/ask";
import { Button } from "@/components/ui";

interface Props {
  assetId: string;
  physicalIndex: number;
  pageLabel: string;
  saveAnnotation: (form: FormData) => Promise<void>;
  companion: AskPanelData;
  companionActions: AskActions;
}

/**
 * Selection-aware tools for the Text view. Selecting text inside the page captures it for a note
 * or for the reading companion. The companion's *Ask* panel is closed until the owner opens it; it
 * sends nothing until they press Send, and the server alone decides whether the passage may be
 * discussed and says why not when it may not.
 */
export function ReaderTools({ assetId, physicalIndex, pageLabel, saveAnnotation, companion, companionActions }: Props) {
  const [selected, setSelected] = useState("");
  const [store] = useState(() => createAskStore(companion));

  useEffect(() => {
    const onSelection = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;
      const container = document.getElementById("page-text");
      const node = selection.anchorNode;
      if (!container || !node || !container.contains(node)) return;
      const text = selection.toString().trim();
      if (text.length >= 3) setSelected(text.slice(0, 4000));
    };
    document.addEventListener("mouseup", onSelection);
    document.addEventListener("keyup", onSelection);
    return () => {
      document.removeEventListener("mouseup", onSelection);
      document.removeEventListener("keyup", onSelection);
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="selection-heading">
        <h3 id="selection-heading" className="text-sm font-medium text-ink">
          Selected passage
        </h3>
        {selected ? (
          <blockquote className="mt-1 max-h-32 overflow-y-auto border-l-2 border-brass pl-3 text-sm text-ink-2">{selected}</blockquote>
        ) : (
          <p className="mt-1 text-sm text-ink-3">Select text in the page to annotate it or ask about it.</p>
        )}
      </section>

      <form action={saveAnnotation} className="flex flex-col gap-2">
        <input type="hidden" name="assetId" value={assetId} />
        <input type="hidden" name="physicalIndex" value={physicalIndex} />
        <input type="hidden" name="selectedText" value={selected} />
        <input type="hidden" name="view" value="text" />
        <label htmlFor="note" className="text-sm font-medium text-ink">
          Note on {pageLabel}
        </label>
        <textarea
          id="note"
          name="note"
          rows={3}
          className="w-full rounded-[var(--radius-control)] border border-stone-2 bg-paper px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-focus"
          placeholder="Markdown and LaTeX are fine"
        />
        <div>
          <Button type="submit" variant="secondary">
            Save note
          </Button>
        </div>
      </form>

      {/* Closed by default: the companion appears only when the owner opens it. */}
      <details id="ask" className="border-t border-stone pt-3">
        <summary className="cursor-pointer py-0.5 text-sm font-medium text-ink">Ask</summary>
        <div className="mt-3">
          <AskPanel
            data={companion}
            store={store}
            actions={companionActions}
            pageIndex={physicalIndex}
            loadedSha256={null}
            selectionSource="live"
            liveSelection={selected ? { text: selected, pageIndex: physicalIndex } : null}
          />
        </div>
      </details>
    </div>
  );
}
