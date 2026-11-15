import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * *Attach your copy* (POST /api/library/papers/[workId]/attach): where its refusals and its success
 * land on the paper page (the Files section, named as `at=files`), and an upload whose body did not
 * arrive whole. The session, the environment, the database and the service are mocked; the route
 * and the form helpers are real.
 */
const mocks = vi.hoisted(() => ({
  session: { value: true as boolean },
  attach: { value: null as null | (() => Promise<unknown>) },
  calls: [] as string[],
}));

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: async () => (mocks.session.value ? { user: { id: "owner-1" } } : null) } },
}));
vi.mock("@corniversity/db/env", () => ({ getEnv: () => ({ MAX_UPLOAD_MB: 1, BETTER_AUTH_URL: "http://127.0.0.1:3000" }) }));
vi.mock("@/lib/db", () => ({ db: () => ({}) }));
vi.mock("@/lib/blobs", () => ({ blobs: () => ({}) }));
vi.mock("@corniversity/db/services/scholarly-works", async () => {
  class ScholarlyError extends Error {
    constructor(
      readonly code: string,
      message: string,
      readonly details: { workId?: string } = {},
    ) {
      super(message);
    }
  }
  return {
    ScholarlyError,
    attachUploadToWork: async () => {
      mocks.calls.push("attach");
      return mocks.attach.value ? mocks.attach.value() : { outcome: "stored" };
    },
  };
});
vi.mock("@corniversity/db/services/library", () => ({ LibraryError: class LibraryError extends Error {} }));

const { POST } = await import("./route");
const { ScholarlyError } = await import("@corniversity/db/services/scholarly-works");

const WORK = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const context = { params: Promise.resolve({ workId: WORK }) };

function upload(body: BodyInit, contentType: string): Request {
  return new Request(`http://127.0.0.1:3000/api/library/papers/${WORK}/attach`, {
    method: "POST",
    headers: { "content-type": contentType, "sec-fetch-site": "same-origin" },
    body,
  });
}

function withFile(bytes: string, name = "copy.pdf"): Request {
  const form = new FormData();
  form.set("file", new File([bytes], name, { type: "application/pdf" }));
  return new Request(`http://127.0.0.1:3000/api/library/papers/${WORK}/attach`, {
    method: "POST",
    headers: { "sec-fetch-site": "same-origin" },
    body: form,
  });
}

const location = (response: Response) => {
  const url = new URL(response.headers.get("location") ?? "");
  return `${url.pathname}${url.search}${url.hash}`;
};

beforeEach(() => {
  mocks.session.value = true;
  mocks.attach.value = null;
  mocks.calls.length = 0;
});

describe("attach your copy", () => {
  it("says a body that stopped mid-upload did not arrive, and stores nothing", async () => {
    const cut = `--b\r\ncontent-disposition: form-data; name="file"; filename="copy.pdf"\r\ncontent-type: application/pdf\r\n\r\n%PDF-1.7 partial`;
    const response = await POST(upload(cut, "multipart/form-data; boundary=b"), context);
    expect(response.status).toBe(303);
    expect(location(response)).toBe(`/library/papers/${WORK}?at=files&error=upload-interrupted#files`);
    expect(mocks.calls).toEqual([]);
  });

  it("asks for a file when none was chosen, and refuses one over the limit, in the Files section", async () => {
    const empty = new FormData();
    empty.set("versionId", "");
    const none = await POST(
      new Request(`http://127.0.0.1:3000/api/library/papers/${WORK}/attach`, {
        method: "POST",
        headers: { "sec-fetch-site": "same-origin" },
        body: empty,
      }),
      context,
    );
    expect(location(none)).toBe(`/library/papers/${WORK}?at=files&error=attach-choose-file#files`);
    const large = await POST(withFile("x".repeat(1_048_577)), context);
    expect(location(large)).toBe(`/library/papers/${WORK}?at=files&error=attach-too-large#files`);
    expect(mocks.calls).toEqual([]);
  });

  it("returns the outcome, or a service refusal with the paper a file belongs to, to the Files section", async () => {
    expect(location(await POST(withFile("%PDF-1.7 ok"), context))).toBe(`/library/papers/${WORK}?at=files&saved=attached-stored#files`);
    mocks.attach.value = async () => {
      throw new ScholarlyError("refused", "This file is already attached to another paper in your library.", { workId: OTHER });
    };
    expect(location(await POST(withFile("%PDF-1.7 other"), context))).toBe(
      `/library/papers/${WORK}?other=${OTHER}&at=files&error=file-attached-other-paper#files`,
    );
  });

  it("refuses other sites and absent sessions before reading the body", async () => {
    const cross = new Request(`http://127.0.0.1:3000/api/library/papers/${WORK}/attach`, {
      method: "POST",
      headers: { "sec-fetch-site": "cross-site" },
      body: new FormData(),
    });
    expect((await POST(cross, context)).status).toBe(403);
    mocks.session.value = false;
    const unsigned = await POST(withFile("%PDF-1.7"), context);
    expect(location(unsigned)).toBe(`/sign-in?next=${encodeURIComponent(`/library/papers/${WORK}`)}`);
    expect(mocks.calls).toEqual([]);
  });
});
