import { expect, type Page, test } from "@playwright/test";
import { screenshot, signInOrBootstrap, takeCourse } from "./helpers";

/**
 * Sections 13 to 18 of the Mind, Brain and AI update, end to end.
 *
 * 1. An existing learner explores programmes from orientation without repeating it: nothing is
 *    enrolled, unfollowed or resumed, and the plan steps no longer change anything.
 * 2. The programme overview says where to begin and shows the route by stage; a block page keeps
 *    curriculum readiness apart from the learner's progress and lists what is missing, and the
 *    missing sources are precise library requests that block nothing else.
 * 3. The director's route shows the change to the focus and each course's action before anything
 *    is confirmed, and proposing it enrols nothing.
 * 4. A course page previews the workload, independent work included, before any enrolment.
 * 5. The research studio, from a question to a report: shelf, versions, provenance, an artefact,
 *    feedback that says no model read it, a revision, the report and an oral discussion request.
 * 6. Quiet mode keeps the programme pages and the studio.
 * 7. A live model that cannot run is refused visibly and the learner's message is kept.
 * 8. Predicting again hides a laboratory's results until a new prediction is saved, across reloads.
 *
 * The owner account is shared with the other specs, so each step accepts what earlier runs left.
 */
test.describe.configure({ mode: "serial" });

const run = Date.now().toString(36);
const MODE_BADGE = /^(enrolled|audit|reading seminar)$/;
const PROGRAMME = "/programmes/mind-and-computation";
// A 1×1 transparent PNG.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

async function enrolmentCount(page: Page): Promise<number> {
  await page.goto("/studies");
  await expect(page.getByRole("heading", { level: 1, name: "Your courses" })).toBeVisible();
  return page.getByText(MODE_BADGE).count();
}

async function setImmersion(page: Page, immersion: "quiet" | "collegiate", social: boolean) {
  await page.goto("/settings");
  await page.locator(`input[name="immersion"][value="${immersion}"]`).check();
  const socialBox = page.locator('input[name="socialLayerEnabled"]');
  if (social) await socialBox.check();
  else await socialBox.uncheck();
  await page.locator("#experience").getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
}

