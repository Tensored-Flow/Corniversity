import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { createDb, type DbHandle } from "../../packages/db/src/client";
import { getBoss, stopBoss } from "../../packages/db/src/queue";
import { createFixtureScholarlyClient } from "../../packages/db/src/scholarly/client";
import { importByIdentifier, openArxivVersion } from "../../packages/db/src/services/scholarly-works";
import { ownerEnv, screenshot } from "./helpers";
import { makePdf } from "./pdf";
import { expectFixtureProviders } from "./scholarly";

/**
 * Journey 21: the reading companion (contract §8), in the scripted demo (fixture AI) and fixture
 * scholarly mode, at both viewports.
 *
 * Covered: the Ask panel is closed by default in the Page view and the Text view; the external-AI
 * gate explains itself and only the owner's buttons grant it (licence shown, basis recorded, a missing
 * basis refused, Enter in the basis field records nothing); refusals are shown with their registered
 * reasons (no selection for a passage, an explanation too short to check, notation too long, a linked
 * paper without a selection), and keyboard focus stays on Send; a stored, extracted Document
 * (uploaded, then extracted by the stack's worker) gets a labelled scripted answer with its checked
 * citation, what was sent and, for a proof, the note that an explanation is not formal verification,
 * which a later visit still shows; the Text view's scroll area does not overflow sideways, and without
 * JavaScript its Send is disabled; a paper read from arxiv.org (answered here by page.route with a
 * generated PDF) sends only the selection, labelled as unchecked.
 *
 * Setup for the linked paper (as journey 19): the services against the rehearsal database
 * (E2E_DATABASE_URL, test data only) import arXiv 2305.18290 from the recorded fixtures and open its
 * v2 (journey 19 reads v1). Each project starts with no external-AI decision on that Document.
 */
test.describe.configure({ mode: "serial" });

const DPO = "2305.18290";
const FIXTURES = join(process.cwd(), "packages/db/src/scholarly/fixtures");
const LINKED_LABEL = "Text you selected in the reader; Corniversity has not checked it against the paper";
const run = Date.now().toString(36);
const title = `Companion notes ${run}`;
const LONG_LINES = [
  "Let X be a normed space over the real numbers with norm written as usual.",
  "A sequence in X is Cauchy when its terms become arbitrarily close later.",
  "The space is complete when every such sequence has a limit inside X.",
  "Completeness is what separates Banach spaces from other normed spaces.",
  "Finite dimensional normed spaces are always complete in this sense too.",
];
const STORED_PDF = makePdf(
  [
    [`Companion journey ${run}.`, "Theorem 1. Every Cauchy sequence in a Banach space converges.", ...LONG_LINES].join("\n"),
    "Proof. The limit is unique because the norm separates points of X.",
    "Notes on the third page.",
  ],
  false,
);
const LINKED_PDF = makePdf(
  Array.from(
    { length: 3 },
    (_, i) =>
      `Generated test PDF standing in for arXiv ${DPO}v2, page ${i + 1}. Not the paper.\nThe KL weight beta controls the distance from the reference policy.`,
  ),
  false,
);

let handle: DbHandle;
let ownerId = "";
let linkedId = "";
let storedId = "";

async function sql<T = Record<string, unknown>>(text: string, values: unknown[] = []): Promise<T[]> {
  return (await handle.pool.query(text, values)).rows as T[];
}

test.beforeAll(async () => {
  test.setTimeout(300_000);
  const url = process.env.E2E_DATABASE_URL;
  if (!url) throw new Error("Journey 21 needs E2E_DATABASE_URL (the rehearsal database, test data only) for its linked arXiv Document.");
  handle = createDb(url, { max: 2 });
  await getBoss({ connectionString: url });
  const [owner] = await sql<{ id: string }>('select id from "user" where email = $1', [ownerEnv().email]);
  if (!owner) throw new Error("The owner account does not exist yet; the setup project creates it.");
  ownerId = owner.id;
  const fixture = createFixtureScholarlyClient({ dir: FIXTURES });
  const dpo = await importByIdentifier(handle.db, ownerId, fixture, { scheme: "arxiv", value: DPO });
  await expect
    .poll(
      async () =>
        Number(
          (
            await sql<{ n: string }>("select count(*) as n from scholarly_version where owner_id = $1 and arxiv_id = $2", [ownerId, DPO])
          )[0]!.n,
        ),
      { message: "the stack's worker applies the recorded arXiv record", timeout: 120_000, intervals: [1_000] },
    )
    .toBeGreaterThanOrEqual(3);
  linkedId = (await openArxivVersion(handle.db, ownerId, dpo.workId, DPO, 2)).id;
  // Each project starts from a linked Document with no external-AI decision and no recorded file (test data only).
  await sql("update processing_permission set revoked_at = now() where owner_id = $1 and asset_id = $2 and revoked_at is null", [
    ownerId,
    linkedId,
  ]);
  await sql("delete from annotation where owner_id = $1 and asset_id = $2", [ownerId, linkedId]);
  await sql("update resource_asset set observed_sha256 = null, observed_at = null, page_count = null where id = $1", [linkedId]);
});

