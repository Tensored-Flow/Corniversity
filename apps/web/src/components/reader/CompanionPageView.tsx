"use client";
import { useMemo, useState } from "react";
import { AskPanel } from "./AskPanel";
import { type AskActions, type AskPanelData, captureSelection, createAskStore } from "./ask";
import { PageView } from "./PageView";
import type { PdfReaderProps, ReaderPanel, ReaderSelectionAction } from "./PdfReader";

/**
 * The Page view with the reading companion plugged in through the reader's extension points: an
 * *Ask* panel (closed until the owner opens it) and *Ask* in the selection bar, which hands the
 * selection to that panel and opens it. Functions cannot cross from the server page, so this client
 * wrapper builds them; the panel's state lives in a store here, so it survives switching panels.
 */
export function CompanionPageView({
  companion,
  companionActions,
  ...reader
}: Omit<PdfReaderProps, "panels" | "selectionActions"> & { companion: AskPanelData; companionActions: AskActions }) {
  const [store] = useState(() => createAskStore(companion));
  const panels = useMemo<ReaderPanel[]>(
    () => [
      {
        id: "ask",
        label: "Ask",
        render: ({ pageIndex, loadedSha256 }) => (
          <AskPanel
            data={companion}
            store={store}
            actions={companionActions}
            pageIndex={pageIndex}
            loadedSha256={loadedSha256}
            selectionSource="captured"
          />
        ),
      },
    ],
    [companion, companionActions, store],
  );
  const selectionActions = useMemo<ReaderSelectionAction[]>(
    () => [
      {
        id: "ask",
        label: "Ask",
        opens: "ask",
        run: (selection) => {
          const text = selection.quote?.trim() ?? "";
          if (text) store.set(captureSelection(store.get(), { text, pageIndex: selection.pageIndex }));
        },
      },
    ],
    [store],
  );
  return <PageView {...reader} panels={panels} selectionActions={selectionActions} />;
}
