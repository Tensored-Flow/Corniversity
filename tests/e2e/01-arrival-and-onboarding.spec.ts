import { expect, test } from "@playwright/test";
import { screenshot, signInOrBootstrap } from "./helpers";

// This spec exercises arrival and sign-in itself, so it starts from an anonymous browser.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("arrival, authentication and resumable onboarding", () => {
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

  test("owner can bootstrap or sign in, save step one, and resume after reload", async ({ page }) => {
    await signInOrBootstrap(page);
    await page.goto("/onboarding/1");
    await expect(page.getByRole("heading", { level: 1, name: "About you" })).toBeVisible();
    await screenshot(page, "02-onboarding-step-1");

    await page.getByLabel("What should we call you?").fill("Leon");
    await page.getByLabel("Timezone").fill("Europe/London");
    await page.getByText("Collegiate", { exact: true }).click();
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page).toHaveURL(/\/onboarding\/2/);

    // Reload resumes at the saved step.
    await page.reload();
    await expect(page).toHaveURL(/\/onboarding\/2/);

    // While orientation is unfinished, the campus sends the learner back to the saved step and
    // skipping ahead is refused; once orientation has been completed, every step stays editable
    // from Settings and the campus is the home.
    await page.goto("/campus");
    if (/\/onboarding\/2/.test(page.url())) {
      await page.goto("/onboarding/9");
      await expect(page).toHaveURL(/\/onboarding\/2/);
    } else {
      await expect(page).toHaveURL(/\/campus/);
      await page.goto("/onboarding/5");
      await expect(page).toHaveURL(/\/onboarding\/5/);
    }
  });

  test("sign-up is closed once the owner exists", async ({ page }) => {
    await page.goto("/join");
    await expect(page.getByText(/sign-up is closed/i)).toBeVisible();
  });
});
