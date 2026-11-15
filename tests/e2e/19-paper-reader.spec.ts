import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page, type Request, test } from "@playwright/test";
import { createDb, type DbHandle } from "../../packages/db/src/client";
import { getBoss, stopBoss } from "../../packages/db/src/queue";
import { createFixtureScholarlyClient } from "../../packages/db/src/scholarly/client";
import { importByIdentifier, openArxivVersion } from "../../packages/db/src/services/scholarly-works";
import { ownerEnv, screenshot } from "./helpers";
import { makePdf } from "./pdf";
import { expectFixtureProviders } from "./scholarly";

/**
 * Journey 19: reading a paper from arxiv.org in the reader, in fixture mode at both viewports.
 *
 * Setup (until the paper page's Read button exists in this checkout, which the integration stage
 * switches this journey to): the linked arXiv Documents are created with the services against the
 * rehearsal database (E2E_DATABASE_URL, test data only): importByIdentifier for the arXiv id, the
 * stack worker's arXiv job applying the recorded fixtures, then openArxivVersion. The browser's
 * requests to https://arxiv.org/pdf/** are answered with generated PDFs (tests/e2e/pdf.ts), so no
 * arXiv server is contacted and the tested build keeps its production CSP.
 *
 * Covered: attribution and disclosure; highlight, selection note, bookmark, page note and area note,
 * persisted and drawn again after a reload; an edit conflict (409) shown beside the draft; the
 * route guard; the position restored inside the page after a reload, ?page=N never saved, the
 * keepalive save on page hide, a reload right after a move; panels, the phone dialog and the compact
 * bar (portrait and landscape) with an axe pass; the failure state when arxiv.org is unreachable;
 * drift with a different file (same pages: banner and "Keep my notes on the new file"; different
 * pages: needs repair, no ribbons; a failed hash report: drawn without an offer); the newer-version
 * link, its refusal shown (and shown again after Dismiss), and a withdrawn later version.
 */
test.describe.configure({ mode: "serial" });

const DPO = "2305.18290";
const WITHDRAWN = "2607.20049";
const FIXTURES = join(process.cwd(), "packages/db/src/scholarly/fixtures");
// Six pages, so a phone can scroll page 3 to the top of the view.
const pages = (variant: string, count = 6) =>
  makePdf(
    Array.from(
      { length: count },
      (_, i) =>
        `Generated test PDF standing in for arXiv ${variant}, page ${i + 1}. Not the paper.\nDirect preference optimization fits a policy to preferences without a reward model.\nThe KL weight beta controls the distance from the reference policy.`,
    ),
    false,
  );
const FILE_A = pages("file A");
const FILE_B = pages("file B (same pages, other bytes)");
const FILE_C = pages("file C (one page more)", 7);

let handle: DbHandle;
let ownerId = "";
let workId = "";
let linkedId = "";
let withdrawnId = "";

async function sql<T = Record<string, unknown>>(text: string, values: unknown[] = []): Promise<T[]> {
  return (await handle.pool.query(text, values)).rows as T[];
}

async function waitForVersions(arxivId: string, count: number): Promise<void> {
  await expect
    .poll(
      async () =>
        Number(
          (
            await sql<{ n: string }>("select count(*) as n from scholarly_version where owner_id = $1 and arxiv_id = $2", [
              ownerId,
              arxivId,
            ])
          )[0]!.n,
        ),
      {
        message: `the stack's worker applies the recorded arXiv record of ${arxivId}`,
        timeout: 120_000,
        intervals: [1_000],
      },
    )
    .toBeGreaterThanOrEqual(count);
}

