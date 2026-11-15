import { createBlobStore } from "@corniversity/db/blob";
import { ScholarlyArxivPayload, ScholarlyRefreshPayload } from "@corniversity/db/jobs";
import { scholarlyClientWithCache } from "@corniversity/db/scholarly/cache-pg";
import type { ScholarlyClient } from "@corniversity/db/scholarly/client";
import { ScholarlyProviderError } from "@corniversity/db/scholarly/errors";
import { ARXIV_MIN_SPACING_MS } from "@corniversity/db/scholarly/transport";
import { LibraryError } from "@corniversity/db/services/library";
import {
  applyArxivRecord,
  keepPrivateCopy,
  refreshIntegrity,
  refreshWork,
  ScholarlyError,
} from "@corniversity/db/services/scholarly-works";
import { type HandlerContext, NonRetryableError } from "./index";
import { reportProgress } from "./job-record";

/**
 * The worker side of the research library. Only the worker calls arXiv, and only through the
 * `scholarly-arxiv` queue: one active job at a time across processes (the queue's singleton key),
 * at least 3.1 s between requests (the gate below, which also holds the job's slot for that long
 * after its last request so the next job anywhere starts spaced), and a Retry-After from arXiv
 * delays every later request in this process.
 */

export interface ArxivGateClock {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}

/** Longest a job holds its slot for a Retry-After; longer waits fail the job and leave the gate closed. */
export const MAX_RETRY_HOLD_MS = 5 * 60 * 1000;

export class ArxivGate {
  private nextAllowedAt = 0;

  constructor(private readonly clock: ArxivGateClock = { now: () => Date.now(), sleep: (ms) => new Promise((r) => setTimeout(r, ms)) }) {}

  /** The earliest time (clock ms) the next arXiv request may start. */
  get nextAllowed(): number {
    return this.nextAllowedAt;
  }

  /** Runs one arXiv request: waits for its turn, then spaces the next one (longer after a Retry-After). */
  async run<T>(request: () => Promise<T>): Promise<T> {
    await this.waitTurn();
    try {
      return await request();
    } catch (error) {
      if (error instanceof ScholarlyProviderError && error.provider === "arxiv" && error.retryAfterSeconds)
        this.nextAllowedAt = Math.max(this.nextAllowedAt, this.clock.now() + error.retryAfterSeconds * 1000);
      throw error;
    } finally {
      this.nextAllowedAt = Math.max(this.nextAllowedAt, this.clock.now() + ARXIV_MIN_SPACING_MS);
    }
  }

  /** Waits until the next request may start (at most MAX_RETRY_HOLD_MS), keeping the queue's slot held. */
  async drain(): Promise<void> {
    const wait = Math.min(this.nextAllowedAt - this.clock.now(), MAX_RETRY_HOLD_MS);
    if (wait > 0) await this.clock.sleep(wait);
  }

  private async waitTurn(): Promise<void> {
    const wait = this.nextAllowedAt - this.clock.now();
    if (wait > 0) await this.clock.sleep(wait);
  }
}

/** The process's arXiv gate (handler tests pass their own through the context). */
const processGate = new ArxivGate();

export interface ScholarlyHandlerContext extends HandlerContext {
  scholarly?: ScholarlyClient;
  arxivGate?: ArxivGate;
}

function clientFor(ctx: ScholarlyHandlerContext): ScholarlyClient {
  return ctx.scholarly ?? scholarlyClientWithCache(ctx.env, ctx.db);
}

/** Retrying cannot help: an identifier arXiv does not know, a refused licence, fixture data missing. */
function permanent(error: unknown): boolean {
  if (error instanceof ScholarlyProviderError)
    return [
      "not_found",
      "invalid_identifier",
      "refused",
      "redirect",
      "too_large",
      "invalid_response",
      "fixture_missing",
      "budget_exhausted",
    ].includes(error.code);
  if (error instanceof ScholarlyError)
    return error.code !== "provider" || (error.details.providerCode !== "unavailable" && error.details.providerCode !== "rate_limited");
  return error instanceof LibraryError;
}

function asJobError(error: unknown): unknown {
  if (permanent(error)) return new NonRetryableError(error instanceof Error ? error.message : String(error));
  return error;
}

export async function scholarlyArxivHandler(ctx: ScholarlyHandlerContext, raw: unknown): Promise<Record<string, unknown>> {
  const payload = ScholarlyArxivPayload.parse(raw);
  const gate = ctx.arxivGate ?? processGate;
  const client = clientFor(ctx);
  try {
    switch (payload.task) {
      case "record": {
        await reportProgress(ctx.db, raw, { stage: "fetching", percent: 10, detail: `arXiv:${payload.arxivId}` });
        const entries = await gate.run(() => client.arxivEntries([{ id: payload.arxivId, version: null }], { cache: "refresh" }));
        let rawRecord: Awaited<ReturnType<ScholarlyClient["arxivRaw"]>> | null = null;
        try {
          rawRecord = await gate.run(() => client.arxivRaw(payload.arxivId, { cache: "refresh" }));
        } catch (error) {
          if (!(error instanceof ScholarlyProviderError && error.code === "not_found")) throw error;
        }
        const entry = entries.entries.find((e) => e.id === payload.arxivId) ?? null;
        await reportProgress(ctx.db, raw, { stage: "applying", percent: 80 });
        const applied = await applyArxivRecord(ctx.db, payload.ownerId, {
          workId: payload.workId,
          arxivId: payload.arxivId,
          entry,
          raw: rawRecord,
        });
        return { workId: applied.workId, versions: applied.versions, possibleDuplicates: applied.possibleDuplicates.length };
      }
      case "private-copy": {
        await reportProgress(ctx.db, raw, { stage: "fetching", percent: 10 });
        const blobs = createBlobStore(ctx.env.BLOB_STORE, ctx.db, ctx.env.CORNIVERSITY_DATA_ROOT);
        const result = await keepPrivateCopy(ctx.db, blobs, client, {
          ownerId: payload.ownerId,
          assetId: payload.assetId,
          maxBytes: ctx.env.MAX_UPLOAD_MB * 1_048_576,
          runArxiv: (request) => gate.run(request),
        });
        return { assetId: result.assetId, outcome: result.outcome, extractionQueued: result.queued };
      }
      case "listing": {
        // Newest submissions go into the provider cache; Discover reads them from there.
        const listing = await gate.run(() => client.arxivNewest(payload.categories, payload.maxResults, { cache: "refresh" }));
        return { categories: payload.categories, entries: listing.entries.length, retrievedAt: listing.provenance.retrievedAt };
      }
    }
  } catch (error) {
    throw asJobError(error);
  } finally {
    await gate.drain();
  }
}

export async function scholarlyRefreshHandler(ctx: ScholarlyHandlerContext, raw: unknown): Promise<Record<string, unknown>> {
  const payload = ScholarlyRefreshPayload.parse(raw);
  const client = clientFor(ctx);
  try {
    if (payload.task === "work") {
      const refreshed = await refreshWork(ctx.db, payload.ownerId, client, payload.workId);
      // The requested work's DOIs (merges followed), where Crossref's notices live.
      const integrity = await refreshIntegrity(ctx.db, payload.ownerId, client, payload.workId);
      return { workId: refreshed.workId, openalexMerged: refreshed.merged, integrityChecked: integrity.checked.length };
    }
    const integrity = await refreshIntegrity(ctx.db, payload.ownerId, client, payload.workId);
    return { workId: payload.workId, integrityChecked: integrity.checked.length, notices: integrity.notices };
  } catch (error) {
    throw asJobError(error);
  }
}