async function chooseProvider(page: Page, provider: "fixture" | "anthropic") {
  await page.goto("/settings");
  await page.getByLabel("Provider", { exact: true }).selectOption(provider);
  await page.locator("#provider").getByRole("button", { name: "Save live tutoring settings" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
}

test.describe("the programme experience and the research studio", () => {
  test("an existing learner explores programmes from orientation without repeating it", async ({ page }) => {
    test.setTimeout(120_000);
    await signInOrBootstrap(page);
    const before = await enrolmentCount(page);

    await page.goto("/onboarding/2");
    await expect(page).toHaveURL(/\/onboarding\/2/);
    await page.getByRole("checkbox", { name: /Mind, Brain and AI/ }).check();
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page.getByText(/Nothing else changed: no programme was unfollowed or resumed and nothing was enrolled/)).toBeVisible({
      timeout: 30_000,
    });
    await screenshot(page, "44-orientation-revisited");

    // The steps that built the first plan no longer change anything.
    await page.goto("/onboarding/9");
    await expect(page.getByText("Orientation is complete")).toBeVisible();
    await expect(page.getByRole("button", { name: /build the timetable/i })).toHaveCount(0);

    expect(await enrolmentCount(page)).toBe(before);
  });

  test("the overview says where to begin; a block page separates readiness from progress and lists what is missing", async ({ page }) => {
    test.setTimeout(120_000);
    await signInOrBootstrap(page);
    await page.goto(PROGRAMME);
    await expect(page.getByRole("heading", { name: "Where to begin" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "The route, by stage" })).toBeVisible();
    await expect(page.getByText(/A suggested order of courses, not a chain of prerequisites/)).toBeVisible();

    await page.locator("li#MBI-09 summary").click();
    await page.getByRole("link", { name: /Open the MBI-09 page/ }).click();
    await expect(page).toHaveURL(/\/blocks\/MBI-09$/);
    await expect(page.getByRole("heading", { level: 1, name: "Planning and Structured Cognition" })).toBeVisible();
    for (const heading of [
      "Scope",
      "Courses and units that serve it",
      "Prerequisites and alternatives",
      "Activities and evidence of understanding",
      "Sources",
      "Next step",
      "Curriculum readiness",
      "Your progress",
      "Missing resources",
    ]) {
      await expect(page.getByRole("heading", { level: 2, name: heading, exact: true })).toBeVisible();
    }
    await expect(page.getByText(/it describes what can be taught, not what you understand/)).toBeVisible();
    const missing = page.locator("section", { has: page.getByRole("heading", { name: "Missing resources" }) });
    await expect(
      missing.getByText(/Source to identify for COG-250: Sources on hierarchical and compositional representations/),
    ).toBeVisible();
    await expect(missing.getByText(/A missing optional source never blocks other work/)).toBeVisible();
    // The missing source blocks nothing: the next step still opens prepared work.
    await expect(
      page
        .locator("section", { has: page.getByRole("heading", { name: "Next step" }) })
        .getByRole("link")
        .first(),
    ).toBeVisible();
    await screenshot(page, "45-block-page");

    await missing.getByRole("link", { name: "Library, Books to obtain" }).click();
    await expect(page).toHaveURL(/\/library\/requests/);
    await expect(page.getByText("Sources on hierarchical and compositional representations").first()).toBeVisible();
  });

  test("the director's route shows the focus change and each course's action before anything is confirmed", async ({ page }) => {
    test.setTimeout(120_000);
    await signInOrBootstrap(page);
    const before = await enrolmentCount(page);
    await page.goto(PROGRAMME);
    await page.getByRole("button", { name: "Ask the director for a route" }).click();
    await expect(page).toHaveURL(/\/director\?proposed=programme/, { timeout: 30_000 });
    const proposal = page.locator("li", { hasText: /Follow Mind, Brain and AI/ }).last();
    await expect(proposal.getByText(/enrols you in nothing/)).toBeVisible();
    await expect(proposal.getByText(/^Focus: |Your focus stays as it is\./).first()).toBeVisible();
    await expect(proposal.getByRole("link", { name: /^COG-2\d0 / }).first()).toBeVisible();
    await screenshot(page, "46-director-route");
    expect(await enrolmentCount(page)).toBe(before);
    // Declining leaves everything as it was.
    await page.goto("/director");
    const pending = page.locator("li", { hasText: /Follow Mind, Brain and AI/ }).last();
    const proposalId = await pending.locator('input[name="proposalId"]').first().getAttribute("value");
    await pending.getByRole("button", { name: "Reject" }).click();
    await expect(page.locator(`input[name="proposalId"][value="${proposalId}"]`)).toHaveCount(0, { timeout: 30_000 });
  });

  test("a course page previews the workload, independent work included, before enrolment", async ({ page }) => {
    await signInOrBootstrap(page);
    await page.goto("/courses/COG-201");
    const preview = page.locator("#workload");
    await expect(preview.getByText("Workload preview")).toBeVisible();
    await expect(preview.getByText(/counts independent work as well as timetabled study/)).toBeVisible();
    await expect(preview.getByText(/% is problems, laboratories and written work done on your own/)).toBeVisible();
    await expect(page.getByRole("button", { name: /take this course|withdraw/i }).first()).toBeVisible();
  });

  test("the research studio carries a question to a report, with honest feedback and recorded provenance", async ({ page }) => {
    test.setTimeout(300_000);
    await signInOrBootstrap(page);
    const title = `Forgetting and model recovery ${run}`;
    await page.goto("/studio");
    await expect(page.getByText("What the studio does not do")).toBeVisible();
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Question").fill("Does adding a forgetting term change which model is recovered in the ambiguous case?");
    await page.getByLabel("Kind of project").selectOption("computational");
    await page.getByRole("button", { name: "Start the project" }).click();
    await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByText("demonstration, not your work")).toHaveCount(0);

    // A focused shelf of verified records.
    await page.getByRole("checkbox", { name: /Ten simple rules for the computational modeling of behavioral data/ }).check();
    await page.getByRole("button", { name: "Save the shelf" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
    const shelf = page.locator("#shelf");
    await expect(shelf.getByRole("link", { name: /Ten simple rules/ })).toBeVisible();

    // The proposal starts from its kind's headings and is saved as a numbered version.
    const proposal = page.locator("#proposal");
    await expect(proposal.getByRole("textbox", { name: "Proposal" })).toHaveValue(/## Predictions before running/);
    await proposal.getByRole("button", { name: "Save as version 1" }).click();
    await expect(page.locator("#proposal").getByText(/^Version 1 · /)).toBeVisible({ timeout: 30_000 });

    // Provenance of the simulation, with its seed and generator.
    const provenance = page.locator("#provenance");
    await provenance.getByLabel("Kind").selectOption("simulation");
    await provenance.getByLabel("Title").fill("Synthetic bandit sessions");
    await provenance.getByLabel("Origin").fill("choice-model-loop laboratory, ambiguous case");
    await provenance.getByLabel("Random seed (simulations)").fill("7");
    await provenance.getByLabel("Generated by, with which settings (simulations)").fill("Rescorla-Wagner with forgetting, 200 trials");
    await provenance.getByRole("button", { name: "Record it" }).click();
    await expect(page.locator("#provenance").getByText("Synthetic bandit sessions")).toBeVisible({ timeout: 30_000 });

    // An intermediate artefact: a small image, served to its owner.
    const artifacts = page.locator("#artifacts");
    await artifacts.getByLabel("Title").fill("Confusion matrix, seeds 1 to 5");
    await artifacts.getByLabel(/^File/).setInputFiles({ name: "confusion.png", mimeType: "image/png", buffer: PNG });
    await artifacts.getByRole("button", { name: "Attach" }).click();
    await expect(artifacts.getByRole("link", { name: "Confusion matrix, seeds 1 to 5" })).toBeVisible({ timeout: 30_000 });

    // Feedback in the scripted demo is the structural checks alone, and says so.
    await page.locator("#feedback").getByRole("button", { name: "Ask for feedback" }).click();
    const feedback = page.locator("#feedback li").first();
    await expect(feedback.getByText("Scripted demo: no model read this")).toBeVisible({ timeout: 30_000 });
    await expect(feedback.getByText("met", { exact: true }).first()).toBeVisible();
    await screenshot(page, "47-studio-feedback");

    // A revision is a new version; the first is kept.
    await page
      .locator("#proposal")
      .getByRole("textbox", { name: "Proposal" })
      .fill(
        "## Question\n\nDoes a forgetting term change recovery?\n\n## Observations to explain\n\nRW is rarely recovered.\n\n## Models and their assumptions\n\nRW with and without forgetting.\n\n## Predictions before running\n\nRecovery stays poor.\n\n## Evaluation design\n\nFive seeds.\n\n## Limits\n\nSynthetic only.",
      );
    await page.locator("#proposal").getByRole("button", { name: "Save as version 2" }).click();
    await expect(page.locator("#proposal").getByText(/^Version 2 · /)).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("#proposal").getByText(/^Version 1 · /)).toBeVisible();

    // The report, assembled with the project's own records.
    const report = page.locator("#report");
    await report.getByRole("textbox", { name: "Report" }).fill("## The question\n\nAnswered below, on synthetic data only.");
    await report.getByRole("button", { name: "Save as version 1" }).click();
    await expect(page.locator("#report").getByText(/^Version 1 · /)).toBeVisible({ timeout: 30_000 });
    const href = await page.getByRole("link", { name: "Download the report as Markdown" }).getAttribute("href");
    const markdown = await (await page.request.get(href!)).text();
    expect(markdown).toContain(`# ${title}`);
    expect(markdown).toContain("**Synthetic bandit sessions** (simulation)");
    expect(markdown).toContain("no model read it (scripted demo)");

    // An optional oral discussion can be requested and withdrawn.
    const oral = page.locator("#oral");
    await oral.getByLabel("What to discuss").fill("Whether the forgetting term is identifiable in the ambiguous design.");
    await oral.getByLabel("Preferred times").fill("weekday evenings");
    await oral.getByRole("button", { name: "Request a discussion" }).click();
    await expect(page.locator("#oral").getByText("requested", { exact: true })).toBeVisible({ timeout: 30_000 });
    await page.locator("#oral").getByRole("button", { name: "Withdraw" }).click();
    await expect(page.locator("#oral").getByText("withdrawn", { exact: true })).toBeVisible({ timeout: 30_000 });

    // Everything persists across a reload, and the project is the learner's own on the records page.
    await page.reload();
    await expect(page.locator("#proposal").getByText(/^Version 2 · /)).toBeVisible();
    await expect(page.locator("#provenance").getByText("Synthetic bandit sessions")).toBeVisible();
    await screenshot(page, "48-studio-project");
    await page.goto("/records");
    await expect(page.getByText(title).first()).toBeVisible();
  });

  test("quiet mode keeps the programme pages and the studio", async ({ page }) => {
    test.setTimeout(120_000);
    await signInOrBootstrap(page);
    await setImmersion(page, "quiet", false);
    try {
      await page.goto(PROGRAMME);
      await expect(page.getByRole("heading", { name: "Where to begin" })).toBeVisible();
      await page.goto(`${PROGRAMME}/blocks/MBI-06`);
      await expect(page.getByRole("heading", { level: 2, name: "Next step" })).toBeVisible();
      await page.goto("/studio");
      await expect(page.getByRole("heading", { level: 1, name: "Your own questions" })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Research Studio" })).toBeVisible();
    } finally {
      await setImmersion(page, "collegiate", true);
    }
  });

  test("a live model that cannot run is refused visibly, and the learner's message is kept", async ({ page }) => {
    test.setTimeout(180_000);
    await signInOrBootstrap(page);
    // Without a stored key and without approval of paid use the live model is blocked, whichever
    // reason applies first on this machine.
    const blockedReason = /no API key is stored|paid use has not been approved/;
    await chooseProvider(page, "anthropic");
    try {
      const notice = page.locator("#provider").getByRole("alert").filter({ hasText: "Live model blocked" });
      await expect(notice).toBeVisible();
      await expect(notice).toContainText(blockedReason);

      await page.goto("/courses/MAT-230/units/MAT-230-u01");
      await page
        .locator("li", { hasText: "Tutorial: two norms on C([0,1])" })
        .getByRole("button", { name: /start|resume|continue/i })
        .click();
      await expect(page).toHaveURL(/\/sessions\//, { timeout: 30_000 });
      const message = `Provider check ${run}: is the sup norm complete on C([0,1])?`;
      await page.getByLabel("Message to the tutor").fill(message);
      await page.getByRole("button", { name: "Send" }).click();
      await expect(page.getByRole("alert").filter({ hasText: blockedReason })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(message)).toBeVisible({ timeout: 30_000 });
      await screenshot(page, "49-provider-blocked");
      await page.reload();
      await expect(page.getByText(message)).toBeVisible();
    } finally {
      await chooseProvider(page, "fixture");
    }
    await expect(page.locator("#provider").getByRole("status").filter({ hasText: "No model is configured" })).toBeVisible();
  });

  test("predicting again hides the laboratory's results until a new prediction is saved", async ({ page }) => {
    test.setTimeout(240_000);
    await signInOrBootstrap(page);
    await takeCourse(page, "COG-250");
    await page.getByRole("link", { name: /Planning strategies and transfer/ }).click();
    await page
      .locator("li", { hasText: /Laboratory: planning strategies after a change/ })
      .first()
      .getByRole("button", { name: /start|resume|continue/i })
      .click();
    await expect(page).toHaveURL(/\/sessions\//, { timeout: 30_000 });
    const gate = page.getByRole("heading", { name: "Your prediction first" });
    const results = page.getByRole("columnheader", { name: "First move" });
    const save = page.getByRole("button", { name: "Save my prediction and show the results" });
    const predict = async (text: string) => {
      await page.getByRole("textbox", { name: "Prediction", exact: true }).fill(text);
      await save.click();
      await expect(gate).toHaveCount(0, { timeout: 30_000 });
    };
    if (await gate.isVisible().catch(() => false)) {
      await predict(
        `Run ${run}: the planner, told of the new goal, turns at once; the cached policy keeps its old route because its values point there.`,
      );
    }
    await expect(results.first()).toBeVisible({ timeout: 30_000 });

    await page.getByRole("button", { name: "Predict again" }).click();
    await expect(gate).toBeVisible({ timeout: 30_000 });
    await expect(results).toHaveCount(0);
    await page.reload();
    await expect(gate).toBeVisible();
    await expect(results).toHaveCount(0);
    await predict(
      `Run ${run}, second prediction: with a blocked corridor the planner bumps once and replans; the cached policy bumps repeatedly.`,
    );
    await expect(results.first()).toBeVisible({ timeout: 30_000 });
  });
});
