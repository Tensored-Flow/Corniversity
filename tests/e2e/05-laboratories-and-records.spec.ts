import { expect, test } from "@playwright/test";
import { screenshot, signInOrBootstrap, takeCourse } from "./helpers";

/**
 * Journeys 3 and 4 (laboratory side) and the records surfaces.
 *
 * 3. A chemistry student opens Principles of Chemical Science, starts the reversible-reaction
 *    laboratory (a stated model, never a procedure), reads the model at t = 5 min, and records an
 *    interpretation that lands in the notebook.
 * 4. A computational-neuroscience student opens the synthetic tuning-curve laboratory, sees every
 *    synthetic label, bootstraps the fit, and records an interpretation, not just a run.
 *
 * Then: the norm-comparison laboratory reveals exact values only because the tutorial attempt in
 * journey 2 was assessed; the notebook lists the interpretations and an open question; the records
 * page shows the informal transcript, the portfolio and a review; an export is built by the worker
 * and downloads; unauthenticated download is refused.
 */
test.describe.configure({ mode: "serial" });

const run = Date.now().toString(36);

async function enrol(page: import("@playwright/test").Page, courseId: string) {
  await takeCourse(page, courseId);
}

async function startLab(page: import("@playwright/test").Page, courseId: string, unitLinkName: RegExp, labTitle: RegExp) {
  await enrol(page, courseId);
  await page.getByRole("link", { name: unitLinkName }).click();
  const card = page.locator("li", { hasText: labTitle }).first();
  await card.getByRole("button", { name: /start|resume|continue/i }).click();
  await expect(page).toHaveURL(/\/sessions\//, { timeout: 30_000 });
}

test.describe("laboratories, notebook and records", () => {
  test("journey 3: the chemistry student runs the A ⇌ B model and records an interpretation", async ({ page }) => {
    test.setTimeout(180_000);
    await signInOrBootstrap(page);
    await startLab(
      page,
      "CHE-101",
      /Chemical kinetics and the reversible-reaction model/i,
      /Virtual laboratory: reversible first-order reaction/i,
    );
    await expect(page.getByRole("heading", { level: 2, name: /Reversible first-order reaction A ⇌ B/ })).toBeVisible();
    await expect(page.getByText("Virtual model, not a procedure", { exact: false })).toBeVisible();
    await expect(page.getByText(/\[A\]\(5\) = 0\.3515 M/)).toBeVisible();
    await expect(page.getByText(/\[A\] \+ \[B\] = 1\.0000 M/)).toBeVisible();
    // An unstable explicit Euler step is flagged as a numerical artefact, not chemistry.
    await page.getByLabel("Δt (min)").fill("6");
    await expect(page.getByText(/leaves \[0, C₀\] at t = .* a numerical artefact, not chemistry/)).toBeVisible();
    await screenshot(page, "27-lab-kinetics");

    await page
      .getByLabel("Interpretation")
      .fill(
        `Run ${run}: [A] decays from 1.00 M to its equilibrium value because the forward step empties A faster than the reverse step refills it until the two rates balance; with k_f = 0.30 and k_r = 0.10 the curve levels at 0.25 M, which matches [A]eq = k_r C0/(k_f + k_r). Doubling both rate constants halved the relaxation time without moving the plateau, so where the reaction ends and how fast it gets there are separate questions. A Δt of 6 min made explicit Euler overshoot below zero: a property of the step, not of the model.`,
      );
    await page.getByRole("button", { name: /record in the notebook/i }).click();
    await expect(page.getByText("Recorded in your notebook.")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Earlier interpretations/)).toBeVisible();
  });

  test("journey 4: the neuroscience student fits synthetic tuning data, bootstraps, and records what the fit shows", async ({ page }) => {
    test.setTimeout(180_000);
    await signInOrBootstrap(page);
    await startLab(
      page,
      "NEU-220",
      /Model fitting: least squares, likelihood, uncertainty and model selection/i,
      /fitting a tuning curve to synthetic spike counts/i,
    );
    await expect(page.getByRole("heading", { level: 2, name: /Fitting a tuning curve to synthetic spike counts/ })).toBeVisible();
    await expect(page.getByText("Synthetic data").first()).toBeVisible();
    await expect(page.getByText(/not recordings from any neuron or animal/)).toBeVisible();
    // The default split holds out new trials of the eight orientations; its contract says the task is familiar.
    const taskRow = page.locator("dt", { hasText: /^Task$/ }).locator("xpath=following-sibling::dd[1]");
    await expect(page.getByText(/Log-likelihood per trial, held-out trials \(\d+ trials\)/)).toBeVisible();
    await expect(taskRow).toHaveText("familiar");
    await page.getByRole("button", { name: /bootstrap the fit/i }).click();
    await expect(page.getByText(/95% percentile intervals/)).toBeVisible({ timeout: 30_000 });
    // Holding out a whole orientation asks another question, with its own contract; intervals
    // computed for the other split are not shown against it.
    await page.getByLabel("Evaluation split").selectOption("held_out_orientation");
    await page.getByLabel("Held-out orientation").selectOption("67.5");
    await expect(page.getByText(/Log-likelihood per trial, held-out orientation 67\.5° \(30 trials\)/)).toBeVisible();
    await expect(taskRow).toHaveText("unseen");
    await expect(page.getByText(/95% percentile intervals/)).toHaveCount(0);
    await page.getByLabel("Dataset").selectOption("failure");
    await expect(page.getByLabel("Dataset")).toHaveValue("failure");
    await expect(page.getByText("Generating model parameters (hidden by default)")).toHaveCount(0);
    await screenshot(page, "28-lab-tuning-fit");

    await page
      .getByLabel("Interpretation")
      .fill(
        `Run ${run}: on the synthetic tuned dataset the von Mises model beat the constant-rate baseline on held-out trials, and the bootstrap interval for θ_pref was narrow while κ was wider because eight orientations sample the peak coarsely. On the synthetic failure case the unimodal fit sat between two preferred orientations and its held-out advantage shrank: a model can fit training counts and still be the wrong shape, so out-of-sample likelihood, not the training fit, decides.`,
      );
    await page.getByRole("button", { name: /record in the notebook/i }).click();
    await expect(page.getByText("Recorded in your notebook.")).toBeVisible({ timeout: 20_000 });
  });

  test("norm-comparison laboratory: exact values are shown only because the tutorial attempt was assessed", async ({ page }) => {
    test.setTimeout(120_000);
    await signInOrBootstrap(page);
    await startLab(page, "MAT-230", /Normed and Banach spaces/, /two norms on C\(\[0,1\]\), by computation/i);
    await expect(page.getByRole("heading", { level: 2, name: /Two norms on C\(\[0,1\]\)/ })).toBeVisible();
    await page.getByLabel("Your value of ‖f_n‖₁").fill("0.1666667");
    await expect(page.getByText("matches").first()).toBeVisible();
    await expect(page.getByText(/Exact values are shown because your attempt/)).toBeVisible();
    await screenshot(page, "29-lab-norms");
  });

  test("notebook: interpretations are entries; an open question stays on the shelf until resolved", async ({ page }) => {
    await signInOrBootstrap(page);
    await page.goto("/notebook");
    await expect(page.getByRole("heading", { level: 1, name: "Your notebook" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Laboratory: Virtual laboratory: reversible first-order reaction/ }).first()).toBeVisible();
    await page.getByLabel("Title").fill(`Why does completeness matter for operators? ${run}`);
    await page.getByLabel("Kind").selectOption("question");
    await page.getByLabel("Tags (comma or space separated)").fill("functional-analysis, carry-forward");
    await page
      .getByLabel("Body (Markdown with LaTeX)")
      .fill("Which results about bounded operators on a Banach space fail on an incomplete normed space? Collect examples as I meet them.");
    await page.getByRole("button", { name: "Save entry" }).click();
    await expect(page).toHaveURL(/\/notebook\//);
    await expect(page.getByText("open", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark resolved" })).toBeVisible();
    await page.goto("/notebook");
    const shelf = page.locator("section", { has: page.getByRole("heading", { name: "Questions you have not resolved" }) });
    await expect(shelf).toBeVisible();
    await expect(shelf.getByRole("link", { name: new RegExp(`completeness matter for operators\\? ${run}`) })).toBeVisible();
    await page.goto(`/notebook?q=${encodeURIComponent("bounded operators")}`);
    await expect(page.getByText(/Results for/)).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(run) }).first()).toBeVisible();
    await screenshot(page, "30-notebook");
  });

  test("records: informal transcript, portfolio, review, and a worker-built export that downloads", async ({ page, browser }) => {
    test.setTimeout(180_000);
    await signInOrBootstrap(page);
    await page.goto("/records");
    await expect(page.getByRole("heading", { level: 1, name: "Your academic record" })).toBeVisible();
    await expect(page.getByText(/non-accredited/)).toBeVisible();
    await expect(page.getByRole("cell", { name: /CHE-101/ }).first()).toBeVisible();
    await expect(page.getByText("lab interpretation").first()).toBeVisible();
    await expect(page.getByText(/no model was consulted/)).toBeVisible();
    await page
      .locator("form", { has: page.locator('input[value="alter_markdown"]') })
      .getByRole("button", { name: "Build" })
      .click();
    await expect(page.getByText("Export queued")).toBeVisible();
    const download = page.getByRole("link", { name: "Download" }).first();
    await expect(download).toBeVisible({ timeout: 60_000 });
    const href = await download.getAttribute("href");
    const response = await page.request.get(href!);
    expect(response.status()).toBe(200);
    const text = await response.text();
    expect(text).toContain("personal academic record (informal)");
    expect(text).toContain("CHE-101");
    await screenshot(page, "31-records");

    const anonymous = await (await browser.newContext({ storageState: { cookies: [], origins: [] } })).newPage();
    expect((await anonymous.request.get(href!)).status()).toBe(401);
    await anonymous.context().close();
  });

  test("instructor material never reaches the learner's pages before a reveal", async ({ page }) => {
    await signInOrBootstrap(page);
    // Phrases that exist only in content/courses/MAT-230/units/01-*/instructor/*.md.
    const forbidden = ["Reference reasoning (instructor only)", "Alternative valid approaches", "Do not require the reverse inequality"];
    await page.goto("/courses/MAT-230/units/MAT-230-u01");
    const unitHtml = await page.content();
    for (const phrase of forbidden) expect(unitHtml, `unit page leaks "${phrase}"`).not.toContain(phrase);
    const tutorialCard = page.locator("li", { hasText: "Tutorial: two norms on C([0,1])" });
    await tutorialCard.getByRole("button", { name: /start|resume|continue/i }).click();
    await expect(page).toHaveURL(/\/sessions\//, { timeout: 30_000 });
    const sessionHtml = await page.content();
    for (const phrase of forbidden) expect(sessionHtml, `session page leaks "${phrase}"`).not.toContain(phrase);
  });

  test("revision: completing a reading creates bounded definition prompts, visible on My Studies", async ({ page }) => {
    test.setTimeout(120_000);
    await signInOrBootstrap(page);
    await page.goto("/studies");
    await expect(page.getByRole("heading", { name: "Revision due" })).toBeVisible();
    await expect(page.getByText(/capped at \d+ a week/)).toBeVisible();
  });
});
