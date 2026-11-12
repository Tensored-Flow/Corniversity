import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createFixture, type Fixture } from "../../test/fixtures";
import { PgBlobStore } from "../blob";
import { createDb } from "../client";
import { extractedPage, passage, resourceAsset, source, sourceVersion } from "../schema/index";
import { deleteAsset, permittedPassagesForCourse, setPermission, sourcePassagesStillPermitted } from "./library";

let handle: ReturnType<typeof createDb>;
let fx: Fixture;
let other: Fixture;
const prefix = randomUUID();
const sourceIds = [`source-evidence-a-${prefix}`, `source-evidence-b-${prefix}`];
const assetIds: string[] = [];

beforeAll(async () => {
  handle = createDb(process.env.DATABASE_URL!, { max: 3 });
  fx = await createFixture(handle.db, "source-evidence");
  other = await createFixture(handle.db, "other-evidence");
  for (const id of sourceIds) {
    await handle.db
      .insert(source)
      .values({ id, title: "Test source", kind: "notes", canonicalUrl: "https://example.test/source", currentVersionId: `${id}-v1` });
    await handle.db.insert(sourceVersion).values({
      id: `${id}-v1`,
      sourceId: id,
      label: "Test edition",
      url: "https://example.test/source",
      verifiedAt: "2026-11-12",
      verifiedBy: "test fixture",
      licence: "Authored test text",
      accessStatus: "open",
      importAllowed: false,
    });
  }
  for (const variant of ["wanted", "other-source", "other-course", "other-owner", "local-only"] as const) {
    const id = randomUUID();
    assetIds.push(id);
    const ownerId = variant === "other-owner" ? other.ownerId : fx.ownerId;
    await handle.db.insert(resourceAsset).values({
      id,
      ownerId,
      sourceVersionId: `${sourceIds[variant === "other-source" ? 1 : 0]}-v1`,
      filename: `${variant}.txt`,
      mediaType: "text/plain",
      sizeBytes: 100,
      sha256: randomUUID(),
      status: "processed",
      origin: "web_upload",
      localOnly: variant === "local-only",
      courseIds: [variant === "other-course" ? other.courseId : fx.courseId],
    });
    const text = `Cauchy completeness evidence from ${variant}. Every Cauchy sequence converges in a complete metric space.`;
    const [page] = await handle.db
      .insert(extractedPage)
      .values({
        assetId: id,
        physicalIndex: 0,
        text,
        charCount: text.length,
        quality: { scannedSuspected: false, lowText: false, invisibleText: 0, imageCoverage: 0 },
      })
      .returning();
    await handle.db.insert(passage).values({ assetId: id, pageId: page!.id, ordinal: 0, text });
    await setPermission(handle.db, ownerId, id, "external_ai", "allowed", "Authored test data");
  }
});

afterAll(async () => {
  await fx.cleanup();
  await other.cleanup();
  for (const id of sourceIds) await handle.db.delete(source).where(eq(source.id, id));
  await handle.close();
});

describe("course authoring source boundary", () => {
  it("retrieves only the owner's course-assigned, non-local source edition", async () => {
    const got = await permittedPassagesForCourse(handle.db, fx.ownerId, fx.courseId, "Cauchy", 8, [`${sourceIds[0]}-v1`]);
    expect(got.map((p) => p.asset_id)).toEqual([assetIds[0]]);
    expect(got[0]!.text).toContain("wanted");
  });

  it("does not broaden an empty source scope to the entire library", async () => {
    expect(await permittedPassagesForCourse(handle.db, fx.ownerId, fx.courseId, "Cauchy", 8, [])).toEqual([]);
  });

  it("removes a passage on the next retrieval after consent is withdrawn", async () => {
    await setPermission(handle.db, fx.ownerId, assetIds[0]!, "external_ai", "denied", "Withdrawn");
    expect(await permittedPassagesForCourse(handle.db, fx.ownerId, fx.courseId, "Cauchy", 8, [`${sourceIds[0]}-v1`])).toEqual([]);
  });
});

describe("cached passage dispatch boundary", () => {
  it.each(["external-ai", "private-storage", "deleted", "course", "edition", "passage", "owner", "processing"])(
    "rejects captured evidence after %s changes",
    async (change) => {
      const assetId = randomUUID();
      const blobs = new PgBlobStore(handle.db);
      const stored = await blobs.put(Buffer.from(`source boundary ${assetId}`));
      await handle.db.insert(resourceAsset).values({
        id: assetId,
        ownerId: fx.ownerId,
        sourceVersionId: `${sourceIds[0]}-v1`,
        filename: "captured.txt",
        mediaType: "text/plain",
        sizeBytes: 20,
        sha256: randomUUID(),
        status: "processed",
        origin: "companion",
        localOnly: false,
        courseIds: [fx.courseId],
        storageKey: stored.key,
      });
      const [page] = await handle.db
        .insert(extractedPage)
        .values({
          assetId,
          physicalIndex: 0,
          text: "Cauchy evidence",
          charCount: 15,
          quality: { scannedSuspected: false, lowText: false, invisibleText: 0, imageCoverage: 0 },
        })
        .returning();
      const [p] = await handle.db.insert(passage).values({ assetId, pageId: page!.id, ordinal: 0, text: "Cauchy evidence" }).returning();
      await setPermission(handle.db, fx.ownerId, assetId, "external_ai", "allowed", "Test consent");
      const captured = [{ assetId, passageId: p!.id, sourceVersionId: `${sourceIds[0]}-v1` }];
      const check = () => sourcePassagesStillPermitted(handle.db, fx.ownerId, fx.courseId, captured, [`${sourceIds[0]}-v1`]);
      expect(await check()).toBe(true);
      if (change === "external-ai") await setPermission(handle.db, fx.ownerId, assetId, "external_ai", "denied", "Withdrawn");
      if (change === "private-storage")
        await setPermission(handle.db, fx.ownerId, assetId, "private_cloud_store", "denied", "Withdrawn", blobs);
      if (change === "deleted") await deleteAsset(handle.db, blobs, fx.ownerId, assetId);
      if (change === "course")
        await handle.db
          .update(resourceAsset)
          .set({ courseIds: [other.courseId] })
          .where(eq(resourceAsset.id, assetId));
      if (change === "edition")
        await handle.db
          .update(resourceAsset)
          .set({ sourceVersionId: `${sourceIds[1]}-v1` })
          .where(eq(resourceAsset.id, assetId));
      if (change === "passage") await handle.db.delete(passage).where(eq(passage.id, p!.id));
      if (change === "owner") await handle.db.update(resourceAsset).set({ ownerId: other.ownerId }).where(eq(resourceAsset.id, assetId));
      if (change === "processing") await handle.db.update(resourceAsset).set({ status: "processing" }).where(eq(resourceAsset.id, assetId));
      expect(await check()).toBe(false);
      await blobs.delete(stored.key);
    },
  );
  it("permits location-only pointers but rejects partial or mismatched passage identities", async () => {
    expect(await sourcePassagesStillPermitted(handle.db, fx.ownerId, fx.courseId, [{}])).toBe(true);
    expect(await sourcePassagesStillPermitted(handle.db, fx.ownerId, fx.courseId, [{ assetId: assetIds[0] }])).toBe(false);
    expect(
      await sourcePassagesStillPermitted(handle.db, fx.ownerId, fx.courseId, [{ assetId: randomUUID(), passageId: randomUUID() }]),
    ).toBe(false);
  });
});
