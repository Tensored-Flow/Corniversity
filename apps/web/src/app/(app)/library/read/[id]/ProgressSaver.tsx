"use client";
import { useEffect } from "react";
import { saveProgressAction } from "../../actions";

/** Remembers the page being read so the item reopens where the learner left it. */
export function ProgressSaver({ assetId, physicalIndex }: { assetId: string; physicalIndex: number }) {
  useEffect(() => {
    void saveProgressAction(assetId, physicalIndex);
  }, [assetId, physicalIndex]);
  return null;
}
