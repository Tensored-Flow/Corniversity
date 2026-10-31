import { execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { screenshot, signInOrBootstrap } from "./helpers";
import { makePdf } from "./pdf";

/**
 * Journeys 5 and 6 (library and companion), plus the Milestone 4 acceptance checks.
 *
 * 5. A permitted book enters through the desktop companion: paired with a one-time code, the
 *    companion registers the inbox (metadata only), identical content under two names is
 *    deduplicated, the owner grants private storage, the bytes arrive, metadata is confirmed,
 *    extraction is permitted and runs, and the reading room shows the text with both the
 *    physical page index and the printed label; a passage question is answered with a citation
 *    to that exact place.
 * 6. A reference-only book is registered without any content leaving the device; the item page,
 *    the reading room and the passage endpoint all say so; a tutor conversation that mentions it
 *    carries the university's note that the tutor has not seen it.
 *
 * Also: a file named .pdf without the signature is refused; a corrupt PDF fails cleanly with a
 * reason and no retries; an unauthenticated browser cannot fetch a stored file or open the
 * library. The companion really runs as a child process against the local server.
 */
test.describe.configure({ mode: "serial" });

const repoRoot = process.cwd();
const run = Date.now().toString(36);
let root = "";
let companionHome = "";
let permittedItemUrl = "";
let localOnlyItemUrl = "";
let readUrl = "";
let bookFilename = "";
let duplicateFilename = "";

function companion(args: string): string {
  return execSync(`pnpm --filter @corniversity/companion start -- ${args}`, {
    cwd: repoRoot,
    env: { ...process.env, CORNIVERSITY_COMPANION_HOME: companionHome, CORNIVERSITY_DATA_ROOT: root },
    stdio: "pipe",
    timeout: 180_000,
  }).toString("utf8");
}

test.beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "corniversity-e2e-library-"));
  companionHome = mkdtempSync(join(tmpdir(), "corniversity-e2e-companion-"));
  mkdirSync(join(root, "inbox", "mathematics"), { recursive: true });
  const book = makePdf(
    [
      `Preface (run ${run})\nThis book treats normed spaces and their completions.`,
      "Contents\nChapter 1. Banach spaces",
      `Definition 1.1\nA Banach space is a complete normed space over the real or complex numbers, in which every Cauchy sequence converges to a limit in the space. Run ${run}.`,
    ],
    true,
  );
  writeFileSync(join(root, "inbox", "mathematics", `banach-notes-${run}.pdf`), book);
  writeFileSync(join(root, "inbox", "mathematics", `banach-notes-${run}-copy.pdf`), book);
  writeFileSync(
    join(root, "inbox", "mathematics", `riemannian-reference-${run}.pdf`),
    makePdf([`Reference-only book ${run}\nThis text must never leave the device.`], false),
  );
});

test.afterAll(() => {
  rmSync(root, { recursive: true, force: true });
  rmSync(companionHome, { recursive: true, force: true });
});

