import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDb } from "@corniversity/db/client";
import { getEnv } from "@corniversity/db/env";
import { stopBoss } from "@corniversity/db/queue";
import { user } from "@corniversity/db/schema/auth";
import { providerCache, scholarlyIdentifier, scholarlyWork } from "@corniversity/db/schema/scholarly";
import { createFixtureScholarlyClient, type ScholarlyClient } from "@corniversity/db/scholarly/client";
import { ScholarlyProviderError } from "@corniversity/db/scholarly/errors";
import { ARXIV_MIN_SPACING_MS } from "@corniversity/db/scholarly/transport";
import { getWork, importByIdentifier, openArxivVersion, requestPrivateCopy } from "@corniversity/db/services/scholarly-works";
import { eq } from "drizzle-orm";
import type { PgBoss } from "pg-boss";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MAINTENANCE_SCHEDULES, NonRetryableError, scheduleMaintenance } from "./index";
import { maintenanceHandler } from "./maintenance";
import { ArxivGate, type ScholarlyHandlerContext, scholarlyArxivHandler, scholarlyRefreshHandler } from "./scholarly";

/**
 * The worker side of the research library: arXiv requests spaced at least 3.1 s apart (a fake
 * clock records every wait, so nothing actually sleeps), Retry-After closing the gate for every
 * later request, arXiv records applied with the fixture provider (recorded responses, labelled
 * `fixture`), a private copy promoted from a scripted PDF (the fixtures hold no PDF), refreshes,
 * the cache purge and the maintenance schedules.
 */
const OWNER = "scholarly-worker-owner";
const FIXTURES = join(__dirname, "../../../../packages/db/src/scholarly/fixtures");
let handle: ReturnType<typeof createDb>;
let dataRoot: string;
let fixture: ScholarlyClient;

function fakeClock() {
  let now = 1_000_000;
  const sleeps: number[] = [];
  return {
    clock: {
      now: () => now,
      sleep: async (ms: number) => {
        sleeps.push(ms);
        now += ms;
      },
    },
    advance: (ms: number) => {
      now += ms;
    },
    sleeps,
    at: () => now,
  };
}

function context(client: ScholarlyClient, gate: ArxivGate): ScholarlyHandlerContext {
  return {
    db: handle.db,
    env: { ...getEnv(), BLOB_STORE: "fs", CORNIVERSITY_DATA_ROOT: dataRoot },
    boss: {} as PgBoss,
    scholarly: client,
    arxivGate: gate,
  };
}

beforeAll(async () => {
  handle = createDb(process.env.DATABASE_URL!, { max: 3 });
  dataRoot = mkdtempSync(join(tmpdir(), "corniversity-scholarly-worker-"));
  fixture = createFixtureScholarlyClient({ dir: FIXTURES });
  await handle.db
    .insert(user)
    .values({ id: OWNER, name: "Scholarly Worker", email: "scholarly-worker@example.test" })
    .onConflictDoNothing();
});

afterAll(async () => {
  await stopBoss();
  await handle.close();
  rmSync(dataRoot, { recursive: true, force: true });
});

describe("the arXiv gate", () => {
  it("spaces requests at least 3.1 s apart and holds the slot after the last one", async () => {
    const time = fakeClock();
    const gate = new ArxivGate(time.clock);
    const starts: number[] = [];
    for (let i = 0; i < 3; i++) await gate.run(async () => starts.push(time.at()));
    expect(starts[1]! - starts[0]!).toBeGreaterThanOrEqual(ARXIV_MIN_SPACING_MS);
    expect(starts[2]! - starts[1]!).toBeGreaterThanOrEqual(ARXIV_MIN_SPACING_MS);
    await gate.drain();
    expect(time.at() - starts[2]!).toBeGreaterThanOrEqual(ARXIV_MIN_SPACING_MS);
  });

  it("honours arXiv's Retry-After for every later request", async () => {
    const time = fakeClock();
    const gate = new ArxivGate(time.clock);
    const limited = new ScholarlyProviderError("arxiv", "rate_limited", "limited", { status: 429, retryAfterSeconds: 120 });
    const failedAt = time.at();
    await expect(gate.run(async () => Promise.reject(limited))).rejects.toBe(limited);
    expect(gate.nextAllowed).toBe(failedAt + 120_000);
    let startedAt = 0;
    await gate.run(async () => {
      startedAt = time.at();
    });
    expect(startedAt - failedAt).toBeGreaterThanOrEqual(120_000);
  });
});

