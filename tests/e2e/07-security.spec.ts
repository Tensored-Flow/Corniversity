import { expect, test } from "@playwright/test";
import { AUTH_STATE, ownerEnv } from "./helpers";

/**
 * Journey 10's local half: nothing private answers an unauthenticated browser. Pages redirect to
 * sign-in; JSON routes answer 401; the public health route answers without revealing anything
 * beyond liveness; an invalid calendar token is refused.
 *
 * Every page and route of the Library (`(app)/library/**`, the reader `(reader)/library/read/[id]`,
 * `(app)/notebook/**`, `(app)/records`, `api/library/**`, `api/records/**`) is listed here with the
 * method it answers. Signed in, an id the owner does not have (well-formed or not) is not found and
 * returns no content.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const NO_ID = "00000000-0000-4000-8000-000000000000";

const PRIVATE_PAGES = [
  "/campus",
  "/studies",
  "/timetable",
  "/library",
  "/library/sync",
  "/library/jobs",
  "/library/shelves",
  "/library/shelves/00000000-0000-4000-8000-000000000000",
  "/library/trails",
  "/library/trails/00000000-0000-4000-8000-000000000000",
  "/library/discover",
  "/library/subjects/mathematics",
  "/library/find",
  "/library/works/doi/10.7717/peerj.4375",
  "/library/papers/00000000-0000-4000-8000-000000000000",
  "/library/papers/new",
  "/library/items/00000000-0000-4000-8000-000000000000",
  "/library/sources",
  "/library/requests",
  "/library/upload",
  "/library/read/00000000-0000-4000-8000-000000000000",
  "/notebook",
  "/notebook?library=1&work=00000000-0000-4000-8000-000000000000",
  "/notebook/00000000-0000-4000-8000-000000000000",
  "/records",
  "/settings",
  "/common-room",
  "/director",
  "/catalogue",
  "/courses/MAT-230",
  "/campus/map",
  "/programmes",
  "/programmes/mind-and-computation/blocks/MBI-01",
  "/studio",
  "/operations",
  "/proposals",
  "/visuals/lif-membrane-potential",
  "/courses/NEU-220/prepare",
  "/bridges/metric-spaces",
];
const PRIVATE_POSTS: [string, unknown][] = [
  ["/api/tutor/turn", { sessionId: "00000000-0000-4000-8000-000000000000", message: "x" }],
  ["/api/director/turn", { conversationId: "00000000-0000-4000-8000-000000000000", message: "x" }],
  ["/api/discussions/turn", { discussionId: "00000000-0000-4000-8000-000000000000", message: "x" }],
  [
    "/api/library/ask",
    { assetId: "00000000-0000-4000-8000-000000000000", action: "explain_passage", pageIndex: 0, selection: "x", text: "y" },
  ],
  ["/api/library/annotations", { assetId: "00000000-0000-4000-8000-000000000000", kind: "bookmark", physicalIndex: 0 }],
  [
    "/api/library/position",
    {
      assetId: "00000000-0000-4000-8000-000000000000",
      position: { pageIndex: 0, top: 0, left: 0, zoom: 1 },
      changedAgoMs: 0,
      tab: "tab-00000000",
      seq: 1,
    },
  ],
  ["/api/library/upload", {}],
  ["/api/companion/register", {}],
  ["/api/companion/status", {}],
  ["/api/companion/upload", {}],
  ["/api/studio/artifacts", {}],
  ["/api/tutor/context", { sessionId: "00000000-0000-4000-8000-000000000000", mode: "question" }],
  ["/api/work-pages", {}],
];
const PRIVATE_GETS = [
  "/api/library/assets/00000000-0000-4000-8000-000000000000/file",
  "/api/library/requests",
  "/api/records/exports/00000000-0000-4000-8000-000000000000",
  "/api/companion/status",
  "/api/calendar/not-a-real-token.ics",
  "/api/studio/artifacts/00000000-0000-4000-8000-000000000000",
  "/api/studio/00000000-0000-4000-8000-000000000000/report",
  "/api/work-pages/00000000-0000-4000-8000-000000000000",
  "/api/visuals/lif-membrane-potential/film",
  "/api/visuals/lif-membrane-potential/captions",
];

test.describe("unauthenticated access", () => {
  test("private pages redirect to sign-in", async ({ page }) => {
    for (const path of PRIVATE_PAGES) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/sign-in/);
    }
  });
  test("private JSON routes answer 401 without content; an unknown calendar token is not found", async ({ request }) => {
    for (const [path, body] of PRIVATE_POSTS) {
      const response = await request.post(path, { data: body });
      expect(response.status(), path).toBe(401);
    }
    for (const path of PRIVATE_GETS) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(path.startsWith("/api/calendar/") ? 404 : 401);
      const text = await response.text();
      expect(text).not.toContain("%PDF");
    }
  });
  test("the annotation routes and the paper upload forms refuse anonymous requests", async ({ request, baseURL }) => {
    for (const method of ["patch", "delete"] as const) {
      const response = await request[method]("/api/library/annotations", { data: { id: "00000000-0000-4000-8000-000000000000" } });
      expect(response.status(), method).toBe(401);
    }
    // Plain HTML forms post here: another site is refused, and this site without a session goes to sign-in.
    const origin = new URL(baseURL ?? "http://localhost:3000").origin;
    for (const path of ["/api/library/papers/new", "/api/library/papers/00000000-0000-4000-8000-000000000000/attach"]) {
      const crossSite = await request.post(path, { multipart: { title: "x" }, maxRedirects: 0 });
      expect(crossSite.status(), path).toBe(403);
      const sameSite = await request.post(path, { multipart: { title: "x" }, headers: { origin }, maxRedirects: 0 });
      expect(sameSite.status(), path).toBe(303);
      expect(sameSite.headers().location ?? "", path).toContain("/sign-in");
    }
  });
  test("a forged session cookie is refused by the server itself, not only by the redirect", async ({ page, baseURL }) => {
    const host = new URL(baseURL ?? "http://localhost:3000").hostname;
    await page.context().addCookies(
      ["corniversity.session_token", "__Secure-corniversity.session_token"].map((name) => ({
        name,
        value: "forged-session-token.forged-signature",
        domain: host,
        path: "/",
        secure: name.startsWith("__Secure-"),
        httpOnly: true,
        sameSite: "Lax" as const,
      })),
    );
    // The proxy only checks that a cookie is present; the page checks the session itself.
    await page.goto("/campus");
    await expect(page).toHaveURL(/\/sign-in/);
    const response = await page.request.post("/api/tutor/turn", {
      data: { sessionId: "00000000-0000-4000-8000-000000000000", message: "x" },
    });
    expect(response.status()).toBe(401);
  });
  test("the health route answers publicly with liveness and asset counts only", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(Object.keys(body).sort()).toEqual(["aiAssets", "at", "database", "latencyMs", "migrations", "ok", "scholarlyProviders"]);
    expect(body.migrations).toBe("current");
    // Only whether scholarly providers are live or recorded fixtures; never keys or addresses.
    expect(["live", "fixture"]).toContain(body.scholarlyProviders);
    // Prompt and scripted-response assets: a count and version names, never their text or location.
    const assets = body.aiAssets as { ok: boolean; scripted: string; prompts: Record<string, string> };
    expect(Object.keys(assets).sort()).toEqual(["ok", "prompts", "scripted"]);
    expect(assets).toMatchObject({ ok: true, scripted: "13 of 13" });
    for (const [role, version] of Object.entries(assets.prompts)) expect(version).toMatch(new RegExp(`^${role}-\\d+\\.\\d+$`));
  });
  test("once the owner exists, sign-up is closed even with the owner email and the bootstrap code", async ({ request }) => {
    const owner = ownerEnv();
    for (const email of [owner.email, `second-account-${Date.now()}@example.com`]) {
      const response = await request.post("/api/auth/sign-up/email", {
        headers: { "x-bootstrap-code": owner.code },
        data: { email, password: "a-long-enough-password-123", name: "Second account" },
      });
      expect(response.status(), email).toBe(403);
      expect(((await response.json()) as { message?: string }).message).toBe("Sign-up is closed. This institution has one owner account.");
    }
  });
});

test.describe("signed in: an id the owner does not have", () => {
  test.use({ storageState: AUTH_STATE });

  test("library pages answer 404, and the notebook and the preview say so, with no content", async ({ page }) => {
    for (const path of [
      `/library/papers/${NO_ID}`,
      "/library/papers/not-a-uuid",
      `/library/read/${NO_ID}`,
      "/library/read/not-a-uuid",
      `/library/items/${NO_ID}`,
      `/library/shelves/${NO_ID}`,
      `/library/trails/${NO_ID}`,
      `/notebook/${NO_ID}`,
      "/library/subjects/not-a-subject",
    ]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
      await expect(page, path).not.toHaveURL(/\/sign-in/);
    }
    await page.goto(`/notebook?library=1&work=${NO_ID}`);
    await expect(page.getByRole("heading", { name: "Paper not found" })).toBeVisible();
    await page.goto("/library/works/doi/not-a-doi");
    await expect(page.getByText("That identifier is not valid.")).toBeVisible();
  });

  test("library routes answer 404 (or refuse the form) with no content", async ({ page, baseURL }) => {
    const origin = new URL(baseURL ?? "http://localhost:3000").origin;
    for (const path of [
      `/api/library/assets/${NO_ID}/file`,
      "/api/library/assets/not-a-uuid/file",
      `/api/records/exports/${NO_ID}`,
      "/api/records/exports/x",
    ]) {
      const response = await page.request.get(path);
      expect(response.status(), path).toBe(404);
      expect(await response.text(), path).not.toContain("%PDF");
    }
    // The position route drops a save its tab already sent (kept in the web process's memory) before it
    // looks at the Document, so each run and project sends from a tab of its own.
    const tab = `forged-${Date.now().toString(36)}-${test.info().project.name}`;
    const json: ["post" | "patch" | "delete", string, unknown][] = [
      ["post", "/api/library/ask", { assetId: NO_ID, action: "question", pageIndex: 0, selection: "x", text: "y" }],
      [
        "post",
        "/api/library/position",
        { assetId: NO_ID, position: { pageIndex: 0, top: 0, left: 0, zoom: 1 }, changedAgoMs: 0, tab, seq: 1 },
      ],
      ["post", "/api/library/annotations", { assetId: NO_ID, kind: "bookmark", physicalIndex: 0 }],
      ["patch", "/api/library/annotations", { id: NO_ID, noteMarkdown: "x", expectedUpdatedAt: "2026-01-01T00:00:00.000Z" }],
      ["delete", "/api/library/annotations", { id: NO_ID }],
    ];
    for (const [method, path, data] of json) {
      const response = await page.request[method](path, { data, headers: { origin } });
      expect(response.status(), `${method} ${path}`).toBe(404);
    }
    // A paper's upload form for a paper the owner does not have: back to Find with the refusal; nothing is stored.
    const attach = await page.request.post(`/api/library/papers/${NO_ID}/attach`, {
      multipart: { file: { name: "x.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF\n") } },
      headers: { origin },
      maxRedirects: 0,
    });
    expect(attach.status()).toBe(303);
    expect(attach.headers().location).toContain("/library/find?error=paper-not-found");
  });
});
