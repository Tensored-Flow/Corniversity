"use client";
import { useEffect, useRef } from "react";
import { saveProgressAction } from "@/app/(app)/library/actions";
import { markOpenedAction } from "./actions";

/**
 * The Text view's reading position. Opening the view marks the Document as opened; the page is
 * remembered only after the owner moves to another page. Arriving, whether through `?page=N`, a link
 * from elsewhere or the remembered page, is never saved. The Text view's links and its page form
 * navigate on the client, so this component stays mounted while the owner turns pages and the first
 * page it sees is the arrival.
 */
export function ProgressSaver({ assetId, physicalIndex }: { assetId: string; physicalIndex: number }) {
  const last = useRef<{ assetId: string; index: number } | null>(null);
  useEffect(() => {
    if (last.current?.assetId !== assetId) {
      last.current = { assetId, index: physicalIndex };
      void markOpenedAction(assetId).catch(() => undefined);
      return;
    }
    if (last.current.index === physicalIndex) return;
    last.current = { assetId, index: physicalIndex };
    void saveProgressAction(assetId, physicalIndex).catch(() => undefined);
  }, [assetId, physicalIndex]);
  return null;
}
