import { expect, test } from "@playwright/test";
import { screenshot, signInOrBootstrap } from "./helpers";

// This spec exercises arrival and sign-in itself, so it starts from an anonymous browser.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("arrival, authentication and orientation", () => {
  test("private routes refuse unauthenticated requests", async ({ request, page }) => {
    const api = await request.get("/api/jobs");
    expect([401, 404]).toContain(api.status());
    await page.goto("/campus");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("arrival page presents the institution honestly", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Corniversity" })).toBeVisible();
    await expect(page.getByText(/non-accredited/i).first()).toBeVisible();
    await screenshot(page, "01-arrival");
  });

  test("orientation is one step, then the catalogue; once done, every orientation address goes home", async ({ page }) => {
    await signInOrBootstrap(page);
    await page.goto("/onboarding/1");
    if (/\/onboarding\/1/.test(page.url())) {
      await expect(page.getByRole("heading", { level: 1, name: "Welcome" })).toBeVisible();
      await screenshot(page, "02-onboarding-step-1");
      await page.getByLabel("Your name").fill("Leon");
      await page.getByLabel("Time zone").fill("Europe/London");
      await page.getByRole("button", { name: "Pick courses" }).click();
      await expect(page).toHaveURL(/\/catalogue/);
    }
    for (const step of ["/onboarding/1", "/onboarding/5", "/onboarding/12"]) {
      await page.goto(step);
      await expect(page).toHaveURL(/\/campus/);
    }
    await expect(page.getByRole("heading", { level: 1, name: "Your courses" })).toBeVisible();
  });

  test("sign-up is closed once the owner exists", async ({ page }) => {
    await page.goto("/join");
    await expect(page.getByText(/sign-up is closed/i)).toBeVisible();
  });
});