describe("scholarly-arxiv jobs", () => {
  it("applies the arXiv record with two spaced requests and holds the slot afterwards", async () => {
    const imported = await importByIdentifier(handle.db, OWNER, fixture, { scheme: "arxiv", value: "2305.18290" });
    const time = fakeClock();
    const gate = new ArxivGate(time.clock);
    const calls: { what: string; at: number }[] = [];
    const client: ScholarlyClient = {
      ...fixture,
      arxivEntries: async (ids, options) => {
        calls.push({ what: "entries", at: time.at() });
        return fixture.arxivEntries(ids, options);
      },
      arxivRaw: async (id, options) => {
        calls.push({ what: "raw", at: time.at() });
        return fixture.arxivRaw(id, options);
      },
    };
    const payload = {
      idempotencyKey: `record:${randomUUID()}`,
      ownerId: OWNER,
      task: "record",
      workId: imported.workId,
      arxivId: "2305.18290",
    };
    const result = await scholarlyArxivHandler(context(client, gate), payload);
    expect(result).toMatchObject({ workId: imported.workId, versions: 3 });
    expect(calls.map((c) => c.what)).toEqual(["entries", "raw"]);
    expect(calls[1]!.at - calls[0]!.at).toBeGreaterThanOrEqual(ARXIV_MIN_SPACING_MS);
    expect(time.at() - calls[1]!.at).toBeGreaterThanOrEqual(ARXIV_MIN_SPACING_MS);
    const detail = (await getWork(handle.db, OWNER, imported.workId))!;
    expect(detail.versions.map((v) => v.arxivVersion)).toEqual([1, 2, 3]);
    expect(detail.versions.every((v) => v.source === "fixture")).toBe(true);
  });

  it("a Retry-After beyond the transport's wait closes the gate and leaves the job to pg-boss's retry", async () => {
    const imported = await importByIdentifier(handle.db, OWNER, fixture, { scheme: "arxiv", value: "1706.03762" });
    const time = fakeClock();
    const gate = new ArxivGate(time.clock);
    const client: ScholarlyClient = {
      ...fixture,
      arxivEntries: async () => {
        throw new ScholarlyProviderError("arxiv", "rate_limited", "limited", { status: 429, retryAfterSeconds: 90 });
      },
    };
    const payload = {
      idempotencyKey: `record:${randomUUID()}`,
      ownerId: OWNER,
      task: "record",
      workId: imported.workId,
      arxivId: "1706.03762",
    };
    const startedAt = time.at();
    const error = await scholarlyArxivHandler(context(client, gate), payload).catch((e: unknown) => e);
    // Retryable: not a NonRetryableError, so pg-boss applies its retry policy.
    expect(error).toBeInstanceOf(ScholarlyProviderError);
    expect(error).not.toBeInstanceOf(NonRetryableError);
    // The job held its slot until arXiv's Retry-After had passed.
    expect(time.at() - startedAt).toBeGreaterThanOrEqual(90_000);
    expect(gate.nextAllowed).toBeLessThanOrEqual(time.at());
  });

  it("an identifier arXiv does not know fails without retries", async () => {
    const imported = await importByIdentifier(handle.db, OWNER, fixture, { scheme: "arxiv", value: "2611.99999" });
    const gate = new ArxivGate(fakeClock().clock);
    const client: ScholarlyClient = {
      ...fixture,
      arxivEntries: async () => ({
        provenance: { provider: "arxiv", source: "fixture", retrievedAt: new Date().toISOString(), stale: false },
        entries: [],
        missing: ["2611.99999"],
      }),
      arxivRaw: async () => {
        throw new ScholarlyProviderError("arxiv", "not_found", "no record");
      },
    };
    const payload = {
      idempotencyKey: `record:${randomUUID()}`,
      ownerId: OWNER,
      task: "record",
      workId: imported.workId,
      arxivId: "2611.99999",
    };
    const error = await scholarlyArxivHandler(context(client, gate), payload).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NonRetryableError);
    expect((error as Error).message).toBe("arXiv has no record of this identifier.");
  });

  it("keeps a private copy: the linked Document is promoted and extraction is queued", async () => {
    const imported = await importByIdentifier(handle.db, OWNER, fixture, { scheme: "arxiv", value: "2305.18290" });
    const gate = new ArxivGate(fakeClock().clock);
    await scholarlyArxivHandler(context(fixture, gate), {
      idempotencyKey: `record:${randomUUID()}`,
      ownerId: OWNER,
      task: "record",
      workId: imported.workId,
      arxivId: "2305.18290",
    });
    const linked = await openArxivVersion(handle.db, OWNER, imported.workId, "2305.18290", 3);
    expect((await requestPrivateCopy(handle.db, OWNER, linked.id)).queued).toBe(true);
    // In fixture mode arXiv's PDF is the fixture provider's labelled stand-in (packages/db/src/scholarly/fixture-pdf.ts).
    const result = await scholarlyArxivHandler(context(fixture, gate), {
      idempotencyKey: `copy:${randomUUID()}`,
      ownerId: OWNER,
      task: "private-copy",
      assetId: linked.id,
    });
    expect(result).toMatchObject({ assetId: linked.id, outcome: "promoted", extractionQueued: true });
    const detail = (await getWork(handle.db, OWNER, imported.workId))!;
    const doc = detail.documents.find((d) => d.asset.id === linked.id)!;
    expect(doc.asset.status).toBe("processing");
    expect(doc.permissions.private_cloud_store.basis).toMatch(/^licence reported by arXiv OAI-PMH on 2026-11-15 for v3: /);
  });

  it("listings go into the provider cache only", async () => {
    const gate = new ArxivGate(fakeClock().clock);
    const result = await scholarlyArxivHandler(context(fixture, gate), {
      idempotencyKey: `listing:${randomUUID()}`,
      task: "listing",
      categories: ["math.*"],
      maxResults: 5,
    });
    expect(result).toMatchObject({ categories: ["math.*"], entries: 5 });
  });
});

