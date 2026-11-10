import { expect, test } from "@playwright/test";
import { screenshot, signInOrBootstrap, takeCourse } from "./helpers";

/**
 * Journey 13 (teaching-experience brief, EXT-01 and EXT-02):
 * - a visual explanation opens from its unit, steps through its scenes with typeset equations,
 *   plots and captions, and offers its film with a caption track; the film serves byte ranges to
 *   the signed-in learner and nothing to an anonymous request;
 * - dictation is hidden until the learner allows it in Settings; once allowed, recognised text lands
 *   in the learner's own box and is not sent, and a dictated attempt is marked as a spoken explanation.
 *
 * Headless Chromium has no speech service, so the dictation journey installs a stand-in for the
 * browser's SpeechRecognition that returns a fixed phrase. It is a test double: it checks the wiring
 * (permission, editable text, nothing sent automatically), not any vendor's recogniser.
 * Safe to re-run on a database that already holds earlier runs.
 */
const FAKE_RECOGNITION = `
  window.__dictation = "a norm measures the size of a vector";
  class FakeRecognition {
    start() {
      setTimeout(() => this.onresult && this.onresult({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: window.__dictation } }] }), 50);
      setTimeout(() => this.onend && this.onend(), 120);
    }
    stop() { this.onend && this.onend(); }
    abort() {}
  }
  window.SpeechRecognition = FakeRecognition;
`;

test.describe("voice and visual teaching", () => {
  test.beforeEach(async ({ page }) => {
    await signInOrBootstrap(page);
  });

  test("a visual explanation steps through its scenes and offers its film with captions", async ({ page }) => {
    test.setTimeout(120_000);
    await takeCourse(page, "NEU-220");
    await page.goto("/courses/NEU-220/units/NEU-220-u01");
    await page.getByRole("link", { name: "The leaky integrate-and-fire neuron, from circuit to spikes", exact: true }).click();
    await expect(page).toHaveURL(/\/visuals\/lif-membrane-potential/);
    await expect(page.getByRole("heading", { level: 2, name: /^1\/4/ })).toBeVisible();
    await expect(page.locator(".katex").first()).toBeVisible();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("heading", { level: 2, name: /^2\/4/ })).toBeVisible();
    await expect(page.getByRole("img", { name: /V\(t\)/ })).toBeVisible();
    await expect(page.getByTestId("scene-caption")).not.toBeEmpty();
    await expect(page.getByText(/E_L \+ RI = .* mV/).first()).toBeVisible();
    const film = page.getByTestId("film");
    await expect(film).toBeVisible();
    await expect(film.locator("track[kind=captions]")).toHaveCount(1);
    await screenshot(page, "13-visual-explanation");

    const captions = await page.request.get("/api/visuals/lif-membrane-potential/captions");
    expect(captions.status()).toBe(200);
    expect(captions.headers()["content-type"]).toContain("text/vtt");
    expect(await captions.text()).toMatch(/^WEBVTT\n\n1\n00:00:00\.\d{3} --> /);
    const range = await page.request.get("/api/visuals/lif-membrane-potential/film", { headers: { range: "bytes=0-99" } });
    expect(range.status()).toBe(206);
    expect(range.headers()["content-range"]).toMatch(/^bytes 0-99\/\d+$/);
    expect((await range.body()).byteLength).toBe(100);
  });

  test("films and captions refuse anonymous requests", async ({ playwright, baseURL }) => {
    const anonymous = await playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    expect((await anonymous.get("/api/visuals/lif-membrane-potential/film")).status()).toBe(401);
    expect((await anonymous.get("/api/visuals/lif-membrane-potential/captions")).status()).toBe(401);
    await anonymous.dispose();
  });

  test("dictation stays hidden until allowed; dictated text is editable, never sent by itself, and marked when submitted", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const policy = (await page.request.get("/campus")).headers()["permissions-policy"];
    expect(policy).toContain("microphone=(self)");
    await page.addInitScript(FAKE_RECOGNITION);

    // Start from no permission.
    await page.goto("/settings#voice");
    const stop = page.getByRole("button", { name: "Stop allowing dictation" });
    if (await stop.isVisible().catch(() => false)) await stop.click();
    await expect(page.getByRole("button", { name: "Allow dictation" })).toBeVisible();

    await takeCourse(page, "MAT-230");
    await page.goto("/courses/MAT-230/units/MAT-230-u01");
    await page
      .locator("li", { hasText: "Tutorial: two norms on C([0,1])" })
      .getByRole("button", { name: /^(Start|Resume|Continue)/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/sessions\//);
    const session = page.url();
    await expect(page.getByLabel("Message to the tutor")).toBeVisible();
    await expect(page.locator("#panel-tutor").getByRole("button", { name: "Dictate" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Explain aloud" })).toHaveCount(0);

    // Allowing it requires ticking the disclosure.
    await page.goto("/settings#voice");
    await page.getByRole("button", { name: "Allow dictation" }).click();
    await expect(page.getByText("Tick the box to allow dictation.")).toBeVisible();
    await page.getByLabel(/my browser may send the audio to its maker/).check();
    await page.getByRole("button", { name: "Allow dictation" }).click();
    await expect(page.getByText("dictation allowed")).toBeVisible();

    await page.goto(session);
    const message = page.getByLabel("Message to the tutor");
    // The button appears only once the page has hydrated, so typing below reaches React's state.
    await expect(page.locator("#panel-tutor").getByRole("button", { name: "Dictate" })).toBeVisible();
    await message.fill("Briefly:");
    const learnerMessages = page.locator("#panel-tutor").getByText("You", { exact: true });
    const before = await learnerMessages.count();
    await page.locator("#panel-tutor").getByRole("button", { name: "Dictate" }).click();
    await expect(message).toHaveValue("Briefly: a norm measures the size of a vector");
    await expect(learnerMessages).toHaveCount(before);
    await message.fill("Corrected by hand: a norm measures size.");
    await expect(message).toHaveValue("Corrected by hand: a norm measures size.");

    const attempt = page.getByLabel("Attempt (Markdown with LaTeX)");
    const fresh = page.getByRole("button", { name: /^Start a new attempt: Practice/ });
    if (await fresh.isVisible().catch(() => false)) await fresh.click();
    await expect(attempt).toBeEnabled({ timeout: 60_000 });
    await attempt.fill("Take f_n(x) = x^n on [0,1]: the sup norm is 1 and the integral norm is 1/(n+1), so no constant works, and");
    await page.evaluate(() => {
      (window as unknown as { __dictation: string }).__dictation = "the two norms are not equivalent on this space.";
    });
    await page.getByRole("button", { name: "Explain aloud" }).click();
    await expect(attempt).toHaveValue(/so no constant works, and the two norms are not equivalent on this space\.$/);
    await expect(page.getByText(/Dictated text is yours to correct/)).toBeVisible();
    await screenshot(page, "13-dictated-attempt");
    await page.getByRole("button", { name: /submit (attempt|revision)/i }).click();
    await expect(page.locator("article").first().getByText("spoken explanation · dictated, corrected by you")).toBeVisible({
      timeout: 90_000,
    });

    // Withdrawing hides the controls again.
    await page.goto("/settings#voice");
    await page.getByRole("button", { name: "Stop allowing dictation" }).click();
    await expect(page.getByRole("button", { name: "Allow dictation" })).toBeVisible();
  });
});
