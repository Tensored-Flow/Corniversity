// The drift check, kept free of Zod so the browser reader can import it: Zod probes for eval when it
// builds object schemas at module load, which the reader's CSP reports (anchors.ts re-exports it).

const VIEW_TOLERANCE = 0.01;

export interface DriftInput {
  /** The anchors on the Document (only page index and page view are read). */
  anchors: readonly { pageIndex: number; pageView: readonly [number, number] }[];
  /** The new file's page count and page views ([w, h] per page, by index). */
  pageCount: number;
  pageViews: readonly (readonly [number, number])[];
  /** The page count recorded for the earlier file, when known. */
  previousPageCount?: number | null;
}

/**
 * The drift check for a linked Document whose observed hash changed: annotations can be drawn on the
 * new file only when the page count is unchanged (when known) and every annotated page exists with
 * the same page view. Otherwise they are listed as needing repair.
 */
export function checkDrift(input: DriftInput): { geometryMatches: boolean; problems: string[] } {
  const problems: string[] = [];
  if (input.previousPageCount != null && input.previousPageCount !== input.pageCount)
    problems.push(`The page count changed from ${input.previousPageCount} to ${input.pageCount}.`);
  const reported = new Set<number>();
  for (const anchor of input.anchors) {
    if (reported.has(anchor.pageIndex)) continue;
    const view = anchor.pageIndex < input.pageCount ? input.pageViews[anchor.pageIndex] : undefined;
    if (!view) {
      problems.push(`Page ${anchor.pageIndex + 1} no longer exists.`);
      reported.add(anchor.pageIndex);
    } else if (Math.abs(view[0] - anchor.pageView[0]) > VIEW_TOLERANCE || Math.abs(view[1] - anchor.pageView[1]) > VIEW_TOLERANCE) {
      problems.push(`Page ${anchor.pageIndex + 1} changed size.`);
      reported.add(anchor.pageIndex);
    }
  }
  return { geometryMatches: problems.length === 0, problems };
}
