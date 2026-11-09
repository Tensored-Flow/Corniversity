import { expect, test } from "@playwright/test";
import { screenshot, signInOrBootstrap } from "./helpers";

/**
 * Journey 1 (full): orientation steps 2–12 end in a confirmed first term, a welcome letter,
 * a first week on the timetable and the campus page showing the next real session. A new learner
 * discovers the Mind, Brain and AI programme on the interests step, and confirming the plan
 * follows it. Safe to re-run: when onboarding is already complete the test verifies the
 * resulting pages instead of replaying orientation.
 */
test.describe("orientation to a confirmed first term", () => {
  test("steps 2–12, welcome, timetable, campus", async ({ page }) => {
    test.setTimeout(240_000);
    await signInOrBootstrap(page);
    // While orientation is unfinished the campus sends the learner back to it.
    await page.goto("/campus");
    const fresh = /\/onboarding\//.test(page.url());

    if (fresh) {
      await page.goto("/onboarding/2");
      // Step 2: interests, including a programme
      await page.getByRole("checkbox", { name: /Mind, Brain and AI/ }).check();
      await page
        .getByLabel(/Mathematics/)
        .first()
        .check();
      await page.getByRole("checkbox", { name: /MAT-230/ }).check();
      await page.getByLabel(/In your own words/).fill("Functional analysis properly, with proofs, and then measure theory.");
      await page.getByRole("button", { name: /continue/i }).click();
      await expect(page).toHaveURL(/\/onboarding\/3/);
      await screenshot(page, "09-onboarding-knowledge");

      // Step 3: knowledge
      await page.getByRole("button", { name: /continue/i }).click();
      await expect(page).toHaveURL(/\/onboarding\/4/);

      // Step 4: style
      await page.getByRole("button", { name: /continue/i }).click();
      await expect(page).toHaveURL(/\/onboarding\/5/);

      // Step 5: time (weekday evenings + Saturday morning), keep the suggested commitments
      for (const d of [1, 2, 3, 4]) {
        await page.locator(`input[name="start:${d}"]`).fill("19:00");
        await page.locator(`input[name="end:${d}"]`).fill("22:00");
      }
      await page.locator('input[name="start:6"]').fill("10:00");
      await page.locator('input[name="end:6"]').fill("13:00");
      await page.locator('input[name="weeklyHours"]').fill("8");
      await page.getByRole("button", { name: /continue/i }).click();
      await expect(page).toHaveURL(/\/onboarding\/6/);
      await page.goBack();
      await expect(page.getByText(/What this buys/)).toBeVisible();
      await screenshot(page, "10-onboarding-time");
      await page.goto("/onboarding/6");

      // Step 6: rhythm (a new learner's default is rolling study; a stored choice is kept), next Monday
      await page.getByRole("button", { name: /continue/i }).click();
      await expect(page).toHaveURL(/\/onboarding\/7/);

      // Step 7: placement checks, skip all (readiness stays unverified)
      await expect(page.getByText(/Why these checks exist/)).toBeVisible();
      await page.getByRole("button", { name: /continue to plans/i }).click();
      await expect(page).toHaveURL(/\/onboarding\/8/);

      // Step 8: plans
      await expect(page.getByText(/One core course and a lighter seminar|A focused reading course/).first()).toBeVisible();
      await screenshot(page, "11-onboarding-plans");
      await page.getByRole("button", { name: /choose this plan/i }).click();
      await expect(page).toHaveURL(/\/onboarding\/9/);

      // Step 9: modes
      await page.getByRole("button", { name: /build the timetable/i }).click();
      await expect(page).toHaveURL(/\/onboarding\/10/, { timeout: 60_000 });

      // Step 10: timetable preview
      await expect(page.getByText(/The timetable fits|does not fully fit/)).toBeVisible();
      await expect(page.getByRole("heading", { name: "Your first two weeks" })).toBeVisible();
      await screenshot(page, "12-onboarding-timetable");
      await page.getByRole("button", { name: /this looks right/i }).click();
      await expect(page).toHaveURL(/\/onboarding\/11/);

      // Step 11: confirm
      await expect(page.getByText(/What confirming does/)).toBeVisible();
      await page.getByRole("button", { name: /confirm and receive/i }).click();
      await expect(page).toHaveURL(/\/welcome/, { timeout: 30_000 });
    } else {
      await page.goto("/welcome");
    }

    // Welcome letter
    await expect(page.getByRole("heading", { level: 1, name: /Congratulations/ })).toBeVisible();
    await expect(page.getByText("Your first week")).toBeVisible();
    await screenshot(page, "13-welcome");

    // Step 12: meet the college
    await page.goto("/onboarding/12");
    await expect(page.getByText(/Director of Studies/).first()).toBeVisible();
    await screenshot(page, "14-meet-the-college");

    // Timetable and campus
    await page.goto("/timetable");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/Plan version/)).toBeVisible();
    await screenshot(page, "15-timetable-week");
    await page.goto("/timetable?view=agenda");
    await expect(page.getByRole("heading", { name: "Agenda" })).toBeVisible();
    await page.goto("/campus");
    await expect(page.getByRole("heading", { name: "Next session" })).toBeVisible();
    await screenshot(page, "16-campus-home");

    if (fresh) {
      // The programme chosen during orientation is followed; following enrols in nothing.
      await page.goto("/programmes/mind-and-computation");
      await expect(page.getByText("You follow this programme")).toBeVisible();
    }

    // Calendar snapshot downloads as a real iCalendar file.
    const ics = await page.request.get("/api/calendar/export.ics");
    expect(ics.status()).toBe(200);
    const body = await ics.text();
    expect(body.startsWith("BEGIN:VCALENDAR")).toBe(true);
    expect(body).toContain("BEGIN:VEVENT");
  });

  test("calendar subscription requires a valid token", async ({ playwright, baseURL }) => {
    // An anonymous request context: the project's shared sign-in must not apply here.
    const anonymous = await playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    const bad = await anonymous.get("/api/calendar/this-is-not-a-valid-token-at-all.ics");
    expect(bad.status()).toBe(404);
    const unauth = await anonymous.get("/api/calendar/export.ics");
    expect(unauth.status()).toBe(401);
    await anonymous.dispose();
  });
});