test.beforeAll(async () => {
  test.setTimeout(300_000);
  const url = process.env.E2E_DATABASE_URL;
  if (!url)
    throw new Error("Journey 19 needs E2E_DATABASE_URL (the rehearsal database, test data only) to create its linked arXiv Documents.");
  handle = createDb(url, { max: 2 });
  // importByIdentifier queues the arXiv job on this stack's queue; the stack's worker runs it from the fixtures.
  await getBoss({ connectionString: url });
  const [owner] = await sql<{ id: string }>('select id from "user" where email = $1', [ownerEnv().email]);
  if (!owner) throw new Error("The owner account does not exist yet; the setup project creates it.");
  ownerId = owner.id;
  const fixture = createFixtureScholarlyClient({ dir: FIXTURES });
  const dpo = await importByIdentifier(handle.db, ownerId, fixture, { scheme: "arxiv", value: DPO });
  const withdrawn = await importByIdentifier(handle.db, ownerId, fixture, { scheme: "arxiv", value: WITHDRAWN });
  await waitForVersions(DPO, 3);
  await waitForVersions(WITHDRAWN, 2);
  workId = dpo.workId;
  linkedId = (await openArxivVersion(handle.db, ownerId, dpo.workId, DPO, 1)).id;
  withdrawnId = (await openArxivVersion(handle.db, ownerId, withdrawn.workId, WITHDRAWN, 1)).id;
  // Each project starts from a Document nobody has read or annotated (test data only).
  const ids = [linkedId, withdrawnId];
  await sql("delete from annotation where owner_id = $1 and asset_id = any($2::uuid[])", [ownerId, ids]);
  await sql("delete from reading_progress where owner_id = $1 and asset_id = any($2::uuid[])", [ownerId, ids]);
  await sql("update resource_asset set observed_sha256 = null, observed_at = null, page_count = null where id = any($1::uuid[])", [ids]);
});

test.afterAll(async () => {
  await stopBoss();
  await handle?.close();
});

/** Answers the browser's arXiv PDF requests (CORS as arXiv sends it) and records them. */
async function serveArxiv(page: Page, body: Buffer | "unreachable"): Promise<Request[]> {
  const seen: Request[] = [];
  await page.unroute("https://arxiv.org/pdf/**");
  await page.route("https://arxiv.org/pdf/**", async (route) => {
    seen.push(route.request());
    if (body === "unreachable") return route.abort("internetdisconnected");
    return route.fulfill({ status: 200, contentType: "application/pdf", headers: { "access-control-allow-origin": "*" }, body });
  });
  return seen;
}

const compact = (page: Page) => (page.viewportSize()?.width ?? 1440) <= 640 || (page.viewportSize()?.height ?? 900) <= 500;

async function openReader(page: Page, id: string, query = ""): Promise<void> {
  await page.goto(`/library/read/${id}${query}`);
  await expect(page.getByRole("region", { name: /^Pages of / })).toBeVisible();
  await expect(page.getByLabel("Page", { exact: true })).toBeEnabled({ timeout: 30_000 });
}

/** The panel area: the aside on desktop, the dialog on phones (opened through Panels). */
async function openPanel(page: Page, name: "Contents" | "Find" | "Notes" | "Paper"): Promise<Locator> {
  if (compact(page)) {
    const dialog = page.getByRole("dialog");
    if (!(await dialog.isVisible())) await page.getByRole("button", { name: "Panels" }).click();
    await dialog.getByRole("button", { name, exact: true }).click();
    await expect(page.getByRole("dialog", { name })).toBeVisible();
    return page.getByRole("dialog", { name });
  }
  await page.getByRole("button", { name, exact: true }).click();
  const aside = page.getByRole("complementary", { name });
  await expect(aside).toBeVisible();
  return aside;
}

async function closePanel(page: Page): Promise<void> {
  if (compact(page)) await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
}

/** Selects the text of one line on a page (the text layer's span holding `text`). */
async function selectText(page: Page, pageNumber: number, text: string): Promise<void> {
  const span = page.locator(`.page[data-page-number="${pageNumber}"] .textLayer span`, { hasText: text }).first();
  await expect(span).toBeAttached({ timeout: 30_000 });
  await span.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
  });
  await expect(page.getByRole("toolbar", { name: "Selected text" })).toBeVisible();
}

const marks = (page: Page, pageNumber: number, kind: string) =>
  page.locator(`.page[data-page-number="${pageNumber}"] .reader-mark[data-kind="${kind}"]`);

