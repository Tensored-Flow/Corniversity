import { type Browser, expect, type Page, test } from "@playwright/test";
import { AUTH_STATE, activityButton, screenshot, signInOrBootstrap, takeCourse } from "./helpers";

/**
 * Journey 11 (teaching-experience brief, CORE-01 to CORE-03), with the scripted demo:
 * - continuity: a reading resumes at the same heading on a second device; a selected line is
 *   asked about and noted; pausing and reopening resumes the session;
 * - drafts: two devices save the same attempt, the stale one gets a conflict and both versions;
 *   an offline device keeps the work and saves it when the connection returns;
 * - help: a selected step is checked with its lines attached, labelled scripted;
 * - paper: a photographed page is attached, an uncertain symbol must be confirmed before the
 *   transcription is submitted, and the scripted demo never claims to read the image;
 * - bridges: a prerequisite opens its bridge, the self-check is kept, and Return goes back to the
 *   exact exercise.
 * Safe to re-run on a database that already holds earlier runs.
 */

const UNIT = "/courses/MAT-230/units/MAT-230-u01";

async function openActivity(page: Page, title: string): Promise<string> {
  await page.goto(UNIT);
  const button = await activityButton(page, title);
  await button.click();
  await expect(page).toHaveURL(/\/sessions\/[0-9a-f-]{36}/, { timeout: 30_000 });
  return page.url().split("?")[0]!;
}

async function secondDevice(browser: Browser, url: string): Promise<Page> {
  const context = await browser.newContext({ storageState: AUTH_STATE, viewport: { width: 1280, height: 860 } });
  const page = await context.newPage();
  await page.goto(url);
  return page;
}

/** Selects the text of the first element matching `selector` inside the lesson. */
async function selectText(page: Page, selector: string, contains: string): Promise<void> {
  await page.evaluate(
    ({ selector, contains }) => {
      const el = [...document.querySelectorAll<HTMLElement>(selector)].find((e) => e.textContent?.includes(contains));
      if (!el) throw new Error(`no element containing ${contains}`);
      el.scrollIntoView({ block: "center" });
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = document.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(range);
    },
    { selector, contains },
  );
}

/** Waits until the attempt's save line reports a revision newer than `before`. */
async function savedAfter(page: Page, before: number): Promise<number> {
  const line = page.getByTestId("save-state");
  await expect(async () => {
    const m = /revision (\d+)/.exec((await line.textContent()) ?? "");
    expect(m && Number(m[1]) > before).toBeTruthy();
  }).toPass({ timeout: 20_000 });
  return Number(/revision (\d+)/.exec((await line.textContent()) ?? "")?.[1]);
}

async function currentRevision(page: Page): Promise<number> {
  const m = /revision (\d+)/.exec((await page.getByTestId("save-state").textContent()) ?? "");
  return m ? Number(m[1]) : 0;
}

