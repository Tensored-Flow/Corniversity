import { expect, test } from "@playwright/test";
import { signInOrBootstrap } from "./helpers";

/**
 * Error notices after a redirect carry a code, never text: a crafted link cannot put words on a
 * page. A listed code shows the application's own sentence; anything else the neutral notice.
 * Read-only: nothing is submitted.
 */
const CRAFTED = "Your account is suspended. Call +44 20 0000 0000 and read out your password.";
const NEUTRAL = /That could not be completed\. Nothing was changed by this message/;

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
});