/** Serious or critical axe findings (journey 08's WCAG tags) on the reader as it stands. */
async function seriousAxe(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} ${v.nodes[0]?.target.join(" ") ?? ""}`);
}

test.describe("paper reader (linked arXiv Document)", () => {
  test("attribution and disclosure; highlights and notes persist and are drawn again after a reload", async ({ page, request }) => {
    test.setTimeout(180_000);
    await expectFixtureProviders(request);
    const seen = await serveArxiv(page, FILE_A);
    await openReader(page, linkedId);

    // The browser fetched exactly arXiv's PDF for this version, without cookies or referrer.
    expect(seen.map((r) => r.url())).toEqual([`https://arxiv.org/pdf/${DPO}v1`]);
    const headers = await seen[0]!.allHeaders();
    expect(headers.cookie).toBeUndefined();
    expect(headers.referer).toBeUndefined();
    await expect(page.getByText(`arXiv:${DPO}v1 · read from arxiv.org ·`)).toBeVisible();
    await expect(page.getByRole("link", { name: "abstract page" })).toHaveAttribute("href", `https://arxiv.org/abs/${DPO}v1`);
    await expect(
      page.getByText("Your browser downloads this PDF directly from arxiv.org; arXiv sees your IP address and which paper you open."),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to paper" })).toHaveAttribute("href", `/library/papers/${workId}`);
    // The browser's report of what it received is recorded first (a note made before it lands names those bytes instead).
    const observed = async () =>
      (await sql<{ observed_sha256: string | null }>("select observed_sha256 from resource_asset where id = $1", [linkedId]))[0]!
        .observed_sha256;
    await expect.poll(observed).toMatch(/^[0-9a-f]{64}$/);

    // Highlight a line.
    await selectText(page, 1, "Direct preference optimization");
    await page.getByRole("toolbar", { name: "Selected text" }).getByRole("button", { name: "Highlight" }).click();
    await expect(page.getByRole("toolbar", { name: "Selected text" })).toBeHidden();
    await expect(marks(page, 1, "highlight")).toHaveCount(1);

    // A note on another selection, with mathematics.
    await selectText(page, 1, "The KL weight beta");
    await page.getByRole("toolbar", { name: "Selected text" }).getByRole("button", { name: "Note" }).click();
    let panel = compact(page) ? page.getByRole("dialog", { name: "Notes" }) : page.getByRole("complementary", { name: "Notes" });
    await expect(panel.getByRole("heading", { name: "Note on page 1" })).toBeVisible();
    await panel.getByLabel("Note", { exact: true }).fill("The weight $\\beta$ keeps the policy near the reference.");
    await panel.getByRole("button", { name: "Save note" }).click();
    await expect(panel.locator("li", { hasText: "keeps the policy near the reference" }).locator("math")).toHaveCount(1);
    await expect(marks(page, 1, "note")).toHaveCount(1);

    // A bookmark and a page note on the page in view.
    await panel.getByRole("button", { name: "Bookmark page" }).click();
    await expect(panel.getByRole("button", { name: "Remove bookmark" })).toBeVisible();
    await panel.getByRole("button", { name: "Page note" }).click();
    await panel.getByLabel("Note", { exact: true }).fill("Section 4 derives the objective.");
    await panel.getByRole("button", { name: "Save note" }).click();
    await expect(panel.getByText("Section 4 derives the objective.")).toBeVisible();

    // An area note: two clicks on the page, with Cancel offered.
    await panel.getByRole("button", { name: "Mark area" }).click();
    await expect(page.getByText("Mark area: click one corner of the area on a page.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
    const box = (await page.locator('.page[data-page-number="1"]').boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.15, box.y + box.height * 0.3);
    await expect(page.getByText("Now click the opposite corner on page 1.")).toBeVisible();
    await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.45);
    panel = compact(page) ? page.getByRole("dialog", { name: "Notes" }) : page.getByRole("complementary", { name: "Notes" });
    await expect(panel.getByRole("heading", { name: "Area note on page 1" })).toBeVisible();
    await panel.getByLabel("Note", { exact: true }).fill("Figure 1 compares the pipelines.");
    await panel.getByRole("button", { name: "Save note" }).click();
    await expect(marks(page, 1, "note")).toHaveCount(2);
    await screenshot(page, "60-paper-reader-notes");
    await closePanel(page);

    // The server filled the engine and the file the anchors name.
    const rows = await sql<{ kind: string; anchor: { engine: string; documentSha256: string } | null }>(
      "select kind, anchor from annotation where asset_id = $1 order by created_at",
      [linkedId],
    );
    expect(rows.map((r) => r.kind)).toEqual(["highlight", "note", "bookmark", "note", "note"]);
    for (const row of rows) expect(row.anchor).toMatchObject({ engine: "pdfjs-dist@6.4.299", documentSha256: `arxiv:${DPO}v1` });

    await page.reload();
    await expect(page.getByLabel("Page", { exact: true })).toBeEnabled({ timeout: 30_000 });
    await expect(marks(page, 1, "highlight")).toHaveCount(1);
    await expect(marks(page, 1, "note")).toHaveCount(2);
    await expect(page.locator('.page[data-page-number="1"] .reader-bookmark')).toHaveCount(1);
    panel = await openPanel(page, "Notes");
    await expect(panel.getByRole("heading", { name: "All notes (5)" })).toBeVisible();
  });

  test("an edit made elsewhere meanwhile is a conflict: both versions are shown and nothing is overwritten", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    await serveArxiv(page, FILE_A);
    await openReader(page, linkedId);
    const [row] = await sql<{ id: string; updated_at: Date }>(
      "select id, updated_at from annotation where asset_id = $1 and note_markdown = $2",
      [linkedId, "Section 4 derives the objective."],
    );
    const panel = await openPanel(page, "Notes");
    const item = panel.locator(`li[data-annotation="${row!.id}"]`);
    await item.getByRole("button", { name: "Edit page note on page 1" }).click();
    await item.getByLabel("Note", { exact: true }).fill("My draft: section 4 derives the DPO objective.");

    // Another device saves first.
    const elsewhere = await page.request.patch("/api/library/annotations", {
      headers: { origin: baseURL! },
      data: { id: row!.id, noteMarkdown: "Saved elsewhere: section 4.", expectedUpdatedAt: row!.updated_at.toISOString() },
    });
    expect(elsewhere.status()).toBe(200);

    await item.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      item.getByText("This note was changed elsewhere after you opened it. Both versions are shown; nothing was overwritten."),
    ).toBeVisible();
    await expect(item.getByText("Saved elsewhere: section 4.")).toBeVisible();
    await expect(item.getByLabel("Your draft")).toHaveValue("My draft: section 4 derives the DPO objective.");
    expect((await sql<{ note_markdown: string }>("select note_markdown from annotation where id = $1", [row!.id]))[0]!.note_markdown).toBe(
      "Saved elsewhere: section 4.",
    );
    await screenshot(page, "61-paper-reader-conflict");
    await item.getByRole("button", { name: "Save my draft over it" }).click();
    await expect(panel.getByText("My draft: section 4 derives the DPO objective.")).toBeVisible();

    // The routes take JSON from this site's own pages only.
    const noOrigin = await page.request.patch("/api/library/annotations", {
      data: { id: row!.id, noteMarkdown: "x", expectedUpdatedAt: "2026-01-01T00:00:00.000Z" },
    });
    expect(noOrigin.status()).toBe(403);
    const otherSite = await page.request.delete("/api/library/annotations", {
      headers: { origin: "https://evil.example" },
      data: { id: row!.id },
    });
    expect(otherSite.status()).toBe(403);
    const form = await page.request.post("/api/library/position", { headers: { origin: baseURL! }, form: { assetId: linkedId } });
    expect(form.status()).toBe(415);
  });

  test("the position is restored inside the page after a reload; arriving through ?page=N is never saved", async ({ page }) => {
    test.setTimeout(150_000);
    await sql("delete from reading_progress where owner_id = $1 and asset_id = $2", [ownerId, linkedId]);
    await serveArxiv(page, FILE_A);
    await openReader(page, linkedId);
    const pageBox = page.getByLabel("Page", { exact: true });
    const pagesRegion = page.getByRole("region", { name: /^Pages of / });
    const saved = async () =>
      (
        await sql<{ physical_index: number; position: { pageIndex: number; top: number } | null }>(
          "select physical_index, position from reading_progress where owner_id = $1 and asset_id = $2",
          [ownerId, linkedId],
        )
      )[0];

    // Opening is recorded; nothing about the position is saved by arriving.
    await expect.poll(async () => (await saved())?.physical_index ?? null).toBe(0);
    expect((await saved())?.position ?? null).toBeNull();

    await page.getByRole("button", { name: "Next page" }).click();
    await page.getByRole("button", { name: "Next page" }).click();
    await expect(pageBox).toHaveValue("3");
    await pagesRegion.hover();
    await page.mouse.wheel(0, 120);
    await expect.poll(async () => (await saved())?.position?.pageIndex ?? null, { timeout: 15_000 }).toBe(2);
    await expect.poll(async () => (await saved())?.position?.top ?? 0, { timeout: 15_000 }).toBeLessThan(780);
    const scrolled = await pagesRegion.evaluate((el) => el.scrollTop);
    // The page box names the page most in view, which may already be the next one on a small screen.
    const shown = await pageBox.inputValue();

    await page.reload();
    await expect(pageBox).toHaveValue(shown, { timeout: 30_000 });
    await expect.poll(() => pagesRegion.evaluate((el) => el.scrollTop)).toBeGreaterThan(scrolled - 40);
    expect(await pagesRegion.evaluate((el) => el.scrollTop)).toBeLessThan(scrolled + 40);

    // Arriving through ?page=1 shows page 1 and saves nothing.
    await openReader(page, linkedId, "?page=1");
    await expect(pageBox).toHaveValue("1");
    await page.waitForTimeout(2_500);
    expect((await saved())?.physical_index).toBe(2);
    await openReader(page, linkedId);
    await expect(pageBox).toHaveValue(shown);

    // A move just before leaving is sent with keepalive as the page goes away.
    await pageBox.fill("2");
    await pageBox.press("Enter");
    await expect(pageBox).toHaveValue("2");
    await page.waitForTimeout(300);
    await page.goto("about:blank");
    await expect.poll(async () => (await saved())?.physical_index, { timeout: 15_000 }).toBe(1);

    // A reload right after a move opens where the owner was, even when the save sent as the page went
    // away reaches the server after the reload was rendered (held back here for 3 s).
    await openReader(page, linkedId);
    await pageBox.fill("5");
    await pageBox.press("Enter");
    await expect.poll(async () => (await saved())?.physical_index, { timeout: 15_000 }).toBe(4);
    await page.route("**/api/library/position", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3_000));
      await route.continue().catch(() => undefined);
    });
    await pageBox.fill("3");
    await pageBox.press("Enter");
    await expect(pageBox).toHaveValue("3");
    await page.waitForTimeout(300);
    await page.reload();
    await expect(pageBox).toBeEnabled({ timeout: 30_000 });
    await expect(pageBox).toHaveValue("3");
    await expect.poll(async () => (await saved())?.physical_index, { timeout: 15_000 }).toBe(2);
    await page.unroute("**/api/library/position");
  });

  test("panels: Contents, Notes and Paper; Hide panel; on phones a dialog with Close and a two-row bar", async ({ page }) => {
    test.setTimeout(120_000);
    await serveArxiv(page, FILE_A);
    await openReader(page, linkedId);
    const paper = await openPanel(page, "Paper");
    await expect(paper.getByText("Fixture data")).toBeVisible();
    await expect(paper.getByText("Details as reported by recorded fixtures")).toBeVisible();
    await expect(paper.getByRole("link", { name: "Paper page" })).toHaveAttribute("href", `/library/papers/${workId}`);
    await expect(paper.getByText(/^arXiv v1/)).toBeVisible();
    await expect(paper.getByRole("link", { name: DPO, exact: true })).toHaveAttribute("href", `https://arxiv.org/abs/${DPO}`);
    await openPanel(page, "Contents");
    await openPanel(page, "Notes");
    const noHorizontalScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

    if (!compact(page)) {
      await page.getByRole("button", { name: "Hide panel" }).click();
      await expect(page.getByRole("complementary")).toHaveCount(0);
      await page.getByRole("button", { name: "Show panel" }).click();
      await expect(page.getByRole("complementary", { name: "Notes" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Full screen" })).toBeVisible();
      expect(await noHorizontalScroll()).toBe(true);
      expect(await seriousAxe(page)).toEqual([]);
      await screenshot(page, "62-paper-reader-panel");
      return;
    }
    const dialog = page.getByRole("dialog", { name: "Notes" });
    await expect(dialog.getByRole("button", { name: "Close" })).toBeVisible();
    await screenshot(page, "62-paper-reader-panel");
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    // The compact bar's buttons show what their names say (WCAG 2.5.3), and axe finds nothing serious.
    await expect(page.getByRole("button", { name: "Previous page" })).toHaveText("Previous");
    expect(await seriousAxe(page)).toEqual([]);
    // Portrait phone: the bar takes at most two rows and the title stays readable.
    const header = page.locator("header").first();
    const title = page.getByRole("heading", { level: 1 });
    expect((await header.boundingBox())!.height).toBeLessThanOrEqual(84);
    expect((await title.boundingBox())!.width).toBeGreaterThanOrEqual(150);
    expect(await noHorizontalScroll()).toBe(true);
    // Landscape phone (844 x 390): one row, panels still in the dialog.
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.getByRole("button", { name: "Panels" })).toBeVisible();
    await expect.poll(async () => (await header.boundingBox())!.height).toBeLessThanOrEqual(48);
    expect((await title.boundingBox())!.width).toBeGreaterThanOrEqual(200);
    expect(await noHorizontalScroll()).toBe(true);
    await screenshot(page, "63-paper-reader-landscape");
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test("when arxiv.org cannot be reached the reader says so, with Open on arXiv and Try again", async ({ page }) => {
    test.setTimeout(120_000);
    await serveArxiv(page, "unreachable");
    await page.goto(`/library/read/${linkedId}`);
    const failure = page
      .getByRole("alert")
      .filter({ hasText: "Your browser could not fetch the PDF from arXiv (network or arXiv's access policy)." });
    await expect(failure).toBeVisible({ timeout: 30_000 });
    await expect(failure.getByRole("link", { name: "Open on arXiv" })).toHaveAttribute("href", `https://arxiv.org/pdf/${DPO}v1`);
    await screenshot(page, "64-paper-reader-unreachable");
    await serveArxiv(page, FILE_A);
    await failure.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByLabel("Page", { exact: true })).toBeEnabled({ timeout: 30_000 });
    await expect(marks(page, 1, "highlight")).toHaveCount(1);
  });

  test("drift: a changed file with the same pages keeps the notes on request; one with other pages lists them for repair", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await serveArxiv(page, FILE_B);
    await openReader(page, linkedId);
    const banner = page.getByRole("status").filter({ hasText: "arXiv's file has changed since these notes were made." });
    await expect(banner).toBeVisible({ timeout: 30_000 });
    await expect(marks(page, 1, "highlight")).toHaveCount(1);
    await screenshot(page, "65-paper-reader-drift");
    await banner.getByRole("button", { name: "Keep my notes on the new file" }).click();
    await expect(banner).toBeHidden();
    await page.reload();
    await expect(page.getByLabel("Page", { exact: true })).toBeEnabled({ timeout: 30_000 });
    await expect(marks(page, 1, "highlight")).toHaveCount(1);
    await expect(page.getByText("arXiv's file has changed since these notes were made.")).toHaveCount(0);

    await serveArxiv(page, FILE_C);
    await openReader(page, linkedId);
    const panel = await openPanel(page, "Notes");
    await expect(panel.getByRole("heading", { name: /^Needs repair \(\d+\)$/ })).toBeVisible({ timeout: 30_000 });
    await expect(panel.getByText("The page count changed from 6 to 7.")).toBeVisible();
    // Every page's layer is redrawn when the placement changes (rendered or not), so these counts are final.
    await expect(page.locator(".reader-mark")).toHaveCount(0);
    // The bookmark is listed under Needs repair, so its ribbon is not drawn either.
    await expect(page.locator(".reader-bookmark")).toHaveCount(0);
    await expect(page.getByText("arXiv's file has changed since these notes were made.")).toHaveCount(0);
    // Nothing was stored: the same file again draws them.
    await closePanel(page);
    await serveArxiv(page, FILE_B);
    await openReader(page, linkedId);
    await expect(marks(page, 1, "highlight")).toHaveCount(1);

    // The hash report fails: nothing is known to have changed, so the notes are drawn (same pages)
    // without the banner or "Keep my notes on the new file", and the reader says what happened.
    await page.route("**/library/read/**", (route) => {
      const request = route.request();
      if (request.method() === "POST" && request.headers()["next-action"] && (request.postData() ?? "").includes('"sha256":'))
        return route.abort("failed");
      return route.continue();
    });
    await openReader(page, linkedId);
    await expect(page.getByText("Corniversity could not record which file your browser received from arXiv")).toBeVisible({
      timeout: 30_000,
    });
    await expect(marks(page, 1, "highlight")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Keep my notes on the new file" })).toHaveCount(0);
    await expect(page.getByText("Some notes were made on another file of this paper.")).toHaveCount(0);
    await page.unroute("**/library/read/**");
  });

  test("versions: a newer version is offered and opens; a withdrawn later version is named, not linked", async ({ page }) => {
    test.setTimeout(120_000);
    await serveArxiv(page, FILE_A);
    await openReader(page, linkedId);
    await expect(page.getByText("A newer version exists:")).toBeVisible();

    // arXiv withdrew v3 meanwhile (test data, restored below): the refusal comes back to this reader and
    // is shown. The reader then offers v2; withdrawn too, the same refusal is shown again after Dismiss.
    const withdraw = (versions: number[], withdrawn: boolean) =>
      sql("update scholarly_version set withdrawn = $1 where owner_id = $2 and arxiv_id = $3 and arxiv_version = any($4::int[])", [
        withdrawn,
        ownerId,
        DPO,
        versions,
      ]);
    const refusal = page.getByRole("alert").filter({ hasText: "This arXiv version was withdrawn, so it is not opened here." });
    await withdraw([3], true);
    try {
      await page.getByRole("button", { name: "Open arXiv v3" }).click();
      await expect(refusal).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("arXiv v3: Withdrawn on arXiv")).toBeVisible();
      await refusal.getByRole("button", { name: "Dismiss" }).click();
      await expect(refusal).toBeHidden();
      await expect(page).not.toHaveURL(/error=/);
      await withdraw([2], true);
      await page.getByRole("button", { name: "Open arXiv v2" }).click();
      await expect(refusal).toBeVisible({ timeout: 30_000 });
    } finally {
      await withdraw([2, 3], false);
    }
    await openReader(page, linkedId);
    await page.getByRole("button", { name: "Open arXiv v3" }).click();
    await expect(page.getByText(`arXiv:${DPO}v3 · read from arxiv.org ·`)).toBeVisible({ timeout: 30_000 });
    await expect(page).not.toHaveURL(new RegExp(linkedId));
    await expect(page.getByText("A newer version exists:")).toHaveCount(0);

    await openReader(page, withdrawnId);
    await expect(page.getByText("arXiv v2: Withdrawn on arXiv")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Open arXiv v2/ })).toHaveCount(0);

    // A linked Document has no Text view, and says so plainly; a repeated parameter counts by its first value.
    await page.goto(`/library/read/${linkedId}?view=text`);
    await expect(page.getByText("No Text view for this paper")).toBeVisible();
    expect((await page.request.get(`/library/read/${linkedId}?page=1&page=2`)).status()).toBe(200);
  });
});
