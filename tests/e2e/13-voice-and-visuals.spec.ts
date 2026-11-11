import { expect, test } from "@playwright/test";
import { activityButton, screenshot, signInOrBootstrap, takeCourse } from "./helpers";

/**
 * Journey 13 (teaching-experience brief, EXT-01 and EXT-02):
 * - a visual explanation opens from its unit, steps through its scenes with typeset equations,
 *   plots and captions, and offers its film with a caption track; the film serves byte ranges to
 *   the signed-in learner and nothing to an anonymous request;
 * - dictation is hidden until the learner allows it in Settings; once allowed, recognised text lands
 *   in the learner's own box and is not sent, and a dictated attempt is marked as a spoken explanation.
 *
 * Headless Chromium has no speech service, so the dictation journeys install stand-ins for the
 * browser's SpeechRecognition: one returns a fixed phrase, the other delivers results only when the
 * test emits them (to check cancel, stop and capture ending on send). They are test doubles: they
 * check the wiring (permission, editable text, nothing sent automatically, cancellation, the
 * fallback to typing), not any vendor's recogniser.
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
    await page.locator("summary", { hasText: "Visual explanations" }).click();
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
    await (await activityButton(page, "Tutorial: two norms on C([0,1])")).click();
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

  test("cancel stops capture at once, stop keeps what was heard, sending stops it, and a browser without recognition offers typing", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    // A stand-in the test drives: results arrive only when the test emits them, as a live recogniser's would.
    await page.addInitScript(CONTROLLED_RECOGNITION);
    await page.goto("/settings#voice");
    if (
      await page
        .getByRole("button", { name: "Allow dictation" })
        .isVisible()
        .catch(() => false)
    ) {
      await page.getByLabel(/my browser may send the audio to its maker/).check();
      await page.getByRole("button", { name: "Allow dictation" }).click();
      await expect(page.getByText("dictation allowed")).toBeVisible();
    }
    await takeCourse(page, "MAT-230");
    await page.goto("/courses/MAT-230/units/MAT-230-u01");
    await (await activityButton(page, "Tutorial: two norms on C([0,1])")).click();
    await expect(page).toHaveURL(/\/sessions\//);
    const session = page.url();
    const panel = page.locator("#panel-tutor");
    const message = page.getByLabel("Message to the tutor");
    const emit = (text: string, isFinal: boolean) =>
      page.evaluate(([t, f]) => (window as unknown as { __rec: { emit(t: string, f: boolean): void } }).__rec.emit(t, f), [
        text,
        isFinal,
      ] as const);

    await expect(panel.getByRole("button", { name: "Dictate" })).toBeVisible();
    await message.fill("");
    await panel.getByRole("button", { name: "Dictate" }).click();
    await expect(panel.getByRole("button", { name: "Stop dictation" })).toBeVisible();
    await emit("half heard", false);
    await expect(panel.getByRole("status").filter({ hasText: "Listening: half heard" })).toBeVisible();
    await emit("first phrase", true);
    await expect(message).toHaveValue("first phrase");
    await panel.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(panel.getByRole("button", { name: "Dictate" })).toBeVisible();
    // Speech arriving after Cancel is dropped; what was already written stays, editable.
    await emit("late words", true);
    await expect(message).toHaveValue("first phrase");

    // Stop lets the recogniser finish what it heard.
    await panel.getByRole("button", { name: "Dictate" }).click();
    await page.evaluate(() => {
      (window as unknown as { __onStop: string }).__onStop = "and the rest";
    });
    await panel.getByRole("button", { name: "Stop dictation" }).click();
    await expect(message).toHaveValue("first phrase and the rest");

    // Sending disables the box, which stops capture: nothing more is appended.
    await panel.getByRole("button", { name: "Dictate" }).click();
    await panel.getByRole("button", { name: "Send" }).click();
    await expect(panel.getByRole("button", { name: "Dictate" })).toBeVisible({ timeout: 60_000 });
    await emit("after sending", true);
    await expect(message).not.toHaveValue(/after sending/);

    // A refused microphone is said in words, and typing still works.
    await panel.getByRole("button", { name: "Dictate" }).click();
    await page.evaluate(() => (window as unknown as { __rec: { fail(e: string): void } }).__rec.fail("not-allowed"));
    await expect(panel.getByRole("alert").filter({ hasText: /The microphone was refused/ })).toBeVisible();

    // A browser with no recognition says so beside the box.
    const plain = await page.context().newPage();
    await plain.addInitScript("delete window.SpeechRecognition; delete window.webkitSpeechRecognition;");
    await plain.goto(session);
    await expect(plain.locator("#panel-tutor").getByTestId("dictation-unavailable")).toHaveText(
      /not available in this browser; type instead/,
    );
    await plain.getByLabel("Message to the tutor").fill("Typed instead.");
    await expect(plain.getByLabel("Message to the tutor")).toHaveValue("Typed instead.");
    await plain.close();
  });
});

const CONTROLLED_RECOGNITION = `
  class ControlledRecognition {
    start() { window.__rec = this; this.live = true; }
    // Delivers even after abort, as a real recogniser's late result can: the page must ignore it.
    emit(text, isFinal) { if (this.onresult) this.onresult({ resultIndex: 0, results: [{ isFinal, 0: { transcript: text } }] }); }
    fail(error) { this.live = false; this.onerror && this.onerror({ error }); this.onend && this.onend(); }
    stop() {
      if (window.__onStop) this.emit(window.__onStop, true);
      window.__onStop = "";
      this.live = false;
      this.onend && this.onend();
    }
    abort() { this.live = false; this.onerror && this.onerror({ error: "aborted" }); this.onend && this.onend(); }
  }
  window.SpeechRecognition = ControlledRecognition;
`;
