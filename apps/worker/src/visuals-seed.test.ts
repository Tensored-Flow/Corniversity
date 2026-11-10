import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultContentRoot, loadContent } from "@corniversity/content/load";
import type { LoadedVisual } from "@corniversity/content/schema";
import { seedContent, seedVisuals } from "@corniversity/content/seed";
import { storyboardHash, type VisualSpec } from "@corniversity/core/visuals/visual";
import { createBlobStore } from "@corniversity/db/blob";
import { createDb } from "@corniversity/db/client";
import { user } from "@corniversity/db/schema/auth";
import { attempt, visualExplanation } from "@corniversity/db/schema/index";
import { getVisualForLearner, listUnitVisuals, VisualError, visualFilm } from "@corniversity/db/services/visuals";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Visual explanations against PostgreSQL: a film is stored only when it was recorded from the
 * current storyboard, re-seeding unchanged content changes nothing, a corrected storyboard drops
 * the stale film and removes its blob, drafts are never offered, and an answer-revealing visual
 * (and its film) stays closed until the learner has attempted or revealed its exercise.
 */
let handle: ReturnType<typeof createDb>;
const dir = mkdtempSync(join(tmpdir(), "visuals-"));
const s = randomUUID().slice(0, 8);
const ownerId = `visual-owner-${s}`;
const slugs = [`fixture-visual-${s}`, `fixture-draft-${s}`];
const film = Buffer.from(`not really a webm, but bytes all the same ${s}`);

const spec: VisualSpec = {
  slug: slugs[0]!,
  title: "Fixture visual",
  origin: "original",
  status: "checked",
  version: 1,
  unitIds: ["MAT-230-u01"],
  objective: "See that no constant bounds the sup norm by the integral norm.",
  sourceLocatorIds: [],
  revealsExerciseIds: ["MAT-230-u01-ex1"],
  scenes: [
    {
      id: "family",
      title: "The family",
      caption: "x^n on [0, 1].",
      equations: [],
      plot: { kind: "power_family", exponents: [1, 5], shadeLast: true },
      plotDescription: "Two curves.",
      durationSeconds: 5,
    },
  ],
  checks: [{ kind: "power_l1", id: "l1", exponents: [1, 5] }],
};

function loaded(next: VisualSpec, withFilm: boolean): LoadedVisual {
  const filmPath = join(dir, "film.webm");
  writeFileSync(filmPath, film);
  return { spec: next, dir, filmPath: withFilm ? filmPath : null, filmBytes: withFilm ? film.length : null };
}

const render = (of: VisualSpec) => ({
  file: "film.webm",
  captionsFile: "captions.vtt",
  storyboardHash: storyboardHash(of),
  durationSeconds: 5,
  renderedAt: "2026-11-10T00:00:00Z",
  tool: "test",
  leadInSeconds: 0,
});

beforeAll(async () => {
  handle = createDb(process.env.DATABASE_URL!, { max: 2 });
  await seedContent(handle.db, loadContent(defaultContentRoot()));
  await handle.db.insert(user).values({ id: ownerId, name: "Visual Owner", email: `${ownerId}@example.test` });
}, 120_000);

afterAll(async () => {
  await handle.db.delete(visualExplanation).where(inArray(visualExplanation.slug, slugs));
  await handle.db.delete(attempt).where(eq(attempt.ownerId, ownerId));
  await handle.db.delete(user).where(eq(user.id, ownerId));
  await handle.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("visual explanations", () => {
  const blobs = () => createBlobStore("fs", handle.db, dir);

  it("stores a film recorded from the current storyboard, once", async () => {
    const first = await seedVisuals(handle.db, [loaded({ ...spec, render: render(spec) }, true)], blobs());
    expect(first).toEqual({ visuals: 1, visualFilmsStored: 1 });
    const again = await seedVisuals(handle.db, [loaded({ ...spec, render: render(spec) }, true)], blobs());
    expect(again).toEqual({ visuals: 0, visualFilmsStored: 0 });
    const [row] = await handle.db.select().from(visualExplanation).where(eq(visualExplanation.slug, spec.slug));
    expect(row?.filmBlobKey).toBeTruthy();
    expect(row?.filmStale).toBeNull();
    expect(row?.checkResults.every((c) => c.passed)).toBe(true);
  });

  it("keeps an answer-revealing visual and its film closed until the exercise is attempted or revealed", async () => {
    const [listed] = (await listUnitVisuals(handle.db, ownerId, "MAT-230-u01")).filter((v) => v.slug === spec.slug);
    expect(listed?.gate.open).toBe(false);
    expect(listed?.gate.waitingFor[0]?.id).toBe("MAT-230-u01-ex1");
    expect(listed?.gate.waitingFor[0]?.title).not.toBe("MAT-230-u01-ex1");
    await expect(visualFilm(handle.db, blobs(), ownerId, spec.slug)).rejects.toThrow(VisualError);

    // An attempt that was never submitted does not open it; choosing to see the reasoning does.
    const [a] = await handle.db.insert(attempt).values({ ownerId, exerciseId: "MAT-230-u01-ex1" }).returning();
    expect((await getVisualForLearner(handle.db, ownerId, spec.slug))?.gate.open).toBe(false);
    await handle.db.update(attempt).set({ solutionRevealedAt: new Date() }).where(eq(attempt.id, a!.id));
    expect((await getVisualForLearner(handle.db, ownerId, spec.slug))?.gate.open).toBe(true);
    const { bytes } = await visualFilm(handle.db, blobs(), ownerId, spec.slug);
    expect(bytes.equals(film)).toBe(true);
  });

  it("drops a film made from an older storyboard and removes its blob", async () => {
    const [before] = await handle.db.select().from(visualExplanation).where(eq(visualExplanation.slug, spec.slug));
    const corrected = { ...spec, objective: "Corrected objective." };
    const result = await seedVisuals(handle.db, [loaded({ ...corrected, render: render(spec) }, true)], blobs());
    expect(result).toEqual({ visuals: 1, visualFilmsStored: 0 });
    const [after] = await handle.db.select().from(visualExplanation).where(eq(visualExplanation.slug, spec.slug));
    expect(after?.filmBlobKey).toBeNull();
    expect(after?.filmStale).toMatch(/older|recorded from storyboard/);
    expect(after?.version).toBe((before?.version ?? 0) + 1);
    expect(await blobs().exists(before!.filmBlobKey!)).toBe(false);
    await expect(visualFilm(handle.db, blobs(), ownerId, spec.slug)).rejects.toThrow("no_film");
  });

  it("never offers a draft", async () => {
    await seedVisuals(handle.db, [loaded({ ...spec, slug: slugs[1]!, status: "draft", revealsExerciseIds: [] }, false)]);
    expect(await getVisualForLearner(handle.db, ownerId, slugs[1]!)).toBeNull();
    expect((await listUnitVisuals(handle.db, ownerId, "MAT-230-u01")).some((v) => v.slug === slugs[1])).toBe(false);
  });
});
