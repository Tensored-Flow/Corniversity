import { expect, type Page, test } from "@playwright/test";
import { screenshot, signInOrBootstrap, takeCourse } from "./helpers";

/**
 * The Mind, Brain and AI update, end to end.
 *
 * 1. The programme is discoverable from the catalogue, inspectable before anything is chosen, and
 *    followed without enrolling in anything; it then appears on My Studies with its methods.
 * 2. The director drafts a route, the learner confirms it, and it sets a focus, not enrolments.
 * 3. COG-260 unit 1: the choice-model laboratory keeps results hidden until a prediction is saved,
 *    then runs model recovery and a held-out comparison that shows its information contract.
 * 4. COG-250 unit 1: after an announced revaluation the planner turns towards the new goal on its
 *    first move and the cached policy does not.
 * 5. Study defaults: appointments, deadlines and examinations are separate choices, a milestone is
 *    never binding, and a deadline kind that is switched off cannot be chosen.
 *
 * The owner account is shared with the other specs and persists between runs, so each step accepts
 * the state a previous run left (already following, prediction already saved) and checks the same
 * behaviour from there.
 */
test.describe.configure({ mode: "serial" });

const run = Date.now().toString(36);
const MODE_BADGE = /^(enrolled|audit|reading seminar)$/;

async function openLab(page: Page, courseId: string, unitTitle: RegExp, labTitle: RegExp) {
  await takeCourse(page, courseId);
  await page.getByRole("link", { name: unitTitle }).click();
  const card = page.locator("li", { hasText: labTitle }).first();
  await card.getByRole("button", { name: /start|resume|continue/i }).click();
  await expect(page).toHaveURL(/\/sessions\//, { timeout: 30_000 });
}

/** Saves a prediction if the laboratory asks for one, after checking that its results are hidden. */
async function passPredictionGate(page: Page, result: ReturnType<Page["getByRole"]>, prediction: string) {
  const gate = page.getByRole("heading", { name: "Your prediction first" });
  if (await gate.isVisible().catch(() => false)) {
    await expect(result).toHaveCount(0);
    // A one-line guess is refused: the prediction has to say what is expected and why.
    await page.getByRole("textbox", { name: "Prediction", exact: true }).fill("RW wins.");
    await page.getByRole("button", { name: "Save my prediction and show the results" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /in a sentence or two/ })).toBeVisible();
    await page.getByRole("textbox", { name: "Prediction", exact: true }).fill(prediction);
    await page.getByRole("button", { name: "Save my prediction and show the results" }).click();
    await expect(gate).toHaveCount(0, { timeout: 30_000 });
  }
  await expect(result.first()).toBeVisible({ timeout: 30_000 });
}

