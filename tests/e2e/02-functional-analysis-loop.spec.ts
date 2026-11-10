import { expect, test } from "@playwright/test";
import { screenshot, signInOrBootstrap, takeCourse } from "./helpers";

/**
 * Journey 2: enrol in Functional Analysis I, open unit 1, start the tutorial, write an original
 * attempt at the norm-comparison task, submit it, receive feedback from the (fixture) assessor,
 * revise, see both versions persist across reload, and stream a tutor turn. Safe to re-run on a
 * database that already holds earlier attempts.
 */
test.describe("functional analysis learning loop", () => {
  test("enrol, attempt, feedback, revision, persistence", async ({ page }) => {
    test.setTimeout(240_000);
    await signInOrBootstrap(page);

    // What the record says about the concept before this run submits anything.
    await page.goto("/studies");
    const conceptRow = page.getByRole("listitem").filter({ hasText: "Equivalence of norms" });
    const conceptBefore = (await conceptRow.count()) > 0 ? ((await conceptRow.first().textContent()) ?? "") : "";

    await page.goto("/courses/MAT-230");
    await expect(page.getByRole("heading", { level: 1, name: "Functional Analysis I" })).toBeVisible();
    await expect(page.getByText("Teaching ready").first()).toBeVisible();
    await takeCourse(page, "MAT-230");
    await screenshot(page, "03-course-foyer");

    await page.getByRole("link", { name: "Normed and Banach spaces" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Normed and Banach spaces" })).toBeVisible();
    await expect(page.getByText("Definition (norm)")).toBeVisible();
    await screenshot(page, "04-unit-page");

    const tutorialCard = page.locator("li", { hasText: "Tutorial: two norms on C([0,1])" });
    await tutorialCard.getByRole("button", { name: "Start" }).click();
    await expect(page).toHaveURL(/\/sessions\//, { timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 2, name: "Two norms on C([0,1])" })).toBeVisible();

    const attempt = page.getByLabel("Attempt (Markdown with LaTeX)");
    const submit = page.getByRole("button", { name: /submit (attempt|revision)/i });
    const versionsBefore = await page.getByRole("heading", { level: 3, name: /Submission v\d+/ }).count();

    // An over-generalising attempt: the automatic check and the fixture assessor should object.
    if (await attempt.isEnabled()) {
      await attempt.fill(
        "Since all norms are equivalent, the sup norm and the integral norm are comparable on C([0,1]), so the sequence shows nothing special.",
      );
      await submit.click();
      // No model read the attempt, so the verdict is withheld; the automatic check still objects.
      await expect(page.getByText("Needs review").first()).toBeVisible({ timeout: 90_000 });
      await expect(page.getByText(/verdict is withheld/i).first()).toBeVisible();
      await expect(page.getByText(/not true in general/i).first()).toBeVisible();
      await expect(page.getByText("Scripted demo assessor: no model read this").first()).toBeVisible();
      await screenshot(page, "05-feedback-withheld-check-failed");

      // Revise with a correct argument.
      await attempt.fill(
        [
          "Let $f_n(x)=x^n$ on $[0,1]$. Since $x^n$ is increasing, $\\|f_n\\|_\\infty = \\sup_{x\\in[0,1]} x^n = 1$ for all $n$.",
          "Also $\\|f_n\\|_1 = \\int_0^1 x^n\\,dx = \\frac{1}{n+1}$.",
          "Suppose a constant $C$ gave $\\|f\\|_\\infty \\le C\\|f\\|_1$ for all $f$. For $f_n$ this reads $1 \\le C/(n+1)$, so $n+1 \\le C$ for all $n$, impossible.",
          "Hence the norms are not equivalent on $C([0,1])$. The theorem that all norms are equivalent needs finite dimension, and $C([0,1])$ is infinite-dimensional (the $x^n$ are independent).",
        ].join("\n"),
      );
      await submit.click();
      // Every automatic check passes, and still no acceptance: nobody has read the argument.
      await expect(page.getByText("Needs review").first()).toBeVisible({ timeout: 90_000 });
      await expect(page.getByText(/verdict is withheld/i).first()).toBeVisible();
      // This run's newest submission (the first card) is not accepted; older attempts in a
      // long-lived database may carry verdicts from before verdicts were withheld.
      await expect(page.locator("article").first().getByText("Accepted", { exact: true })).toHaveCount(0);
      await screenshot(page, "06-feedback-withheld-checks-passed");
    } else {
      // An earlier run already submitted; the withheld record must still be here.
      await expect(page.getByText("Needs review").first()).toBeVisible();
    }

    await page.reload();
    const versionsAfter = await page.getByRole("heading", { level: 3, name: /Submission v\d+/ }).count();
    expect(versionsAfter).toBeGreaterThanOrEqual(Math.max(2, versionsBefore));

    await page.goto("/studies");
    // Submitted work is recorded as practice. Only a verdict makes a concept "demonstrated", and
    // without a model the verdict is withheld, so this run can never make it demonstrated; only a
    // database from before that rule can already hold an older "demonstrated".
    const concept = conceptRow.first();
    if (/demonstrated/.test(conceptBefore)) {
      await expect(concept).toContainText("demonstrated");
    } else {
      await expect(concept).toContainText("practised");
      await expect(concept).not.toContainText("demonstrated");
    }
    await screenshot(page, "07-my-studies-evidence");
  });

  test("tutor turn streams and is stored with validated citations", async ({ page }) => {
    test.setTimeout(120_000);
    await signInOrBootstrap(page);
    await page.goto("/courses/MAT-230/units/MAT-230-u01");
    const tutorialCard = page.locator("li", { hasText: "Tutorial: two norms on C([0,1])" });
    await tutorialCard.getByRole("button", { name: "Start" }).click();
    await expect(page).toHaveURL(/\/sessions\//, { timeout: 30_000 });
    await page.getByLabel("Message to the tutor").fill("Before I start: in finite dimensions, are all norms equivalent?");
    await page.getByRole("button", { name: "Send" }).click();
    // Scoped to the tutor's panel: other panels (paper work) also say when no model is configured.
    const tutorPanel = page.locator("#panel-tutor");
    await expect(tutorPanel.getByText(/norm induces a metric|no model is configured|three properties/).first()).toBeVisible({
      timeout: 30_000,
    });
    // A citation is labelled source-backed only when the tutor saw the passage's text; until the
    // library holds that text it reads "location cited, text not seen".
    await expect(page.getByText(/source-backed|needs checking|location cited, text not seen/).first()).toBeVisible({ timeout: 30_000 });
    // The stored reply names what wrote it, and its citations resolved to sources of the unit:
    // each is shown with that source's label, and none was removed as unverifiable.
    await expect(page.locator("p", { hasText: / · Scripted demo$/ }).last()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[id^="cite-E"]').last()).toHaveText(/^E\d+: \S.+/);
    await expect(page.getByText(/unverifiable citation removed/)).toHaveCount(0);
    await screenshot(page, "08-tutor-turn");
  });
});