describe("scholarly-refresh jobs", () => {
  it("refreshes a work and its integrity notices; a DOI with no recorded Crossref answer is reported, never invented", async () => {
    const imported = await importByIdentifier(handle.db, OWNER, fixture, { scheme: "doi", value: "10.7717/peerj.4375" });
    const gate = new ArxivGate(fakeClock().clock);
    // Crossref's answers for the paper's two Zenodo DOIs were never recorded: the job completes, checks the
    // recorded PeerJ DOI, names the other two as unchecked in fixture mode, and the work is not marked checked.
    const refreshed = await scholarlyRefreshHandler(context(fixture, gate), {
      idempotencyKey: `refresh:${randomUUID()}`,
      ownerId: OWNER,
      task: "work",
      workId: imported.workId,
    });
    expect(refreshed).toMatchObject({ workId: imported.workId, integrityChecked: 1 });
    expect([...(refreshed.unrecorded as string[])].sort()).toEqual(["10.5281/zenodo.18201069", "10.5281/zenodo.18201070"]);
    expect((await getWork(handle.db, OWNER, imported.workId))!.work.integrityCheckedAt).toBeNull();
    // An unrecorded OpenAlex lookup still fails without retries: there is no record to refresh from.
    const [bare] = await handle.db.insert(scholarlyWork).values({ ownerId: OWNER, title: "No recorded OpenAlex record" }).returning();
    await handle.db
      .insert(scholarlyIdentifier)
      .values({ ownerId: OWNER, workId: bare!.id, scheme: "openalex", value: "W1", source: "fixture" });
    const error = await scholarlyRefreshHandler(context(fixture, gate), {
      idempotencyKey: `refresh:${randomUUID()}`,
      ownerId: OWNER,
      task: "work",
      workId: bare!.id,
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NonRetryableError);
    // Crossref's recorded answer for the retracted Lancet paper (Retraction Watch notices).
    const [work] = await handle.db.insert(scholarlyWork).values({ ownerId: OWNER, title: "A retracted paper" }).returning();
    await handle.db
      .insert(scholarlyIdentifier)
      .values({ ownerId: OWNER, workId: work!.id, scheme: "doi", value: "10.1016/s0140-6736(97)11096-0", source: "fixture" });
    const integrity = await scholarlyRefreshHandler(context(fixture, gate), {
      idempotencyKey: `integrity:${randomUUID()}`,
      ownerId: OWNER,
      task: "integrity",
      workId: work!.id,
    });
    expect(integrity).toMatchObject({ workId: work!.id, integrityChecked: 1, notices: 2 });
    expect((await getWork(handle.db, OWNER, work!.id))!.integrityNotices.some((n) => n.type === "retraction")).toBe(true);
  });
});

describe("maintenance", () => {
  it("purges expired provider responses", async () => {
    const old = new Date(Date.now() - 40 * 86_400_000);
    await handle.db
      .insert(providerCache)
      .values({
        key: "b".repeat(64),
        provider: "arxiv",
        status: 200,
        payload: { contentType: null, body: "" },
        fetchedAt: old,
        expiresAt: old,
      })
      .onConflictDoNothing();
    const result = await maintenanceHandler(context(fixture, new ArxivGate()), {
      idempotencyKey: "maintenance:test",
      task: "purge-provider-cache",
    });
    expect(result.expiredCacheRows).toBeGreaterThanOrEqual(1);
    expect(
      await handle.db
        .select()
        .from(providerCache)
        .where(eq(providerCache.key, "b".repeat(64))),
    ).toEqual([]);
  });

  it("gives every maintenance schedule its own key, so none replaces another", async () => {
    const scheduled: { cron: string; key?: string; task: string }[] = [];
    const unscheduled: string[] = [];
    await scheduleMaintenance({
      schedule: async (_name: string, cron: string, data?: object | null, options?: { key?: string }) => {
        scheduled.push({ cron, key: options?.key, task: (data as { task: string }).task });
      },
      unschedule: async (_name: string, key?: string) => {
        unscheduled.push(key ?? "");
      },
    } as unknown as Pick<PgBoss, "schedule" | "unschedule">);
    expect(unscheduled).toEqual([""]);
    expect(scheduled.map((s) => s.task)).toEqual(MAINTENANCE_SCHEDULES.map((s) => s.task));
    expect(new Set(scheduled.map((s) => s.key)).size).toBe(scheduled.length);
    expect(scheduled.find((s) => s.task === "purge-provider-cache")?.cron).toBe("0 5 * * *");
  });
});
