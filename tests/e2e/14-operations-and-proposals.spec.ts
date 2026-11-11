import { expect, test } from "@playwright/test";
import { screenshot, signInOrBootstrap } from "./helpers";

/**
 * Journey 14 (teaching-experience brief, EXT-04 to EXT-06):
 * - academic operations shows prepared content, sources wanted, jobs, permissions, model use and
 *   preparation tasks by role, from records, reached from the account menu;
 * - a reading-course proposal inside Mathematics searches what exists, cannot be published until
 *   each overlapping course has a decision, and publishing lists a "proposed" catalogue item whose
 *   source lead becomes a request, with no enrolment.
 * Each run publishes one proposal into the local development catalogue (never production); later
 * runs decide on those earlier proposals too, as overlapping courses.
 */
test.describe("operations and proposals", () => {
  test.beforeEach(async ({ page }) => {
    await signInOrBootstrap(page);
  });

  test("academic operations reports from records and links to where things change", async ({ page }) => {
    await page.goto("/campus");
    await page.getByRole("link", { name: "Operations", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "How the university is running" })).toBeVisible();
    await expect(page.getByTestId("ops-units")).toHaveText(/\d+ prepared, [1-9]\d* outlined/);
    await expect(page.getByTestId("ops-provider")).toHaveText(/Scripted demo: no model is called/);
    for (const name of [
      "Prepared content",
      "Sources still wanted",
      "Background jobs, last seven days",
      "Permissions that stand",
      "Preparation tasks by role",
    ]) {
      await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
    }
    await page.getByText("Roles and their limits").click();
    await expect(page.getByText(/^convenor/)).toBeVisible();
    await screenshot(page, "14-operations");
  });

  test("a proposal searches first, waits for each overlap decision, and publishes a proposed item without enrolling", async ({ page }) => {
    test.setTimeout(180_000);
    const lead = `Lecture notes on spectral theory ${Date.now()}`;
    await page.goto("/catalogue");
    await page.getByRole("link", { name: "Propose one" }).click();
    await page.getByLabel("Kind").selectOption("reading_course");
    await page.getByLabel("Department").selectOption("mathematics");
    await page.getByLabel("Title", { exact: true }).fill("Functional notes on compact operators");
    await page
      .getByLabel("Purpose: what it is for")
      .fill("To read the spectral theorem for compact self-adjoint operators slowly, with problems.");
    await page
      .getByLabel("Scope: what it covers and leaves out")
      .fill("Compact self-adjoint operators and the spectral theorem; no unbounded operators.");
    await page.getByLabel("Depth").selectOption("rigorous");
    await page.getByLabel(/Source leads/).fill(`${lead} | chapters 1-2`);
    await page.getByRole("button", { name: "Save as a draft and search for overlap" }).click();
    await expect(page).toHaveURL(/\/proposals\/[0-9a-f-]{36}$/);

    const overlaps = page.getByTestId("overlap-course");
    await expect(overlaps.filter({ hasText: "MAT-230" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Publish to the catalogue" })).toBeDisabled();
    await screenshot(page, "14-proposal-overlap");
    // Decide on every overlapping course, one at a time (each decision is a new version).
    for (let i = 0; i < 15; i++) {
      const pending = overlaps.filter({ hasText: "needs a decision" }).first();
      if (!(await pending.isVisible().catch(() => false))) break;
      await pending.getByLabel("Decision").selectOption("distinct");
      await pending.getByLabel(/^Why, for/).fill("A narrower reading of one theorem.");
      await pending.getByRole("button", { name: "Record decision" }).click();
      await expect(pending.getByText("needs a decision"))
        .toHaveCount(0, { timeout: 15_000 })
        .catch(() => undefined);
    }
    await expect(overlaps.filter({ hasText: "needs a decision" })).toHaveCount(0);
    await expect(page.getByText(/^Versions kept: v\d+/)).toContainText("v2");

    await page.getByRole("button", { name: "Publish to the catalogue" }).click();
    await expect(page.getByText("Listed in the catalogue as a proposal")).toBeVisible();
    const courseLink = page.getByRole("link", { name: /^MAT-9\d\d$/ });
    const courseId = (await courseLink.textContent())!.trim();
    await courseLink.click();
    await expect(page).toHaveURL(new RegExp(`/courses/${courseId}$`));
    await expect(page.getByText(/proposed/i).first()).toBeVisible();
    await expect(page.getByText("Functional notes on compact operators").first()).toBeVisible();

    await page.goto("/library/requests");
    await expect(page.getByText(lead).first()).toBeVisible();
  });
});