test.afterAll(async () => {
  await stopBoss();
  await handle?.close();
});

const compact = (page: Page) => (page.viewportSize()?.width ?? 1440) <= 640 || (page.viewportSize()?.height ?? 900) <= 500;

async function openReader(page: Page, id: string): Promise<void> {
  await page.goto(`/library/read/${id}`);
  await expect(page.getByRole("region", { name: /^Pages of / })).toBeVisible();
  await expect(page.getByLabel("Page", { exact: true })).toBeEnabled({ timeout: 30_000 });
}

/** The Ask panel: the aside on desktop, the dialog on phones (opened through Panels). */
async function openAsk(page: Page): Promise<Locator> {
  if (compact(page)) {
    const dialog = page.getByRole("dialog");
    if (!(await dialog.isVisible())) await page.getByRole("button", { name: "Panels" }).click();
    await dialog.getByRole("button", { name: "Ask", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Ask" })).toBeVisible();
    return page.getByRole("dialog", { name: "Ask" });
  }
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  const aside = page.getByRole("complementary", { name: "Ask" });
  await expect(aside).toBeVisible();
  return aside;
}

/** The panel wherever it is open now (after the selection bar's Ask opened it). */
function askPanel(page: Page): Locator {
  return compact(page) ? page.getByRole("dialog", { name: "Ask" }) : page.getByRole("complementary", { name: "Ask" });
}

/** Selects the text layer from the span holding `from` to the span holding `to` (or that one span) on a page. */
async function selectText(page: Page, pageNumber: number, from: string, to = from): Promise<void> {
  const spans = page.locator(`.page[data-page-number="${pageNumber}"] .textLayer span`);
  const first = spans.filter({ hasText: from }).first();
  const last = spans.filter({ hasText: to }).first();
  await expect(first).toBeAttached({ timeout: 30_000 });
  await expect(last).toBeAttached();
  const end = await last.elementHandle();
  await first.evaluate((start, endElement) => {
    const range = document.createRange();
    range.setStart(start, 0);
    range.setEnd(endElement as Node, (endElement as Node).childNodes.length);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
  }, end);
  await expect(page.getByRole("toolbar", { name: "Selected text" })).toBeVisible();
}

/** Hands the selection to the companion through the selection bar's Ask. */
async function askAboutSelection(page: Page): Promise<Locator> {
  await page.getByRole("toolbar", { name: "Selected text" }).getByRole("button", { name: "Ask", exact: true }).click();
  const panel = askPanel(page);
  await expect(panel).toBeVisible();
  return panel;
}

/** Sends from the keyboard (Enter on Send), so focus can be checked afterwards. */
async function send(panel: Locator): Promise<void> {
  await panel.getByRole("button", { name: "Send", exact: true }).press("Enter");
}

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

/** How far the Text view's own scroll area overflows sideways (the document itself does not scroll). */
const textViewOverflow = (page: Page) =>
  page.evaluate(() => {
    const area = document.getElementById("page-text")?.closest(".overflow-y-auto");
    return area ? area.scrollWidth - area.clientWidth : null;
  });

async function seriousAxe(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} ${v.nodes[0]?.target.join(" ") ?? ""}`);
}

test.describe("reading companion", () => {
  test("a stored PDF is uploaded and extracted; the Ask panel is closed by default and only the owner's form allows external AI", async ({
    page,
    request,
  }) => {
    test.setTimeout(240_000);
    await expectFixtureProviders(request);
    await page.goto("/library/upload");
    await page.getByLabel(/^File \(PDF, Markdown or plain text/).setInputFiles({
      name: `companion-${run}.pdf`,
      mimeType: "application/pdf",
      buffer: STORED_PDF,
    });
    await page.getByRole("button", { name: "Upload to quarantine" }).click();
    await expect(page).toHaveURL(/\/library\/items\/[0-9a-f-]{36}/);
    storedId = page.url().split("/").pop()!.split("?")[0]!;
    await page.getByLabel("Title").fill(title);
    await page.getByRole("button", { name: "Confirm metadata" }).click();
    await expect(page.getByText("Metadata saved.")).toBeVisible();
    const extractRow = page.locator("li", { hasText: "Extract and index the text" });
    await extractRow.getByPlaceholder(/Basis/).fill("my own notes");
    await extractRow.getByRole("button", { name: "Allow" }).click();
    await expect(page.getByText("Permission recorded.")).toBeVisible();
    await page.getByRole("button", { name: /^extract and index$/i }).click();
    await expect(page.getByText("Extraction queued")).toBeVisible();
    await expect(page.getByText("Ready", { exact: true }).first()).toBeVisible({ timeout: 120_000 });

    await openReader(page, storedId);
    // Closed by default: nothing of the companion is on the page until the owner opens it.
    await expect(page.getByText("AI reading companion")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Send", exact: true })).toHaveCount(0);
    if (!compact(page)) await expect(page.getByRole("complementary", { name: "Contents" })).toBeVisible();
    else await expect(page.getByRole("dialog")).toBeHidden();

    const panel = await openAsk(page);
    await expect(panel.getByText("AI reading companion · scripted demo")).toBeVisible();
    await expect(panel.getByRole("heading", { name: "External AI: not decided" })).toBeVisible();
    await expect(panel.getByText("No licence is recorded for this file.")).toBeVisible();
    // Unknown means nothing is sent: there is no Send until the owner decides.
    await expect(panel.getByRole("button", { name: "Send", exact: true })).toHaveCount(0);
    // A decision needs a basis; it is refused with the registered sentence, and nothing is recorded.
    await panel.getByRole("button", { name: "Allow external AI" }).click();
    await expect(panel.getByRole("alert")).toHaveText(
      "Say briefly on what basis you are deciding (for example the licence, or 'my own notes'). It is recorded with the decision.",
    );
    expect(
      await sql("select 1 from processing_permission where asset_id = $1 and action = 'external_ai' and revoked_at is null", [storedId]),
    ).toHaveLength(0);
    // Enter in the basis field decides nothing: only Allow external AI and Deny record a decision.
    await panel.getByLabel("Basis").fill("I do not want AI on this paper");
    await panel.getByLabel("Basis").press("Enter");
    await page.waitForTimeout(1_500);
    await expect(panel.getByRole("heading", { name: "External AI: not decided" })).toBeVisible();
    expect(
      await sql("select 1 from processing_permission where asset_id = $1 and action = 'external_ai' and revoked_at is null", [storedId]),
    ).toHaveLength(0);
    await panel.getByLabel("Basis").fill("my own notes for study");
    await screenshot(page, "70-companion-permission");
    await panel.getByRole("button", { name: "Allow external AI" }).click();
    await expect(panel.getByRole("heading", { name: "External AI: allowed" })).toBeVisible();
    const basis = "my own notes for study [licence shown: No licence is recorded for this file.]";
    await expect(panel.getByText(`Basis: ${basis}`)).toBeVisible();
    const [row] = await sql<{ status: string; basis: string }>(
      "select status, basis from processing_permission where asset_id = $1 and action = 'external_ai' and revoked_at is null",
      [storedId],
    );
    expect(row).toEqual({ status: "allowed", basis });
    expect(await noHorizontalScroll(page)).toBe(true);
  });

  test("refusals show their reasons, and a selection gets a labelled scripted answer with what was sent", async ({ page }) => {
    test.setTimeout(180_000);
    await openReader(page, storedId);
    let panel = await openAsk(page);

    // No selection for a passage.
    await panel.getByRole("radio", { name: "Explain this passage" }).check();
    await send(panel);
    await expect(panel.getByRole("alert")).toContainText("Select the passage you want explained.");
    // Keyboard focus stays on Send after a refusal.
    await expect(panel.getByRole("button", { name: "Send", exact: true })).toBeFocused();
    // An explanation too short to check.
    await panel.getByRole("radio", { name: "Check my understanding" }).check();
    await panel.getByLabel("Your explanation").fill("too short");
    await send(panel);
    await expect(panel.getByRole("alert")).toContainText(
      "Write your own explanation first (a sentence or two), so there is something to check.",
    );
    if (compact(page)) await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();

    // Notation too long: five lines handed over through the selection bar.
    await selectText(page, 1, "Let X be a normed space", "Finite dimensional normed spaces");
    panel = await askAboutSelection(page);
    await expect(panel.getByText("Let X be a normed space")).toBeVisible();
    await panel.getByRole("radio", { name: "Explain this notation" }).check();
    await send(panel);
    await expect(panel.getByRole("alert")).toContainText("Select only the notation you want explained (up to 300 characters).");
    if (compact(page)) await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();

    // One line, explained: a labelled scripted answer citing the selected passage, found on its page.
    await selectText(page, 1, "Theorem 1. Every Cauchy sequence");
    panel = await askAboutSelection(page);
    await panel.getByRole("radio", { name: "Explain this passage" }).check();
    await panel.getByLabel("Anything to add (optional)").fill("");
    await expect(panel.getByText("Sent: your selection and the extracted text of page 1.")).toBeVisible();
    await send(panel);
    await expect(panel.getByRole("heading", { name: "Last answer" })).toBeVisible({ timeout: 60_000 });
    // ... and after an answer.
    await expect(panel.getByRole("button", { name: "Send", exact: true })).toBeFocused();
    await expect(
      panel.getByText(/Scripted demo response: no model is configured, so this is not an explanation of your passage\./),
    ).toBeVisible();
    await expect(panel.getByText("the reading companion · Scripted demo")).toBeVisible();
    await expect(panel.getByText(`E1: ${title}, PDF page 1: selected passage`)).toBeVisible();
    await expect(panel.getByText(`[E2] ${title}, PDF page 1: extracted text of the page`)).toBeVisible();
    expect(await noHorizontalScroll(page)).toBe(true);
    expect(await seriousAxe(page)).toEqual([]);
    await screenshot(page, "71-companion-answer");

    // A proof: the next page is sent too, and the answer says an explanation is not formal verification.
    await panel.getByRole("radio", { name: "Walk through this proof" }).check();
    await expect(panel.getByText("Sent: your selection and the extracted text of page 1 and the next page.")).toBeVisible();
    await send(panel);
    await expect(panel.getByText(/so this is not a walk through the proof\./)).toBeVisible({ timeout: 60_000 });
    await expect(panel.getByText("An explanation of a proof is not a formal verification of it.", { exact: true })).toBeVisible();
    await expect(panel.getByText(`[E3] ${title}, PDF page 2: extracted text of the next page`)).toBeVisible();

    // A later visit shows that answer with the same note and what was sent, from the stored request.
    await openReader(page, storedId);
    panel = await openAsk(page);
    await expect(panel.getByRole("heading", { name: "Last answer" })).toBeVisible();
    await expect(panel.getByText(/so this is not a walk through the proof\./)).toBeVisible();
    await expect(panel.getByText("An explanation of a proof is not a formal verification of it.", { exact: true })).toBeVisible();
    await expect(panel.getByText(`[E3] ${title}, PDF page 2: extracted text of the next page`)).toBeVisible();
  });

  test("the Text view's Ask is closed by default and answers a question about the page", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(`/library/read/${storedId}?view=text&page=1`);
    await expect(page.locator("#page-text")).toContainText("Theorem 1.");
    const ask = page.locator("details#ask");
    await expect(ask).not.toHaveAttribute("open", "");
    await expect(page.getByLabel("Your question")).toBeHidden();
    await page.locator("details#ask > summary").click();
    await ask.getByRole("radio", { name: "Ask a question" }).check();
    await ask.getByLabel("Your question").fill("What does this page claim?");
    await expect(ask.getByText("Sent: the extracted text of page 1.")).toBeVisible();
    await ask.getByRole("button", { name: "Send", exact: true }).click();
    await expect(ask.getByText(/so this does not answer your question\./)).toBeVisible({ timeout: 60_000 });
    await expect(ask.getByText(`E1: ${title}, PDF page 1: extracted text of the page`)).toBeVisible();
    await expect(ask.getByText("What does this page claim?")).toBeVisible();
    // The Text view's own scroll area does not overflow sideways either (long contents entries are cut, not widened).
    expect(await textViewOverflow(page)).toBe(0);
  });

  test.describe("without JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    test("the Text view's Ask cannot send and says why, so nothing navigates away from the reader", async ({ page }) => {
      await page.goto(`/library/read/${storedId}?view=text&page=1`);
      await page.locator("details#ask > summary").click();
      const ask = page.locator("details#ask");
      await expect(ask.getByRole("button", { name: "Send", exact: true })).toBeDisabled();
      // The hint is served inside <noscript> (which this browser mode does not lay out as elements).
      expect(await page.content()).toContain("Asking needs JavaScript; the rest of the reader works without it.");
    });
  });

  test("a paper read from arxiv.org sends only the selection, labelled as unchecked against the paper", async ({ page }) => {
    test.setTimeout(180_000);
    await page.route("https://arxiv.org/pdf/**", (route) =>
      route.fulfill({ status: 200, contentType: "application/pdf", headers: { "access-control-allow-origin": "*" }, body: LINKED_PDF }),
    );
    await openReader(page, linkedId);
    await expect
      .poll(
        async () => (await sql<{ h: string | null }>("select observed_sha256 as h from resource_asset where id = $1", [linkedId]))[0]!.h,
      )
      .toMatch(/^[0-9a-f]{64}$/);
    let panel = await openAsk(page);
    await expect(panel.getByRole("heading", { name: "External AI: not decided" })).toBeVisible();
    // The version's licence as arXiv reported it: the recorded record names none for v2.
    await expect(panel.getByText("No licence reported by arXiv for this version (recorded fixture data).")).toBeVisible();
    await panel.getByLabel("Basis").fill("personal study of passages I select");
    await panel.getByRole("button", { name: "Allow external AI" }).click();
    await expect(panel.getByRole("heading", { name: "External AI: allowed" })).toBeVisible();

    // Without a selection there is nothing to send for a paper read from arXiv.
    await panel.getByLabel("Your question").fill("What does beta control?");
    await send(panel);
    await expect(panel.getByRole("alert")).toContainText(
      "For a paper read from arXiv the companion sees only the text you select; select the passage first.",
    );
    if (compact(page)) await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();

    await selectText(page, 1, "The KL weight beta controls");
    panel = await askAboutSelection(page);
    // The question the owner started is kept; the selection is labelled as unchecked.
    await expect(panel.getByRole("radio", { name: "Ask a question" })).toBeChecked();
    await expect(panel.getByText(`${LINKED_LABEL}.`).first()).toBeVisible();
    await expect(panel.getByText("Sent: only your selection, marked as not checked against the paper.")).toBeVisible();
    await send(panel);
    await expect(panel.getByText(/so this does not answer your question\./)).toBeVisible({ timeout: 60_000 });
    await expect(panel.getByText(`E1: ${LINKED_LABEL}`)).toBeVisible();
    await expect(panel.getByText(`Only your selection was sent. ${LINKED_LABEL}.`)).toBeVisible();
    expect(await noHorizontalScroll(page)).toBe(true);
    await screenshot(page, "72-companion-linked");

    // The route takes JSON from this site's own pages only (the annotation routes' guard), before reading the body.
    const origin = new URL(page.url()).origin;
    const body = { assetId: linkedId, action: "question", pageIndex: null, selection: "x", text: "y" };
    expect((await page.request.post("/api/library/ask", { data: body })).status()).toBe(403);
    expect((await page.request.post("/api/library/ask", { data: body, headers: { origin: "https://evil.example" } })).status()).toBe(403);
    expect((await page.request.post("/api/library/ask", { form: { assetId: linkedId }, headers: { origin } })).status()).toBe(415);
    expect(
      (await page.request.post("/api/library/ask", { data: { ...body, action: "compare_papers" }, headers: { origin } })).status(),
    ).toBe(400);
  });
});
