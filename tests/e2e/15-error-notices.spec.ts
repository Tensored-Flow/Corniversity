import { expect, test } from "@playwright/test";
import { signInOrBootstrap } from "./helpers";

/**
 * Error notices after a redirect carry a code, never text: a crafted link cannot put words on a
 * page. A listed code shows the application's own sentence; anything else the neutral notice.
 * Failure pages: every 404 has exactly one main landmark, and a form sent while offline says the
 * server could not be reached, not that the server failed. Nothing reaches the server: the one form
 * is sent while the browser is offline.
 */
const CRAFTED = "Your account is suspended. Call +44 20 0000 0000 and read out your password.";
const NEUTRAL = /That could not be completed\. Nothing was changed by this message/;
/** A UUID no record has. */
const NOBODY = "00000000-0000-4000-8000-000000000000";

test.describe("error notices", () => {
  test.beforeEach(async ({ page }) => {
    await signInOrBootstrap(page);
  });

  test("a crafted message in the address shows the neutral notice, never its own words", async ({ page }) => {
    for (const path of ["/notebook", "/timetable", "/settings", "/library", "/studies", "/proposals"]) {
      await page.goto(`${path}?error=${encodeURIComponent(CRAFTED)}`);
      await expect(page.getByText(NEUTRAL).first()).toBeVisible();
      await expect(page.getByText(/account is suspended/)).toHaveCount(0);
    }
  });

  test("a listed code shows the application's own sentence", async ({ page }) => {
    await page.goto("/settings?error=unknown-run");
    await expect(page.getByText("Unknown run.", { exact: true })).toBeVisible();
    await page.goto("/library/requests?written=/etc/passwd");
    await expect(page.getByText(/Written to/)).toHaveCount(0);
  });

  test("every 404 has exactly one main landmark: an unmatched address, an app page's and the reader's", async ({ page }) => {
    for (const [path, heading] of [
      ["/no-such-room-here", "There is no room here."],
      [`/library/papers/${NOBODY}`, "There is no room here."],
      [`/library/read/${NOBODY}`, "No document here."],
    ] as const) {
      expect((await page.goto(path))?.status(), path).toBe(404);
      await expect(page.getByRole("heading", { level: 1, name: heading }), path).toBeVisible();
      await expect(page.locator("main"), path).toHaveCount(1);
      await expect(page.locator("#main"), path).toHaveCount(1);
    }
  });

  test("a form sent while offline says the server could not be reached, and claims nothing about what was saved", async ({
    page,
    context,
  }) => {
    await page.goto("/library");
    const home = page.getByRole("region", { name: "Shelves and trails" });
    await home.getByLabel("Name").fill("Sent while offline");
    await context.setOffline(true);
    try {
      await home.getByRole("button", { name: "Create" }).click();
      await expect(page.getByRole("heading", { level: 1, name: "The server could not be reached" })).toBeVisible();
      await expect(page.getByText(/what you last sent may not have arrived/)).toBeVisible();
      await expect(page.getByText(/on our side|nothing you submitted is lost/)).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Reload" })).toBeVisible();
      await expect(page.locator("main")).toHaveCount(1);
    } finally {
      await context.setOffline(false);
    }
    // Nothing reached the server: no shelf by that name.
    await page.goto("/library/shelves");
    await expect(page.getByText("Sent while offline")).toHaveCount(0);
  });
});
