import { expect, type Page, test } from "@playwright/test";
import { screenshot, signInOrBootstrap, takeCourse } from "./helpers";

/**
 * Journey 3: the lean study format. Courses are taken from the catalogue (any number, no load
 * gate); a course is its units as rows with notes, a problem sheet and a tutorial; a timed,
 * closed-book exam draws problems not yet attempted and, in the scripted demo, waits for marking
 * rather than inventing a grade. Safe to re-run: each run uses up one unseen problem.
 */
const COURSES_WITH_PROBLEMS = ["NEU-220", "CHE-101", "MAT-210", "COG-250", "COG-260"];

async function courseWithUnseenProblems(page: Page): Promise<string | null> {
  for (const id of COURSES_WITH_PROBLEMS) {
    await takeCourse(page, id);
    if (
      await page
        .getByRole("button", { name: "Start exam" })
        .isVisible()
        .catch(() => false)
    )
      return id;
  }
  return null;
}

test.describe("the lean study format", () => {
  test("take several courses at once; notes, problem sheet and tutorial from a unit row", async ({ page }) => {
    test.setTimeout(240_000);
    await signInOrBootstrap(page);
    await page.goto("/catalogue");
    await expect(page.getByRole("heading", { level: 1, name: "Catalogue" })).toBeVisible();
    await expect(page.getByText(/courses have units ready\. Take as many as you like\./)).toBeVisible();
    // Taking from the list stays on the list.
    const take = page.getByRole("button", { name: "Take", exact: true }).first();
    if (await take.isVisible().catch(() => false)) {
      await take.click();
      await expect(page).toHaveURL(/\/catalogue/);
    }
    await screenshot(page, "03-catalogue");

    await takeCourse(page, "MAT-230");
    await takeCourse(page, "NEU-220");
    await page.goto("/campus");
    await expect(page.getByRole("heading", { level: 1, name: "Your courses" })).toBeVisible();
    // Navigation is the lean set; the timetable, director, common room and the rest are hidden.
    await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("link")).toHaveText([
      "Courses",
      "Catalogue",
      "Library",
      "Notebook",
    ]);
    await expect(page.getByRole("link", { name: /Functional Analysis I/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Computational Neuroscience/ })).toBeVisible();
    await screenshot(page, "03-your-courses");

    await page.goto("/courses/MAT-230");
    const row = page.locator("li", { hasText: "Normed and Banach spaces" });
    await expect(row.getByRole("link", { name: /Problem sheet \(\d+\)/ })).toBeVisible();
    await screenshot(page, "03-course-rows");
    await row.getByRole("link", { name: "Notes" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Normed and Banach spaces" })).toBeVisible();
    await expect(page.getByRole("article", { name: "Lecture notes" })).toBeVisible();

    await page.getByRole("link", { name: /Problem sheet \(\d+\)/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Problem sheet" })).toBeVisible();
    await expect(page.getByText(/\d+\/\d+ done/)).toBeVisible();
    await page
      .getByRole("button", { name: /^(Start|Open)$/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/sessions\/[0-9a-f-]{36}\?exercise=/, { timeout: 60_000 });

    await page.goto("/courses/MAT-230");
    await page.locator("li", { hasText: "Normed and Banach spaces" }).getByRole("button", { name: "Tutorial" }).click();
    await expect(page).toHaveURL(/\/sessions\/[0-9a-f-]{36}/, { timeout: 60_000 });
    await expect(page.getByLabel("Message to the tutor")).toBeVisible();
  });

  test("a timed, closed-book exam: answers save, submission is once, and the scripted demo leaves it unmarked", async ({ page }) => {
    test.setTimeout(240_000);
    await signInOrBootstrap(page);
    const courseId = await courseWithUnseenProblems(page);
    test.skip(courseId === null, "every listed course's problems have been attempted on this database");
    await page.getByLabel("Questions").fill("1");
    await page.getByLabel("Minutes").fill("5");
    await page.getByRole("button", { name: "Start exam" }).click();
    await expect(page).toHaveURL(/\/exams\/[0-9a-f-]{36}$/, { timeout: 60_000 });
    await expect(page.getByRole("timer", { name: "Time left" })).toHaveText(/^[45]:\d\d$/);
    // Closed book: the paper offers no tutor and no hints.
    await expect(page.getByLabel("Message to the tutor")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /hint/i })).toHaveCount(0);
    const answer = page.getByLabel("Answer to question 1");
    await answer.fill("An answer written under exam conditions.");
    await answer.blur();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 30_000 });
    await screenshot(page, "03-exam-running");
    // While the exam runs, its problem's sheet sends you to the exam instead of opening practice.
    const examUrl = page.url();
    const unit = Number((await page.getByText(/^Question 1 · Unit \d+$/).textContent())?.match(/Unit (\d+)/)?.[1]);
    await page.goto(`/courses/${courseId}`);
    await page
      .locator("section[aria-labelledby=units] li")
      .nth(unit - 1)
      .getByRole("link", { name: /Problem sheet/ })
      .click();
    await expect(page.getByRole("heading", { level: 1, name: "Problem sheet" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to exam" })).toBeVisible();
    await page.goto(examUrl);
    await expect(page.getByLabel("Answer to question 1")).toHaveValue("An answer written under exam conditions.");
    page.once("dialog", (d) => void d.accept());
    await page.getByRole("button", { name: "Submit exam" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Exam results" })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("An answer written under exam conditions.")).toBeVisible();
    await expect(page.getByText(/awaiting marking/).first()).toBeVisible();
    await expect(page.getByTestId("exam-score")).toHaveText(/0 of 1 answers marked/);
    await screenshot(page, "03-exam-results");

    // The course lists the exam it just ran.
    await page.goto(`/courses/${courseId}`);
    await expect(page.getByRole("link", { name: /· 1 question$/ }).first()).toBeVisible();
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
