import type { DbOrTx } from "@corniversity/db/client";
import type { Env } from "@corniversity/db/env";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ plan: vi.fn(), finish: vi.fn(), record: vi.fn(), stream: vi.fn() }));
vi.mock("@corniversity/db/services/ai-runs", () => ({ planRun: mocks.plan }));
vi.mock("@corniversity/db/services/provider-config", () => ({ finishProviderRun: mocks.finish, recordProviderRun: mocks.record }));

import { collectPersonaText, streamPersonaTurn, type TurnInput } from "./model-runs";

const input: TurnInput = {
  database: {} as DbOrTx,
  env: {} as Env,
  ownerId: "owner",
  role: "tutor",
  purpose: "tutor-question",
  promptVersion: "test",
  system: "Cached source text",
  messages: [{ role: "user", content: "Explain this." }],
  scenario: "test",
  speaker: "Tutor",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.plan.mockResolvedValue({
    kind: "live",
    provider: { streamText: mocks.stream },
    runId: "reserved",
    model: "claude-opus-5-5",
    maxTokens: 1000,
    effort: "medium",
    worstCaseUsd: 0.1,
    warnings: [],
    state: { mode: "api", provider: "anthropic", model: "claude-opus-5-5" },
  });
});

describe("persona source recheck at dispatch", () => {
  it.each([false, "error"] as const)(
    "blocks the streamed provider and releases its reservation when the final check returns %s",
    async (outcome) => {
      const guard = vi.fn(async () => {
        expect(mocks.plan).toHaveBeenCalledOnce();
        if (outcome === "error") throw new Error("database unavailable");
        return outcome;
      });
      const response = await streamPersonaTurn({ ...input, sourcesStillPermitted: guard, onFinish: vi.fn() });
      expect(await response.text()).toContain("No text was sent; your work is saved.");
      expect(guard).toHaveBeenCalledOnce();
      expect(mocks.stream).not.toHaveBeenCalled();
      expect(mocks.finish).toHaveBeenCalledWith(input.database, "reserved", expect.objectContaining({ status: "blocked", attempts: [] }));
    },
  );
  it("also protects collected persona turns", async () => {
    const result = await collectPersonaText({ ...input, sourcesStillPermitted: async () => false });
    expect(result).toMatchObject({ kind: "done", status: "blocked" });
    expect(mocks.stream).not.toHaveBeenCalled();
    expect(mocks.finish).toHaveBeenCalledWith(input.database, "reserved", expect.objectContaining({ status: "blocked", attempts: [] }));
  });
});
