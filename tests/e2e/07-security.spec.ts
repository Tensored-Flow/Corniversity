import { expect, test } from "@playwright/test";

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
];
const PRIVATE_POSTS: [string, unknown][] = [
  ["/api/tutor/turn", { sessionId: "00000000-0000-4000-8000-000000000000", message: "x" }],
  ["/api/director/turn", { conversationId: "00000000-0000-4000-8000-000000000000", message: "x" }],
  ["/api/discussions/turn", { discussionId: "00000000-0000-4000-8000-000000000000", message: "x" }],
  ["/api/library/ask", { assetId: "00000000-0000-4000-8000-000000000000", physicalIndex: 0, selectedText: "x", question: "y" }],
  ["/api/companion/register", {}],
  ["/api/companion/status", {}],
  ["/api/companion/upload", {}],
];
const PRIVATE_GETS = [
  "/api/library/assets/00000000-0000-4000-8000-000000000000/file",
  "/api/library/requests",
  "/api/records/exports/00000000-0000-4000-8000-000000000000",
  "/api/companion/status",
  "/api/calendar/not-a-real-token.ics",
];

test.describe("unauthenticated access", () => {
  test("private pages redirect to sign-in", async ({ page }) => {
    for (const path of PRIVATE_PAGES) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/sign-in/);
    }
  });
  test("private JSON routes answer 401 or 404 without content", async ({ request }) => {
    for (const [path, body] of PRIVATE_POSTS) {
      const response = await request.post(path, { data: body });
      expect([401, 404], `${path} → ${response.status()}`).toContain(response.status());
    }
    for (const path of PRIVATE_GETS) {
      const response = await request.get(path);
      expect([401, 404], `${path} → ${response.status()}`).toContain(response.status());
      const text = await response.text();
      expect(text).not.toContain("%PDF");
    }
  });
  test("the health route answers publicly and says only that the database responds", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(Object.keys(body).sort()).toEqual(["at", "database", "latencyMs", "migrations", "ok"]);
    expect(body.migrations).toBe("current");
  });
  test("sign-up is closed once the owner exists", async ({ request }) => {
    const response = await request.post("/api/auth/sign-up/email", {
      data: { email: `intruder-${Date.now()}@example.com`, password: "a-long-enough-password-123", name: "Intruder" },
    });
    expect([400, 403, 422]).toContain(response.status());
  });
});
