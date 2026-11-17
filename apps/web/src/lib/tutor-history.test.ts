import type { EvidenceRef } from "@corniversity/core/grounding/citations";
import { describe, expect, it, vi } from "vitest";
import { tutorHistory } from "./tutor-history";

const source: EvidenceRef = { tag: "E1", label: "Private reading", assetId: "asset", passageId: "passage" };
const learner = { sender: "learner", contentMarkdown: "Explain the proof.", citations: [] };
const reply = { sender: "persona", contentMarkdown: "SOURCE WORDS [E1]", citations: [source] };

describe("source permissions in replayed tutor history", () => {
  it.each(["revoked", "deleted", "error"])("omits %s source replies while retaining the new question", async (state) => {
    const check = vi.fn(async () => {
      if (state === "error") throw new Error("unavailable");
      return false;
    });
    const history = await tutorHistory([learner, reply], "A new question", check);
    expect(history.chat.map((m) => m.content).join("\n")).not.toContain("SOURCE WORDS");
    expect(history.chat.at(-1)?.content).toBe("A new question");
    expect(history.omitted).toBe(1);
    expect(history.sourceRefs).toEqual([]);
    expect(reply.contentMarkdown).toBe("SOURCE WORDS [E1]");
  });
  it("retains valid replies and their identities for the final dispatch recheck, checking duplicates once", async () => {
    const check = vi.fn(async () => true);
    const history = await tutorHistory([learner, reply, learner, reply], "Continue", check);
    expect(history.chat.some((m) => m.content.includes("SOURCE WORDS"))).toBe(true);
    expect(history.sourceRefs).toEqual([source, source]);
    expect(check).toHaveBeenCalledOnce();
    expect(history.omitted).toBe(0);
  });
  it("does not query citations from text outside the bounded context", async () => {
    const check = vi.fn(async () => false);
    const history = await tutorHistory([learner, { ...reply, contentMarkdown: "x".repeat(30_000) }, learner], "Continue", check);
    expect(check).not.toHaveBeenCalled();
    expect(history.sourceRefs).toEqual([]);
    expect(history.chat.at(-1)?.content).toBe("Continue");
  });
});