test.describe("study continuity, paper work and bridges", () => {
  test.beforeEach(async ({ page }) => {
    await signInOrBootstrap(page);
    await takeCourse(page, "MAT-230");
  });

  test("a reading resumes on another device, and a selected line is asked about and noted", async ({ page, browser }) => {
    test.setTimeout(180_000);
    const url = await openActivity(page, "Lecture 1: normed and Banach spaces");
    await expect(page.getByRole("heading", { name: "Banach spaces", exact: true })).toBeVisible();
    // Reading on to a section other than the one saved last time saves that place on the server.
    const resumedAtBanach = await page
      .getByText("Resumed at “Banach spaces”")
      .isVisible()
      .catch(() => false);
    const target = resumedAtBanach ? "The sup norm on bounded continuous functions" : "Banach spaces";
    await page
      .getByRole("heading", { name: target, exact: true })
      .evaluate((h) => window.scrollTo(0, h.getBoundingClientRect().top + window.scrollY - 80));
    await expect(page.getByText("Reading position saved on the server.")).toBeVisible({ timeout: 20_000 });

    const other = await secondDevice(browser, url);
    await expect(other.getByText(`Resumed at “${target}”, where you were last reading.`)).toBeVisible({ timeout: 20_000 });
    await other.context().close();

    await selectText(page, ".prose-reading p", "Banach space");
    await expect(page.getByText(/^Selected:/)).toBeVisible();
    await page.getByRole("button", { name: "Ask about this" }).click();
    await expect(page.getByText(/^Selected passage:/)).toBeVisible();
    await page.getByText("What the tutor will see").click();
    await expect(page.getByText(/The passage you selected/)).toBeVisible();
    await expect(page.getByText(/any reference solution \(the tutor is never given one\)/)).toBeVisible();
    await screenshot(page, "11-selection-question-context");
    await page.getByLabel("Message to the tutor").fill("Why is completeness needed here and not just closedness?");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText(/Scripted demo/).last()).toBeVisible({ timeout: 30_000 });

    await selectText(page, ".prose-reading p", "Banach space");
    await page.getByRole("button", { name: "Note this" }).click();
    await page.getByLabel("Note text").fill("Completeness is intrinsic; closedness depends on an ambient space.");
    await page.getByRole("button", { name: "Save note" }).click();
    await expect(page.getByText("Saved on the server, in your notebook.")).toBeVisible();

    await page.getByRole("button", { name: "Pause" }).click();
    await expect(page).toHaveURL(/\/campus/);
    await page.goto(url);
    await expect(page.getByText(/Resumed from where you paused/)).toBeVisible();
  });

  test("two devices and a lost connection never overwrite a newer draft", async ({ page, browser, context }) => {
    test.setTimeout(180_000);
    const url = await openActivity(page, "Tutorial: two norms on C([0,1])");
    const attempt = page.getByLabel("Attempt (Markdown with LaTeX)");
    // An accepted attempt from an earlier run stays as it is; this run starts a new one.
    const fresh = page.getByRole("button", { name: /^Start a new attempt: Practice/ });
    if (await fresh.isVisible().catch(() => false)) {
      await fresh.click();
      await expect(attempt).toBeEnabled({ timeout: 20_000 });
    }
    test.skip(!(await attempt.isEnabled()), "the attempt is being assessed from an earlier run");
    const stamp = Date.now();
    const start = await currentRevision(page);
    await attempt.fill(`Laptop draft ${stamp}: let f_n(x) = x^n on [0,1].`);
    await savedAfter(page, start);

    const phone = await secondDevice(browser, url);
    const phoneAttempt = phone.getByLabel("Attempt (Markdown with LaTeX)");
    await expect(phoneAttempt).toHaveValue(new RegExp(`Laptop draft ${stamp}`));
    const phoneStart = await currentRevision(phone);
    await phoneAttempt.fill(`Phone draft ${stamp}: the sup norm of f_n is 1.`);
    await savedAfter(phone, phoneStart);

    // The laptop still believes the earlier revision is current.
    await attempt.fill(`Laptop draft ${stamp}: an older line written before the phone.`);
    await expect(page.getByText(/This attempt was saved elsewhere/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(`Phone draft ${stamp}: the sup norm of f_n is 1.`)).toBeVisible();
    await screenshot(page, "11-draft-conflict");
    await page.getByRole("button", { name: "Use the server version" }).click();
    await expect(attempt).toHaveValue(`Phone draft ${stamp}: the sup norm of f_n is 1.`);
    await phone.context().close();

    // Offline: the work stays on the device and is saved when the connection returns.
    await context.setOffline(true);
    await attempt.fill(`Phone draft ${stamp}: the sup norm of f_n is 1.\nWritten offline: the integral norm is 1/(n+1).`);
    await expect(page.getByTestId("save-state")).toHaveText(/Saved on this device only/, { timeout: 20_000 });
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(page.getByTestId("save-state")).toHaveText(/Saved on the server/, { timeout: 30_000 });
    await page.reload();
    await expect(attempt).toHaveValue(/Written offline: the integral norm is 1\/\(n\+1\)\./);

    // A selected step goes to the tutor with its lines attached.
    // Select line 2 with the keyboard, as a learner would (retried until the reloaded page has
    // hydrated and listens for the selection).
    await expect(async () => {
      await attempt.evaluate((el: HTMLTextAreaElement) => {
        el.focus();
        const start = el.value.indexOf("Written");
        el.setSelectionRange(start, start);
      });
      await page.keyboard.press("Shift+End");
      await expect(page.getByText("Lines 2–2 selected for a step check.")).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 20_000 });
    await page.getByRole("button", { name: "Check this step" }).click();
    await expect(page.getByText(/^Attempt lines 2–2:/)).toBeVisible();
    await page.getByRole("button", { name: "Ask for: check this step" }).click();
    await expect(page.getByText(/the lines you selected have not been checked/).last()).toBeVisible({ timeout: 30_000 });
  });

  test("paper work: an uncertain symbol must be confirmed, and the scripted demo never reads the image", async ({ page }) => {
    test.setTimeout(180_000);
    const url = await openActivity(page, "Tutorial: two norms on C([0,1])");
    await page.goto(`${url}?exercise=MAT-230-u01-ex2`);
    await expect(page.getByLabel("Attempt (Markdown with LaTeX)")).toBeVisible();
    const fresh = page.getByRole("button", { name: /^Start a new attempt: Practice/ });
    if (await fresh.isVisible().catch(() => false)) await fresh.click();
    const submitPaper = page.getByRole("button", { name: "Submit pages and transcription" });
    // The panel opens by itself once pages exist; open it only when it is folded.
    if (!(await submitPaper.isVisible().catch(() => false))) {
      await page.getByText("Working on paper? Attach photographs or a PDF of your pages").click();
    }
    test.skip(!(await submitPaper.isVisible().catch(() => false)), "this attempt is being assessed from an earlier run");

    // A real photograph-like JPEG made in the browser, then uploaded through the file input.
    const jpeg = await page.evaluate(async () => {
      const c = document.createElement("canvas");
      c.width = 400;
      c.height = 300;
      const g = c.getContext("2d")!;
      g.fillStyle = "#fff";
      g.fillRect(0, 0, 400, 300);
      g.fillStyle = "#123";
      g.font = "28px serif";
      g.fillText("Let ε > 0, choose δ = ε/2", 20, 150);
      const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), "image/jpeg", 0.9));
      return Array.from(new Uint8Array(await blob.arrayBuffer()));
    });
    await page
      .locator('input[type="file"][multiple]')
      .setInputFiles({ name: "page-1.jpg", mimeType: "image/jpeg", buffer: Buffer.from(jpeg) });
    await expect(page.getByAltText(/Page 1 of your handwritten work/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/no model is configured \(scripted demo\), and the scripted demo never reads images/)).toBeVisible();

    const transcription = page.getByLabel("Transcription", { exact: true });
    await transcription.fill("[page 1]\nLet [[?ε or e]] > 0 and choose δ = ε/2, so |f(x) − f(y)| < ε whenever |x − y| < δ.");
    await expect(page.getByText(/Please confirm this symbol/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirm transcription" })).toBeDisabled();
    await screenshot(page, "11-paper-confirm-symbol");
    await transcription.fill("[page 1]\nLet ε > 0 and choose δ = ε/2, so |f(x) − f(y)| < ε whenever |x − y| < δ.");
    await page.getByRole("button", { name: "Confirm transcription" }).click();
    await expect(page.getByText(/written by you · confirmed/)).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Submit pages and transcription" }).click();
    await expect(page.getByText(/paper work · transcription v\d+/).first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Scripted demo assessor: no model read this").first()).toBeVisible({ timeout: 90_000 });
  });

  test("a prerequisite bridge keeps the self-check and returns to the exact exercise", async ({ page }) => {
    test.setTimeout(120_000);
    const url = await openActivity(page, "Tutorial: two norms on C([0,1])");
    await page.getByRole("tab", { name: /Prerequisites/ }).click();
    const metric = page.locator("li", { hasText: "Metric spaces" });
    await expect(metric.getByText(/not yet shown|reported knowing it|supported by your submitted work/)).toBeVisible();
    await metric.getByRole("link", { name: "Explain this prerequisite" }).click();
    await expect(page).toHaveURL(/\/bridges\/metric-spaces\?visit=/);
    await expect(page.getByRole("heading", { level: 1, name: "Completeness: why Banach spaces ask for it" })).toBeVisible();
    await expect(page.getByText("Bridge 1 of at most 2")).toBeVisible();
    await screenshot(page, "11-bridge");
    const answer = page.getByLabel("Your answer");
    if (await answer.isVisible().catch(() => false)) {
      await answer.fill(
        "c_00 with the sup norm and the series of 2^{-k} e_k: absolutely convergent, but its limit is not finitely supported.",
      );
      await page.getByRole("button", { name: "Save my answer and show the guidance" }).click();
    }
    await expect(page.getByText("Guidance", { exact: true })).toBeVisible();
    await expect(page.getByText(/not assessed and records no evidence/)).toBeVisible();
    await page
      .getByRole("button", { name: /Return to Tutorial: two norms on C\(\[0,1\]\)/ })
      .first()
      .click();
    await expect(page).toHaveURL(new RegExp(`${url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\?exercise=MAT-230-u01-ex1`));
    await expect(page.getByLabel("Attempt (Markdown with LaTeX)")).toBeVisible();
  });
});
