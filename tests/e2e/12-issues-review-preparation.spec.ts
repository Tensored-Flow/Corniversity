import { expect, test } from "@playwright/test";
import { activityButton, screenshot, signInOrBootstrap, takeCourse } from "./helpers";

/**
 * Journey 12 (teaching-experience brief, CORE-04 and CORE-06), with the scripted demo:
 * - an automatic check on a submission proposes an issue about that piece of work; the learner
 *   corrects its wording and confirms it; a later submission that passes the same check resolves it,
 *   and it is no longer current;
 * - review states its rule and offers a bounded set; pausing it is the learner's choice;
 * - a course-preparation proposal enrols nothing; confirmed, it runs its deterministic stages, and
 *   drafting is blocked honestly without permitted source passages; cancelling and resuming keep finished stages.
 * Safe to re-run on a database that already holds earlier runs.
 */
/** Submits and waits for that submission's own card (its version) to finish being assessed. */
async function submitAndWait(page: import("@playwright/test").Page): Promise<void> {
  const headings = page.getByRole("heading", { level: 3, name: /Submission v\d+/ });
  const versions = (await headings.allTextContents()).map((t) => Number(/v(\d+)/.exec(t)?.[1] ?? 0));
  const next = Math.max(0, ...versions) + 1;
  await page.getByRole("button", { name: /submit (attempt|revision)/i }).click();
  const card = page.locator("article", { has: page.getByRole("heading", { level: 3, name: `Submission v${next}` }) });
  await expect(card.getByText("Needs review")).toBeVisible({ timeout: 90_000 });
}

test.describe("issues, review and course preparation", () => {
  test.beforeEach(async ({ page }) => {
    await signInOrBootstrap(page);
  });

  test("a failed check proposes an issue; the learner confirms a corrected statement; later work resolves it", async ({ page }) => {
    test.setTimeout(240_000);
    await takeCourse(page, "MAT-230");
    await page.goto("/courses/MAT-230/units/MAT-230-u01");
    await (await activityButton(page, "Tutorial: two norms on C([0,1])")).click();
    await expect(page).toHaveURL(/\/sessions\//);
    const attempt = page.getByLabel("Attempt (Markdown with LaTeX)");
    const fresh = page.getByRole("button", { name: /^Start a new attempt: Practice/ });
    if (await fresh.isVisible().catch(() => false)) await fresh.click();
    await expect(attempt).toBeEnabled({ timeout: 60_000 });
    const session = page.url();

    await attempt.fill(
      "Since all norms are equivalent, the sup norm and the integral norm are comparable on C([0,1]), so nothing special happens.",
    );
    await submitAndWait(page);

    await page.goto("/notebook");
    const issues = page.locator("section", { has: page.getByRole("heading", { name: /^Issues to revisit/ }) });
    const issue = issues.locator("li", { hasText: /all norms|finite-dimension|not true in general/i }).first();
    await expect(issue).toBeVisible();
    await screenshot(page, "12-issue-proposed");
    if (
      await issue
        .getByRole("button", { name: "Confirm" })
        .isVisible()
        .catch(() => false)
    ) {
      await issue
        .getByLabel("Correct the wording if needed")
        .fill("This application of the equivalence theorem omitted its finite-dimension hypothesis.");
      await issue.getByRole("button", { name: "Confirm" }).click();
      await expect(
        issues.getByText("This application of the equivalence theorem omitted its finite-dimension hypothesis.").first(),
      ).toBeVisible();
    }

    // A correct revision passes the same check, which resolves the issue.
    await page.goto(session);
    await expect(attempt).toBeEnabled({ timeout: 60_000 });
    await attempt.fill(
      [
        "Let $f_n(x)=x^n$ on $[0,1]$. Then $\\|f_n\\|_\\infty = 1$ and $\\|f_n\\|_1 = \\frac{1}{n+1}$.",
        "If $\\|f\\|_\\infty \\le C\\|f\\|_1$ held for all $f$, then $1 \\le C/(n+1)$ for every $n$, which is impossible.",
        "So the norms are not equivalent: the equivalence theorem needs finite dimension, and $C([0,1])$ is infinite-dimensional.",
      ].join("\n"),
    );
    await submitAndWait(page);
    await page.goto("/notebook");
    await page.getByText(/^Resolved and dismissed/).click();
    await expect(page.getByText(/The same automatic check passed on submission v\d+/).first()).toBeVisible();
  });

  test("review states its rule, offers a bounded set and pauses when asked", async ({ page }) => {
    await page.goto("/studies");
    await expect(page.getByText(/An item comes back after 2 days/)).toBeVisible();
    await expect(page.getByText(/past their date, which is information, not a debt/)).toBeVisible();
    await page.getByText("Your review choices").click();
    await page.getByLabel("Pause all review").check();
    await page.getByRole("button", { name: "Save review choices" }).click();
    await expect(page.getByText("Review is paused. Nothing is offered until you resume it.")).toBeVisible();
    // Coming back later, as a learner would (React resets the form after each action).
    await page.reload();
    await page.getByText("Your review choices").click();
    await expect(page.getByLabel("Pause all review")).toBeChecked();
    await page.getByLabel("Pause all review").uncheck();
    await page.getByRole("button", { name: "Save review choices" }).click();
    await expect(page.getByText("Review is paused.")).toHaveCount(0);
  });

  test("a preparation proposal enrols nothing; confirmed, it runs its deterministic stages and blocks drafting honestly", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.goto("/courses/NEU-220");
    await page.getByRole("link", { name: "Prepare them" }).click();
    await page.getByLabel("What you want from this course").fill("Study computational neuroscience seriously, with weekly problems.");
    await page.getByRole("button", { name: "See the proposal" }).click();
    await expect(page).toHaveURL(/\/preparations\//);
    await expect(
      page.getByText(/This is a proposal\. Nothing has run, nothing has been spent, and confirming enrols you in nothing\./),
    ).toBeVisible();
    await page.getByRole("button", { name: /^Confirm and prepare within/ }).click();
    await expect(page.getByText(/No permitted source passages are available for this unit/).first()).toBeVisible({
      timeout: 90_000,
    });
    await expect(page.locator("li", { hasText: "Inspect the sources" }).getByText("done")).toBeVisible();
    await expect(page.getByTestId("prep-summary")).toHaveText(/units mapped; \d+ prepared/);
    await expect(page.getByTestId("prep-budget")).toHaveText(/spent or held \$0\.0000/);
    await screenshot(page, "12-preparation-blocked");
    await page.getByRole("button", { name: "Resume (finished stages are kept)" }).click();
    await expect(page.getByText(/No permitted source passages are available for this unit/).first()).toBeVisible({
      timeout: 90_000,
    });
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText("cancelled").first()).toBeVisible();
    await expect(page.locator("li", { hasText: "Inspect the sources" }).getByText("done")).toBeVisible();
  });
});
