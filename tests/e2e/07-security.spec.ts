import { expect, test } from "@playwright/test";
import { ownerEnv } from "./helpers";

/**
 * Journey 10's local half: nothing private answers an unauthenticated browser. Pages redirect to
 * sign-in; JSON routes answer 401; the public health route answers without revealing anything
 * beyond liveness; an invalid calendar token is refused.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const PRIVATE_PAGES = [
  "/campus",
  "/studies",
  "/timetable",
  "/library",
  "/library/sync",
  "/library/jobs",
  "/notebook",
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
  ["/api/library/ask", { assetId: "00000000-0000-4000-8000-000000000000", physicalIndex: 0, selectedText: "x", question: "y" }],
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
    expect(Object.keys(body).sort()).toEqual(["aiAssets", "at", "database", "latencyMs", "migrations", "ok"]);
    expect(body.migrations).toBe("current");
    // Prompt and scripted-response assets: a count and version names, never their text or location.
    const assets = body.aiAssets as { ok: boolean; scripted: string; prompts: Record<string, string> };
    expect(Object.keys(assets).sort()).toEqual(["ok", "prompts", "scripted"]);
    expect(assets).toMatchObject({ ok: true, scripted: "7 of 7" });
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
