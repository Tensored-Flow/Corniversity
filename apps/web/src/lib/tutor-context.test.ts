import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({ getUnitDetail: vi.fn(), getSession: vi.fn(), getAttemptHistory: vi.fn(), runningExamFor: vi.fn() }));
vi.mock("@corniversity/db/services/catalogue", () => ({ getUnitDetail: storage.getUnitDetail }));
vi.mock("@corniversity/db/services/learning", () => ({
  getSession: storage.getSession,
  getAttemptHistory: storage.getAttemptHistory,
  runningExamFor: storage.runningExamFor,
  IN_RUNNING_EXAM: "An exam is in progress.",
}));

import type { DbOrTx } from "@corniversity/db/client";
import { tutorAttachments } from "./tutor-context";

const proof = `Let the ambient space be complete. ${"An intermediate inference. ".repeat(100)}FINAL INFERENCE: the limit lies in the closed subspace.`;
const lesson = "The supplied lecture notes explain closed subspaces and completeness.";
const request = { sessionId: "session", exerciseId: "exercise", mode: "discuss_approach" as const, scope: "unit" as const };

beforeEach(() => {
  vi.clearAllMocks();
  storage.getSession.mockResolvedValue({ id: "session", unitId: "unit", activityId: "activity" });
  storage.getUnitDetail.mockResolvedValue({
    course: { id: "MAT-230" },
    unit: { id: "unit", title: "Completeness", lessonMarkdown: lesson, activities: [{ id: "activity" }] },
    exercises: [{ id: "exercise", title: "Prove completeness", hintLadder: ["Construct a limit."], progression: {} }],
  });
  storage.getAttemptHistory.mockResolvedValue([
    { attempt: { draftMarkdown: proof, draftRevision: 4, mode: "practice", hintsUsed: 1 }, versions: [] },
  ]);
  storage.runningExamFor.mockResolvedValue(null);
});

describe("the tutor's actual attachment contract", () => {
  it("attaches current lecture notes and the complete saved proof, and previews what will be sent", async () => {
    const got = await tutorAttachments({} as DbOrTx, "owner", request);
    expect(got.ok).toBe(true);
    if (!got.ok) throw new Error("missing context");
    expect(got.attemptContext.text).toBe(proof);
    expect(got.attemptContext.text).toContain("FINAL INFERENCE");
    expect(got.lessonContext.text).toBe(lesson);
    expect(got.attached.join(" ")).toContain("Complete text");
    expect(got.notAttached.join(" ")).toContain("reference solution");
  });

  it("uses the submitted proof when the draft is empty", async () => {
    storage.getAttemptHistory.mockResolvedValue([
      { attempt: { draftMarkdown: "", mode: "practice" }, versions: [{ version: 2, contentMarkdown: proof }] },
    ]);
    const got = await tutorAttachments({} as DbOrTx, "owner", request);
    if (!got.ok) throw new Error("missing context");
    expect(got.attemptContext.text).toBe(proof);
    expect(got.attached.join(" ")).toContain("submission (v2)");
  });

  it("retains the existing exam boundary despite the richer teaching context", async () => {
    storage.runningExamFor.mockResolvedValue({ id: "exam" });
    const got = await tutorAttachments({} as DbOrTx, "owner", { ...request, mode: "full_explanation" });
    if (!got.ok) throw new Error("missing context");
    expect(got.decision).toEqual({ allowed: false, reason: "An exam is in progress." });
  });

  it("discloses a long proof excerpt in the same preview and payload", async () => {
    const longProof = `Assumptions. ${"x".repeat(35_000)}LAST STEP`;
    storage.getAttemptHistory.mockResolvedValue([{ attempt: { draftMarkdown: longProof, mode: "practice" }, versions: [] }]);
    const got = await tutorAttachments({} as DbOrTx, "owner", request);
    if (!got.ok) throw new Error("missing context");
    expect(got.attemptContext.truncated).toBe(true);
    expect(got.attemptContext.text).toContain("LAST STEP");
    expect(got.attached.join(" ")).toContain(got.attemptContext.note);
  });
});