test.describe("Mind, Brain and AI and the study defaults", () => {
  test("the programme is found from the catalogue, inspected, and followed without enrolling in anything", async ({ page }) => {
    test.setTimeout(120_000);
    await signInOrBootstrap(page);
    await page.goto("/catalogue");
    await expect(page.getByText(/12 of (8[6-9]|9\d|\d{3}) are fully prepared, and 2 more have a first prepared unit/)).toBeVisible();
    await page.getByRole("main").getByRole("link", { name: "programme catalogue" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Routes through the university" })).toBeVisible();
    await page.getByRole("link", { name: "Mind, Brain and AI" }).first().click();

    await expect(page.getByRole("heading", { level: 1, name: "Mind, Brain and AI" })).toBeVisible();
    await expect(page.getByText("MIND-BRAIN-AI").first()).toBeVisible();
    await expect(page.getByText(/Following enrols you in nothing/)).toBeVisible();
    // Inspectable before following: blocks with their readiness, the methods and the seminar.
    await expect(page.getByRole("heading", { name: "The twelve blocks" })).toBeVisible();
    const planning = page.locator("li#MBI-09 summary");
    await expect(planning).toContainText("Planning and Structured Cognition");
    await expect(planning).toContainText(/partly prepared/i);
    await expect(page.getByRole("heading", { name: "Modelling methods" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /paper seminar/i })).toBeVisible();
    // A unit serving several blocks is listed once, as shared work.
    const shared = page.locator("section", { has: page.getByRole("heading", { name: "Units that serve more than one block" }) });
    await expect(shared.getByText(/Building and checking a model of choice behaviour/).first()).toBeVisible();

    const follow = page.getByRole("button", { name: /Follow this programme|Resume following/ });
    if (await follow.isVisible().catch(() => false)) {
      await follow.click();
      await expect(page.getByText("You now follow this programme.")).toBeVisible();
    }
    await expect(page.getByText("You follow this programme")).toBeVisible();
    await screenshot(page, "40-programme-mind-brain-ai");

    await page.goto("/studies");
    await expect(page.getByText("Mind, Brain and AI").first()).toBeVisible();
    await expect(page.getByText("Modelling methods").first()).toBeVisible();
  });

  test("the director drafts a route that the learner confirms; it sets a focus and enrols nothing", async ({ page }) => {
    test.setTimeout(120_000);
    await signInOrBootstrap(page);
    await page.goto("/studies");
    const coursesBefore = await page.getByText(MODE_BADGE).count();

    await page.goto("/programmes/mind-and-computation");
    await page.getByRole("button", { name: "Ask the director for a route" }).click();
    await expect(page).toHaveURL(/\/director\?proposed=programme/, { timeout: 30_000 });
    const proposal = page.locator("li", { hasText: /Follow Mind, Brain and AI/ }).last();
    await expect(proposal).toBeVisible();
    const proposalId = await proposal.locator('input[name="proposalId"]').first().getAttribute("value");
    await proposal.getByRole("button", { name: "Confirm" }).click();
    await expect(page.locator(`input[name="proposalId"][value="${proposalId}"]`)).toHaveCount(0, { timeout: 30_000 });

    await page.goto("/studies");
    await expect(page.getByText("focus", { exact: true }).first()).toBeVisible();
    expect(await page.getByText(MODE_BADGE).count()).toBe(coursesBefore);
  });

  test("COG-260 unit 1: results stay hidden until a prediction is saved, then the loop shows its contract", async ({ page }) => {
    test.setTimeout(300_000);
    await signInOrBootstrap(page);
    await page.goto("/courses/COG-260");
    await expect(page.getByText(/1 of 8 units/).first()).toBeVisible();
    await openLab(page, "COG-260", /Building and checking a model of choice behaviour/, /Laboratory: the complete loop/);

    await passPredictionGate(
      page,
      page.getByRole("button", { name: "Run model recovery" }),
      `Run ${run}: in the informative case I expect Rescorla-Wagner to fit the default participant best and the confusion matrix to be nearly diagonal; in the ambiguous case I expect the matrix to lose its diagonal because every model predicts choices near one half.`,
    );
    await expect(page.getByText("Synthetic participants").first()).toBeVisible();

    await page.getByRole("button", { name: "Run model recovery" }).click();
    await expect(page.getByText(/recovered as itself more often than as anything else in this case/)).toBeVisible({ timeout: 120_000 });

    await page.getByLabel("Held-out unit").selectOption("unseen_people");
    await page.getByRole("button", { name: "Run the comparison" }).click();
    await expect(page.getByText(/Chance is ln 0\.5/)).toBeVisible({ timeout: 120_000 });
    // The laboratory's own contract; the exercise below it uses the same labels in its prompt.
    await expect(page.locator("dt").filter({ hasText: /^Claims not tested$/ })).toBeVisible();
    await expect(page.locator("dt").filter({ hasText: /^Simplest baseline$/ })).toBeVisible();
    await screenshot(page, "41-lab-choice-model-loop");

    // The saved prediction is a notebook entry, not evidence of understanding.
    // Filtered by its tag, as a learner looking for a prediction would (the full list shows the most recent 100).
    await page.goto("/notebook?tag=prediction");
    await expect(page.getByText(/Prediction before running: Laboratory: the complete loop/).first()).toBeVisible();
  });

  test("COG-250 unit 1: after an announced revaluation the planner turns left and the cached policy right", async ({ page }) => {
    test.setTimeout(240_000);
    await signInOrBootstrap(page);
    await openLab(page, "COG-250", /Planning strategies and transfer/, /Laboratory: planning strategies after a change/);
    await passPredictionGate(
      page,
      page.getByRole("columnheader", { name: "First move" }),
      `Run ${run}: after the goal moves to the far corner the planner, which is told, should turn left at once; the cached policy should still go right because its values were learned towards the old goal.`,
    );
    await expect(page.getByText("Synthetic agents").first()).toBeVisible();
    const rows = page.locator("tbody tr");
    await expect(rows.filter({ hasText: "Model-based planner" }).first()).toContainText("left");
    await expect(rows.filter({ hasText: "Cached policy" }).first()).toContainText("right");
    await screenshot(page, "42-lab-planning-transfer");
  });

  test("study defaults: deadlines are separate from appointments, a milestone is never binding, a switched-off kind cannot be chosen", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await signInOrBootstrap(page);
    await page.goto("/settings#study");
    await expect(page.getByRole("option", { name: "Rolling, self-paced: no completion date" })).toBeAttached();
    await expect(page.getByText(/Term mode does not switch on examinations/)).toBeVisible();
    // Keep deadlines and examinations off, as a learner who never asked for them would have them.
    for (const name of ["hardDeadlines", "examinations"]) await page.locator(`input[name="${name}"]`).uncheck();
    await page.getByRole("button", { name: "Save study preferences" }).click();

    await page.goto("/timetable");
    await expect(page.getByRole("heading", { name: "Academic deadlines" })).toBeVisible();
    await expect(page.getByText(/missing a study appointment never makes anything late/)).toBeVisible();
    await expect(page.getByText(/Hard deadlines are off and examinations are off/)).toBeVisible();
    await expect(page.locator("#dl-kind option", { hasText: "Assessment deadline (switched off)" })).toBeDisabled();
    await expect(page.locator("#dl-kind option", { hasText: "Examination (switched off)" })).toBeDisabled();

    const due = new Date(Date.now() + 2 * 86_400_000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const local = `${due.getFullYear()}-${pad(due.getMonth() + 1)}-${pad(due.getDate())}T09:00`;
    const title = `Finish COG-260 unit 1 ${run}`;
    await page.locator("#dl-kind").selectOption("milestone");
    await page.locator("#dl-due").fill(local);
    await page.locator("#dl-title").fill(title);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    const item = page.locator("li", { hasText: title });
    await expect(item).toContainText("(not binding)", { timeout: 30_000 });
    await screenshot(page, "43-timetable-deadlines");
    await item.getByRole("button", { name: "Withdraw" }).click();
    await expect(page.locator("li", { hasText: title })).toHaveCount(0, { timeout: 30_000 });
  });
});
