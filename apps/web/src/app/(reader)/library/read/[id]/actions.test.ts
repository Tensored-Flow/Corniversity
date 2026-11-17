import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * *Keep my notes on the new file* (keepNotesOnNewFileAction): any client can call a server action
 * with any arguments, so a missing or malformed file report gets the registered sentence and never
 * reaches the service. The session, the database and the services are mocked; the action is real.
 */
const mocks = vi.hoisted(() => ({ accepted: [] as unknown[] }));

vi.mock("@/lib/session", () => ({ requireSession: async () => ({ user: { id: "owner-1" } }) }));
vi.mock("@/lib/db", () => ({ db: () => ({}) }));
vi.mock("next/navigation", () => ({ redirect: () => undefined }));
vi.mock("./companion-data", () => ({ companionAnswerView: async () => null }));
vi.mock("@corniversity/db/services/companion", () => ({ CompanionError: class CompanionError extends Error {} }));
vi.mock("@corniversity/db/services/reader", () => ({ readerDocument: async () => null }));
vi.mock("@corniversity/db/services/library", () => ({ LibraryError: class LibraryError extends Error {} }));
vi.mock("@corniversity/db/services/scholarly-works", () => ({
  ScholarlyError: class ScholarlyError extends Error {},
  acceptNewFile: async (_db: unknown, _owner: string, _asset: string, input: unknown) => {
    mocks.accepted.push(input);
    return { accepted: true, problems: [] };
  },
}));

const { keepNotesOnNewFileAction } = await import("./actions");
const { ERROR_NOTICES } = await import("@/lib/notices");

const ASSET = "11111111-1111-4111-8111-111111111111";
const SHA = "a".repeat(64);

beforeEach(() => {
  mocks.accepted.length = 0;
});

describe("keep my notes on the new file", () => {
  it("answers a missing or malformed file report with the registered sentence, without calling the service", async () => {
    for (const file of [null, undefined, "x", { observedSha256: 42 }, { observedSha256: "not-a-hash", pageCount: 1, pageViews: [] }]) {
      expect(await keepNotesOnNewFileAction(ASSET, file as never)).toEqual({ error: ERROR_NOTICES["observed-hash-invalid"] });
    }
    expect(mocks.accepted).toEqual([]);
  });

  it("passes only the report's three fields to the service", async () => {
    const result = await keepNotesOnNewFileAction(ASSET, {
      observedSha256: SHA,
      pageCount: 2,
      pageViews: [
        [612, 792],
        [612, 792],
      ],
      extra: "ignored",
    } as never);
    expect(result).toEqual({ accepted: true, problems: [] });
    expect(mocks.accepted).toEqual([
      {
        observedSha256: SHA,
        pageCount: 2,
        pageViews: [
          [612, 792],
          [612, 792],
        ],
      },
    ]);
  });
});