test.describe("library, companion and reading room", () => {
  test("journey 5a: pair the companion with a one-time code and register the inbox with deduplication", async ({ page }) => {
    test.setTimeout(240_000);
    await signInOrBootstrap(page);
    await page.goto("/library");
    await expect(page.getByRole("heading", { level: 1, name: "Library" })).toBeVisible();
    // No watcher is running (a one-shot sync from an earlier run does not count as paused).
    await expect(page.getByText("Desktop sync offline").first()).toBeVisible();
    await screenshot(page, "17-library-shelf");

    await page.goto("/library/sync");
    await page.getByRole("button", { name: /create a pairing code/i }).click();
    const codeText = await page.getByText(/^\d{4}-\d{4}$/).textContent({ timeout: 20_000 });
    const code = codeText?.trim() ?? "";
    expect(code).toMatch(/^\d{4}-\d{4}$/);
    await screenshot(page, "18-library-pairing-code");

    const paired = companion(`pair --server http://localhost:3000 --code ${code} --name "E2E desktop" --root "${root}"`);
    expect(paired).toContain('Paired as "E2E desktop"');

    // A second redemption of the same code must fail.
    expect(() => companion(`pair --server http://localhost:3000 --code ${code} --name "Impostor" --root "${root}"`)).toThrow();

    const dry = companion("sync --dry-run");
    expect(dry).toContain("would_register");
    expect(dry).toContain("Dry run: nothing was sent");

    const synced = companion("sync");
    // Two files with identical bytes: whichever the walk meets first is registered, the other is a duplicate.
    const registered = /register: inbox\/mathematics\/(banach-notes-[^ ]+\.pdf) — registered \(registered_local\)/.exec(synced);
    const duplicate = /register: inbox\/mathematics\/(banach-notes-[^ ]+\.pdf) — duplicate \(registered_local\)/.exec(synced);
    expect(registered).not.toBeNull();
    expect(duplicate).not.toBeNull();
    bookFilename = registered![1]!;
    duplicateFilename = duplicate![1]!;
    expect(bookFilename).not.toBe(duplicateFilename);
    expect(synced).toContain(`riemannian-reference-${run}.pdf — registered (registered_local)`);

    await page.goto("/library/sync");
    await expect(page.getByRole("cell", { name: "E2E desktop" }).first()).toBeVisible();
    await expect(page.getByText(`inbox/mathematics/riemannian-reference-${run}.pdf`)).toBeVisible();

    await page.goto("/library");
    // Two identical files produced one item; the shelf shows it once, plus the reference book.
    await expect(page.getByRole("link", { name: bookFilename })).toHaveCount(1);
    await expect(page.getByRole("link", { name: duplicateFilename })).toHaveCount(0);
    await expect(page.getByText("On your desktop").first()).toBeVisible();
    await screenshot(page, "19-library-shelf-registered");
  });

  test("journey 6: a reference-only book never leaves the device and every surface says so", async ({ page }) => {
    test.setTimeout(180_000);
    await signInOrBootstrap(page);
    await page.goto("/library");
    await page.getByRole("link", { name: `riemannian-reference-${run}.pdf` }).click();
    await expect(page).toHaveURL(/\/library\/items\//);
    localOnlyItemUrl = page.url();
    await expect(page.getByText("Reference only: nothing but metadata has left your device")).toBeVisible();
    await expect(page.getByText("Local only").first()).toBeVisible();
    // Give it a title and attach it to Functional Analysis so the tutor knows it exists.
    await page.getByLabel("Title").fill(`Riemannian reference ${run}`);
    await page.getByLabel(/MAT-230/).check();
    await page.getByRole("button", { name: /confirm metadata/i }).click();
    await expect(page.getByText("Metadata saved.")).toBeVisible();
    await screenshot(page, "20-library-local-only-item");

    const id = localOnlyItemUrl.split("/").pop()!;
    await page.goto(`/library/read/${id}`);
    await expect(page.getByText("This item is on your desktop only")).toBeVisible();

    // The passage endpoint refuses with the exact reason; no model is consulted.
    const refused = await page.request.post("/api/library/ask", {
      data: { assetId: id, physicalIndex: 0, selectedText: "anything", question: "What does this say?" },
    });
    expect(refused.status()).toBe(403);
    const body = (await refused.json()) as { error: string; message: string };
    expect(body.error).toBe("local_only");
    expect(body.message).toContain("never left your device");

    // No bytes exist to fetch, even for the owner.
    const file = await page.request.get(`/api/library/assets/${id}/file`);
    expect(file.status()).toBe(404);

    // A tutor conversation that names the book carries the university's note.
    await page.goto("/courses/MAT-230");
    const takeButton = page.getByRole("button", { name: /take this course/i });
    if (await takeButton.isVisible().catch(() => false)) {
      await page.getByLabel(/^Enrolled/).check();
      await takeButton.click();
    }
    await page.getByRole("link", { name: "Normed and Banach spaces" }).click();
    const lectureCard = page.locator("li", { hasText: "Lecture 1" }).first();
    const start = lectureCard.getByRole("button", { name: /start|resume|continue/i }).first();
    if (await start.isVisible().catch(() => false)) await start.click();
    else
      await page
        .locator("li", { hasText: /Lecture/ })
        .first()
        .getByRole("button")
        .first()
        .click();
    await expect(page).toHaveURL(/\/sessions\//, { timeout: 30_000 });
    await page.getByLabel("Message to the tutor").fill(`Can you check what Riemannian reference ${run} says about completeness?`);
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("registered as local-only").first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("has not seen a page of it").first()).toBeVisible();
    await screenshot(page, "21-tutor-local-only-note");
  });

  test("journey 5b: grant private storage, receive the bytes through the companion, confirm, extract and read with printed labels", async ({
    page,
  }) => {
    test.setTimeout(300_000);
    await signInOrBootstrap(page);
    await page.goto("/library");
    await page.getByRole("link", { name: bookFilename }).click();
    await expect(page).toHaveURL(/\/library\/items\//);
    permittedItemUrl = page.url();

    // Storage is a separate decision with a recorded basis.
    const storageRow = page.locator("li", { hasText: "Store a private copy" });
    await storageRow.getByPlaceholder(/Basis/).fill("my own lecture notes");
    await storageRow.getByRole("button", { name: "Allow" }).click();
    await expect(page.getByText("Permission recorded.")).toBeVisible();
    await expect(page.getByText("Waiting for upload").first()).toBeVisible();

    const uploaded = companion("sync");
    expect(uploaded).toMatch(/upload: inbox\/mathematics\/banach-notes-.*stored/);

    await page.reload();
    await expect(page.getByText("Quarantined").first()).toBeVisible();
    await page.getByLabel("Title").fill(`Banach notes ${run}`);
    await page.getByLabel("Authors (comma-separated)").fill("Leon");
    await page.getByLabel(/MAT-230/).check();
    await page.getByRole("button", { name: /confirm metadata/i }).click();
    await expect(page.getByText("Metadata saved.")).toBeVisible();
    await expect(page.getByText("Confirmed", { exact: true }).first()).toBeVisible();

    // Extraction is refused until it is permitted.
    await expect(page.getByRole("button", { name: /^extract and index$/i })).toBeDisabled();
    const extractRow = page.locator("li", { hasText: "Extract and index the text" });
    await extractRow.getByPlaceholder(/Basis/).fill("my own notes");
    await extractRow.getByRole("button", { name: "Allow" }).click();
    await expect(page.getByText("Permission recorded.")).toBeVisible();
    await page.getByRole("button", { name: /^extract and index$/i }).click();
    await expect(page.getByText("Extraction queued")).toBeVisible();
    await expect(page.getByText("Ready", { exact: true }).first()).toBeVisible({ timeout: 120_000 });
    await expect(page.getByText(/3 pages indexed with printed page labels/)).toBeVisible();
    await screenshot(page, "22-library-item-ready");

    // Tutors may read passages only after a further decision.
    const aiRow = page.locator("li", { hasText: "Let tutors read passages" });
    await aiRow.getByPlaceholder(/Basis/).fill("my own notes; CC BY");
    await aiRow.getByRole("button", { name: "Allow" }).click();
    await expect(page.getByText("Permission recorded.")).toBeVisible();

    await page.getByRole("link", { name: /open in the reading room/i }).click();
    await expect(page).toHaveURL(/\/library\/read\//);
    readUrl = page.url().split("?")[0]!;
    await expect(page.getByText("PDF page 1 of 3")).toBeVisible();
    await expect(page.getByText("printed p. i")).toBeVisible();
    await expect(page.locator("#page-text")).toContainText("normed spaces");

    await page.getByLabel("Search this item").fill("Cauchy sequence");
    await page.getByRole("button", { name: "Search" }).click();
    const hit = page.getByRole("link", { name: "p. 1" });
    await expect(hit).toBeVisible();
    await hit.click();
    await expect(page.getByText("PDF page 3 of 3")).toBeVisible();
    await expect(page.getByText("printed p. 1")).toBeVisible();
    await expect(page.locator("#page-text")).toContainText("Cauchy sequence");
    await screenshot(page, "23-reading-room");

    // Select the page text and ask; the answer cites the exact place.
    await page.evaluate(() => {
      const element = document.getElementById("page-text")!;
      const range = document.createRange();
      range.selectNodeContents(element);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      document.dispatchEvent(new Event("mouseup"));
    });
    await expect(
      page
        .getByText("Selected passage")
        .locator("..")
        .getByText(/Banach space/),
    ).toBeVisible();
    await page.getByLabel(/Question for/).fill("What hypotheses does this definition rely on?");
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    await expect(page.getByText("Recent answers")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(`E1: Banach notes ${run}, p. 1 (PDF page 3): selected passage`)).toBeVisible();
    await screenshot(page, "24-reading-room-answer");

    // A note anchored to this page.
    await page.getByLabel(/Note on p\. 1/).fill("Completeness is the whole point here.");
    await page.getByRole("button", { name: "Save note" }).click();
    await expect(page.getByText("Note saved.")).toBeVisible();
    await expect(page.getByText("Completeness is the whole point here.")).toBeVisible();

    // Jobs page shows the ingestion with its idempotency key.
    await page.goto("/library/jobs");
    await expect(page.getByText(/^ingest:/).first()).toBeVisible();
    await expect(page.getByText("completed").first()).toBeVisible();
    await screenshot(page, "25-library-jobs");
  });

  test("validation: a fake PDF is refused and a corrupt PDF fails cleanly without retries", async ({ page }) => {
    test.setTimeout(240_000);
    await signInOrBootstrap(page);
    await page.goto("/library/upload");
    await page
      .getByLabel(/^File/)
      .setInputFiles({ name: `fake-${run}.pdf`, mimeType: "application/pdf", buffer: Buffer.from("MZ not a pdf at all") });
    await page.getByRole("button", { name: /upload to quarantine/i }).click();
    await expect(page.getByRole("alert").filter({ hasText: /PDF signature/ })).toContainText("does not start with a PDF signature");

    // Unique bytes per run: identical content would be deduplicated onto an earlier run's rejected item.
    await page.getByLabel(/^File/).setInputFiles({
      name: `corrupt-${run}.pdf`,
      mimeType: "application/pdf",
      buffer: Buffer.from(`%PDF-1.7\n% run ${run}\n${"garbage ".repeat(300)}`, "latin1"),
    });
    await page.getByRole("button", { name: /upload to quarantine/i }).click();
    await expect(page).toHaveURL(/\/library\/items\//, { timeout: 30_000 });
    await page.getByLabel("Title").fill(`Corrupt file ${run}`);
    await page.getByRole("button", { name: /confirm metadata/i }).click();
    await expect(page.getByText("Metadata saved.")).toBeVisible();
    const extractRow = page.locator("li", { hasText: "Extract and index the text" });
    await extractRow.getByPlaceholder(/Basis/).fill("test file");
    await extractRow.getByRole("button", { name: "Allow" }).click();
    await expect(page.getByText("Permission recorded.")).toBeVisible();
    await expect(page.locator("li", { hasText: "Extract and index the text" }).getByText("allowed", { exact: true })).toBeVisible();
    await expect(page.getByText("Confirmed", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: /^extract and index$/i }).click();
    await expect(page.getByText("Rejected", { exact: true }).first()).toBeVisible({ timeout: 120_000 });
    await expect(page.getByText(/could not be parsed/).first()).toBeVisible();
    await screenshot(page, "26-library-corrupt-rejected");

    await page.goto("/library/jobs");
    const row = page.locator("tr", { hasText: `ingest:` }).filter({ hasText: "failed" }).first();
    await expect(row).toBeVisible();
    await expect(row.getByRole("button", { name: "Retry" })).toBeVisible();
  });

  test("security: an unauthenticated browser cannot read files or the library", async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const anonymous = await context.newPage();
    const id = permittedItemUrl.split("/").pop()!;
    const file = await anonymous.request.get(`/api/library/assets/${id}/file`);
    expect(file.status()).toBe(401);
    const ask = await anonymous.request.post("/api/library/ask", {
      data: { assetId: id, physicalIndex: 0, selectedText: "x", question: "y" },
    });
    expect(ask.status()).toBe(401);
    const register = await anonymous.request.post("/api/companion/register", { data: {} });
    expect(register.status()).toBe(401);
    await anonymous.goto(readUrl || "/library");
    await expect(anonymous).toHaveURL(/\/sign-in/);
    await context.close();
  });
});
