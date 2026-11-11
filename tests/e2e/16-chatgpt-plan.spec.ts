import { expect, test } from "@playwright/test";
import { type FakeOpenAI, startFakeOpenAI } from "../../packages/ai/src/chatgpt-plan.fake";
import { activityButton, signInOrBootstrap, takeCourse } from "./helpers";

/**
 * Journey 16: teaching through the owner's ChatGPT plan in a local installation, end to end in
 * the browser, against a TEST DOUBLE of OpenAI's sign-in and Responses API (never OpenAI).
 * Choose the plan; Continue with ChatGPT through the sign-in and consent; pick a model from the
 * account's list and approve request limits; a tutor reply comes through the plan and says so;
 * a usage limit stops the request, keeps the learner's message and pauses plan requests until the
 * owner resumes; signing out revokes the session.
 *
 * It needs a stack whose CHATGPT_PLAN_AUTH_BASE and CHATGPT_PLAN_API_BASE point at the double's
 * port (E2E_CHATGPT_PLAN_FAKE_PORT), served on 127.0.0.1; the ordinary development stack points
 * at OpenAI, so the journey is skipped there.
 */
const FAKE_PORT = Number(process.env.E2E_CHATGPT_PLAN_FAKE_PORT ?? 0);
test.skip(!FAKE_PORT, "needs the plan rehearsal stack (E2E_CHATGPT_PLAN_FAKE_PORT)");
test.describe.configure({ mode: "serial" });

let fake: FakeOpenAI;
test.beforeAll(async () => {
  fake = await startFakeOpenAI(FAKE_PORT);
});
test.afterAll(async () => {
  await fake?.close();
});

test("the owner connects their ChatGPT plan, approves limits, is taught through it, is paused by a limit, and signs out", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await signInOrBootstrap(page);
  await page.goto("/settings#chatgpt-plan");
  const card = page.locator("#chatgpt-plan");
  await expect(card.getByRole("heading", { name: "ChatGPT plan", exact: true })).toBeVisible();
  // Start signed out and unpaused, whatever an earlier run (at the other screen size) left.
  const signOut = card.getByRole("button", { name: "Sign out of ChatGPT here" });
  if (await signOut.isVisible().catch(() => false)) await signOut.click();
  const resume = card.getByRole("button", { name: "Resume plan requests" });
  if (await resume.isVisible().catch(() => false)) await resume.click();
  await expect(card.getByTestId("plan-connection")).toContainText("not connected");

  // Choose the plan as the way to teach: blocked, never scripted, until it is connected.
  await page.locator("#provider-choice").selectOption("chatgpt_plan");
  await page.getByRole("button", { name: "Save live tutoring settings" }).click();
  await expect(page.locator("#provider").getByText(/Your ChatGPT plan is chosen but not connected/)).toBeVisible();

  // Sign in with OpenAI (the double consents) and come back to Settings.
  await card.getByRole("button", { name: "Continue with ChatGPT" }).click();
  await expect(page).toHaveURL(/\/settings\?plan=connected/, { timeout: 60_000 });
  await expect(card.getByText("You're using your ChatGPT plan")).toBeVisible();
  await expect(card.getByTestId("plan-connection")).toContainText("Signed in to ChatGPT as owner@example.test");

  // The model list comes from the account; hidden models are not offered.
  const model = card.getByLabel("Model", { exact: true });
  await expect(model.locator("option")).toHaveText(["Choose a model", "GPT Fake 1", "GPT Fake 2"]);
  await model.selectOption("gpt-fake-1");
  await card.getByLabel("Requests a day (UTC)").fill("50");
  await card.getByLabel("Requests a month (UTC)").fill("200");
  await card.getByLabel(/I approve teaching through my ChatGPT plan/).check();
  await card.getByRole("button", { name: "Save ChatGPT plan settings" }).click();
  await expect(card.getByText(/Approved on .* for gpt-fake-1, up to 50 a day and 200 a month/)).toBeVisible();
  await expect(page.locator("#provider").getByText("Your ChatGPT plan: gpt-fake-1")).toBeVisible();

  // A tutor reply through the plan, labelled as such.
  await takeCourse(page, "MAT-230");
  await page.goto("/courses/MAT-230/units/MAT-230-u01");
  await (await activityButton(page, "Tutorial: two norms on C([0,1])")).click();
  await expect(page).toHaveURL(/\/sessions\//);
  await expect(page.getByText(/AI Tutor .* · gpt-fake-1 via your ChatGPT plan/).first()).toBeVisible();
  const panel = page.locator("#panel-tutor");
  const message = page.getByLabel("Message to the tutor");
  // The session may hold turns from earlier runs: count, and wait for new ones.
  const replies = panel.getByText("A reply from the plan test double.");
  const limits = panel.getByText(/usage limit for this app on your ChatGPT plan has been reached/);
  const [repliesBefore, limitsBefore] = [await replies.count(), await limits.count()];
  const question = `Why is the sup norm of x^n equal to 1? (${test.info().project.name} ${Date.now()})`;
  await expect(panel.getByRole("button", { name: "Send" })).toBeVisible();
  await expect(async () => {
    await message.fill(question);
    await expect(panel.getByRole("button", { name: "Send" })).toBeEnabled({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  await panel.getByRole("button", { name: "Send" }).click();
  await expect(replies).toHaveCount(repliesBefore + 1, { timeout: 60_000 });
  const sent = fake.responsesRequests.at(-1)!;
  expect(sent).toMatchObject({ model: "gpt-fake-1", store: false, stream: true });
  expect(JSON.stringify(sent.input)).toContain(question);

  // A usage limit stops the request: the learner's message stays, nothing scripted replaces it.
  fake.responsesMode = "limit_prestream";
  const followUp = `And the integral norm? (${Date.now()})`;
  await message.fill(followUp);
  await panel.getByRole("button", { name: "Send" }).click();
  await expect(limits).toHaveCount(limitsBefore + 1, { timeout: 60_000 });
  await expect(panel.getByText(followUp)).toBeVisible();
  fake.responsesMode = "ok";
  await page.reload();
  await expect(page.getByText(/model blocked/).first()).toBeVisible();

  await page.goto("/settings#chatgpt-plan");
  await expect(card.getByText(/Paused because the usage limit for this app on your ChatGPT plan was reached/)).toBeVisible();
  await card.getByRole("button", { name: "Resume plan requests" }).click();
  await expect(card.getByText("Plan requests resumed.")).toBeVisible();

  // Signing out revokes the renewable session and removes the tokens.
  const revokedBefore = fake.revoked.length;
  await card.getByRole("button", { name: "Sign out of ChatGPT here" }).click();
  await expect(card.getByText(/OpenAI confirmed the session was revoked/)).toBeVisible();
  expect(fake.revoked).toHaveLength(revokedBefore + 1);
  await expect(card.getByTestId("plan-connection")).toContainText("not connected");

  // Leave the stack in the scripted demo, which the other journeys require.
  await page.locator("#provider-choice").selectOption("fixture");
  await page.getByRole("button", { name: "Save live tutoring settings" }).click();
  await expect(page.locator("#provider").getByText(/No model is configured/)).toBeVisible();
});
