import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Web upload (POST /api/library/upload): it refuses posts from other sites before reading the body,
 * as the other Library posts do, and still answers an absent session with 401. The session, the
 * environment, the database and the service are mocked; the route and the form helpers are real.
 */
const mocks = vi.hoisted(() => ({
  session: { value: true as boolean },
  calls: [] as string[],
}));

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: async () => (mocks.session.value ? { user: { id: "owner-1" } } : null) } },
}));
vi.mock("@corniversity/db/env", () => ({ getEnv: () => ({ MAX_UPLOAD_MB: 1, BETTER_AUTH_URL: "http://127.0.0.1:3000" }) }));
vi.mock("@/lib/db", () => ({ db: () => ({}) }));
vi.mock("@/lib/blobs", () => ({ blobs: () => ({}) }));
vi.mock("@corniversity/db/services/library", () => ({
  LibraryError: class LibraryError extends Error {},
  receiveUpload: async () => {
    mocks.calls.push("receive");
    return { outcome: "stored", asset: { id: "asset-1", mediaType: "text/plain" } };
  },
  setCandidateMetadata: async () => undefined,
}));

const { POST } = await import("./route");

function post(headers: Record<string, string>): Request {
  const form = new FormData();
  form.set("file", new File(["plain notes"], "notes.txt", { type: "text/plain" }));
  return new Request("http://127.0.0.1:3000/api/library/upload", { method: "POST", headers, body: form });
}

beforeEach(() => {
  mocks.session.value = true;
  mocks.calls.length = 0;
});

describe("web upload", () => {
  it("refuses a cross-site post, and one from another origin without Sec-Fetch-Site, before reading the body", async () => {
    const cross = await POST(post({ "sec-fetch-site": "cross-site" }));
    expect(cross.status).toBe(403);
    expect(await cross.json()).toEqual({ error: "cross_site_refused" });
    const foreign = await POST(post({ origin: "http://evil.example" }));
    expect(foreign.status).toBe(403);
    expect(mocks.calls).toEqual([]);
  });

  it("stores a same-origin upload", async () => {
    const response = await POST(post({ "sec-fetch-site": "same-origin" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ assetId: "asset-1", outcome: "stored" });
    expect(mocks.calls).toEqual(["receive"]);
  });

  it("answers an absent session with 401", async () => {
    mocks.session.value = false;
    const response = await POST(post({ "sec-fetch-site": "same-origin" }));
    expect(response.status).toBe(401);
    expect(mocks.calls).toEqual([]);
  });
});
