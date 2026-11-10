import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createFixture, type Fixture } from "../../test/fixtures";
import { createDb } from "../client";
import { learnerProfile, revisionItem } from "../schema/index";
import {
  createLearnerIssue,
  deleteIssue,
  IssueError,
  listIssues,
  proposeIssueFromCheck,
  resolveIssuesFromSubmission,
  respondToIssue,
} from "./learning-issues";
import { nextReviewItems, ReviewError, reviewItem, saveReviewSettings, setItemStatus, snoozeItem } from "./revision";

/**
 * Learning issues and bounded review against PostgreSQL: an issue from a failed check is a
 * proposal; the learner corrects and confirms it; later work resolves it and it stops being
 * current; a pure question is never an issue; review offers a small set and never a backlog.
 */
let handle: ReturnType<typeof createDb>;
let fx: Fixture;

beforeAll(async () => {
  handle = createDb(process.env.DATABASE_URL!, { max: 2 });
  fx = await createFixture(handle.db, "issues");
  await handle.db.insert(learnerProfile).values({ userId: fx.ownerId, displayName: "Issue Tester" }).onConflictDoNothing();
});

afterAll(async () => {
  await fx.cleanup();
  await handle.close();
});

const check = (submissionVersionId: string, checkId = "finite-dim") => ({
  ownerId: fx.ownerId,
  conceptId: fx.conceptId,
  exerciseId: fx.exerciseId,
  submissionVersionId,
  assessmentRunId: randomUUID(),
  checkId,
  statement: "Submission v1 of “Two norms”: the text claims all norms are equivalent without the finite-dimension hypothesis.",
  version: 1,
});

describe("learning issues", () => {
  it("proposes an issue from a failed check once, then the learner corrects it and later work resolves it", async () => {
    const v1 = randomUUID();
    const proposed = await proposeIssueFromCheck(handle.db, check(v1));
    expect(proposed).toMatchObject({ status: "proposed", origin: "check", checkId: "finite-dim" });
    expect(await proposeIssueFromCheck(handle.db, check(v1))).toBeNull(); // not duplicated
    const corrected = "This application of the equivalence theorem omitted its finite-dimension hypothesis.";
    const confirmed = await respondToIssue(handle.db, fx.ownerId, proposed!.id, { kind: "confirm", statement: corrected });
    expect(confirmed).toMatchObject({ status: "confirmed", claim: corrected });
    const [review] = await handle.db.select().from(revisionItem).where(eq(revisionItem.issueId, proposed!.id));
    expect(review).toMatchObject({ kind: "issue", status: "active" });

    // A later submission passes the same check: the issue is resolved, naming that submission.
    const v2 = randomUUID();
    expect(
      await resolveIssuesFromSubmission(handle.db, {
        ownerId: fx.ownerId,
        exerciseId: fx.exerciseId,
        submissionVersionId: v2,
        version: 2,
        passedCheckIds: ["finite-dim"],
      }),
    ).toBe(1);
    const current = await listIssues(handle.db, fx.ownerId, { current: true });
    expect(current.map((r) => r.issue.id)).not.toContain(proposed!.id);
    const all = await listIssues(handle.db, fx.ownerId);
    expect(all.find((r) => r.issue.id === proposed!.id)?.issue).toMatchObject({
      status: "resolved",
      resolvedBy: { submissionVersionId: v2 },
    });
    const [archived] = await handle.db.select().from(revisionItem).where(eq(revisionItem.issueId, proposed!.id));
    expect(archived?.status).toBe("archived");
  });

  it("lets the learner dispute a proposal, reopen, record their own issue and delete one", async () => {
    const issue = await proposeIssueFromCheck(handle.db, check(randomUUID(), "another-check"));
    await expect(respondToIssue(handle.db, fx.ownerId, issue!.id, { kind: "dispute", note: "" })).rejects.toThrow(IssueError);
    expect(
      await respondToIssue(handle.db, fx.ownerId, issue!.id, { kind: "dispute", note: "The hypothesis is stated in line 2." }),
    ).toMatchObject({
      status: "dismissed",
    });
    expect(await respondToIssue(handle.db, fx.ownerId, issue!.id, { kind: "reopen" })).toMatchObject({ status: "confirmed" });
    await expect(respondToIssue(handle.db, "someone-else", issue!.id, { kind: "revisit" })).rejects.toThrow(/not found/);
    const mine = await createLearnerIssue(handle.db, fx.ownerId, {
      statement: "I used the triangle inequality in the wrong direction in step 3.",
    });
    expect(mine).toMatchObject({ origin: "learner", status: "confirmed" });
    await deleteIssue(handle.db, fx.ownerId, mine.id);
    expect((await listIssues(handle.db, fx.ownerId)).map((r) => r.issue.id)).not.toContain(mine.id);
  });

  it("never records a label about the person", async () => {
    const labelled = await proposeIssueFromCheck(handle.db, {
      ...check(randomUUID(), "label-check"),
      statement: "The learner is weak at analysis.",
    });
    expect(labelled).toBeNull();
  });
});

describe("bounded review", () => {
  it("offers at most five items within the weekly number, pauses, snoozes and archives, and builds no backlog", async () => {
    const now = new Date("2026-11-10T12:00:00Z"); // a Tuesday
    const old = new Date("2026-10-01T12:00:00Z");
    await handle.db.insert(revisionItem).values(
      Array.from({ length: 12 }, (_, i) => ({
        ownerId: fx.ownerId,
        conceptId: fx.conceptId,
        kind: "definition" as const,
        prompt: `Item ${i}`,
        dueAt: old,
        intervalDays: 2,
      })),
    );
    await saveReviewSettings(handle.db, fx.ownerId, { budgetPerWeek: 7 });
    let next = await nextReviewItems(handle.db, fx.ownerId, now);
    expect(next.set.kind).toBe("offered");
    expect(next.items.length).toBeLessThanOrEqual(5);
    expect(next.set.dueCount).toBeGreaterThanOrEqual(12);

    // Reviewing two uses two of the week's seven; the next set shrinks only by the budget.
    for (const item of next.items.slice(0, 2)) await reviewItem(handle.db, fx.ownerId, item.id, "recalled", now);
    next = await nextReviewItems(handle.db, fx.ownerId, now);
    expect(next.reviewedThisWeek).toBe(2);
    expect(next.items.length).toBeLessThanOrEqual(5);

    await snoozeItem(handle.db, fx.ownerId, next.items[0]!.id, 3, now);
    await setItemStatus(handle.db, fx.ownerId, next.items[1]!.id, "archived");
    const after = await nextReviewItems(handle.db, fx.ownerId, now);
    expect(after.items.map((i) => i.id)).not.toContain(next.items[0]!.id);
    expect(after.items.map((i) => i.id)).not.toContain(next.items[1]!.id);

    await saveReviewSettings(handle.db, fx.ownerId, { restWeekdays: [2] });
    expect((await nextReviewItems(handle.db, fx.ownerId, now)).set.kind).toBe("rest_day");
    await saveReviewSettings(handle.db, fx.ownerId, { restWeekdays: [], paused: true });
    expect((await nextReviewItems(handle.db, fx.ownerId, now)).set.kind).toBe("paused");
    await expect(saveReviewSettings(handle.db, fx.ownerId, { budgetPerWeek: 0 })).rejects.toThrow(ReviewError);
  });
});
