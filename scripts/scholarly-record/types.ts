// A recording group for `pnpm library:live-check --record-group <name>`: a module in this folder
// whose default export makes its live requests through the recording client. Space arXiv requests
// with `sleep(arxivGapMs)` (arXiv allows one request every three seconds across all processes).
import type { ScholarlyClient } from "../../packages/db/src/scholarly/index";

export type RecordTools = {
  check: <T>(label: string, run: () => Promise<T>, summarise: (value: T) => string) => Promise<T | null>;
  checkNotFound: (label: string, run: () => Promise<unknown>) => Promise<void>;
  sleep: (ms: number) => Promise<unknown>;
  arxivGapMs: number;
};

export type RecordGroup = (client: ScholarlyClient, tools: RecordTools) => Promise<void>;
