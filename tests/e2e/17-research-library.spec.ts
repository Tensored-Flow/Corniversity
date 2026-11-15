import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { screenshot, signInOrBootstrap } from "./helpers";
import { makePdf } from "./pdf";
import { expectFixtureProviders } from "./scholarly";

/**
 * Research library, find and paper (contract docs/RESEARCH_LIBRARY.md §2, §5, §6): against a
 * production build whose scholarly providers are recorded fixtures (never OpenAlex, arXiv or
 * Crossref themselves; every page labels such data "Fixture data").
 *
 * Find by words (All papers and My library, with filters and pages), by a DOI inside a link and by
 * an arXiv id; the preview and Save; the paper page with its flags, versions and licences as arXiv
 * reported them, DOI-only Read, and the bounded references, cited-by and related lists; honest
 * states for an arXiv id OpenAlex does not know and a DOI no provider knows. Reading an arXiv
 * version: the browser's request to arxiv.org is answered here with a generated PDF. Attaching the
 * owner's copy (and its refusal on another paper), a private copy of an openly licensed version
 * through the worker (the fixture provider's labelled stand-in PDF), shelves, corrections, Remove
 * from library and Delete this paper and its notes. The tests do not depend on each other (each
 * saves what it needs); both projects share one database, so the first test starts by deleting what
 * an earlier run left.
 */

const run = Date.now().toString(36);
const BOX = "DOI, arXiv id, OpenAlex id, a link to one of them, or words";
const DPO = "Direct Preference Optimization: Your Language Model is Secretly a Reward Model";
const PEERJ = /^The state of OA/;

async function find(page: Page, text: string): Promise<void> {
  await page.goto("/library/find");
  await page.getByLabel(BOX).fill(text);
  await page.getByRole("button", { name: "Find", exact: true }).click();
  await page.waitForLoadState("domcontentloaded");
}

/** Opens the paper page for an identifier, saving it from its preview when it is not in the library yet. */
async function openSaved(page: Page, identifier: string): Promise<string> {
  await find(page, identifier);
  if (/\/library\/works\//.test(page.url())) await page.getByRole("button", { name: "Save to library" }).click();
  await expect(page).toHaveURL(/\/library\/papers\/[0-9a-f-]{36}/);
  return new URL(page.url()).pathname;
}

/** Deletes the paper an identifier finds, if the owner has it (an earlier run or project left it). */
async function deleteIfPresent(page: Page, identifier: string): Promise<void> {
  await find(page, identifier);
  if (!/\/library\/papers\//.test(page.url())) return;
  await deleteCurrentPaper(page);
}

/** Deletes every paper of the owner's library that a word search finds (unidentified leftovers too). */
async function deleteMineMatching(page: Page, words: string): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await page.goto(`/library/find?q=${encodeURIComponent(words)}&scope=mine`);
    const first = page.getByRole("region", { name: "In my library" }).locator("li h3 a").first();
    if ((await first.count()) === 0) return;
    await first.click();
    await expect(page).toHaveURL(/\/library\/papers\//);
    await deleteCurrentPaper(page);
  }
}

async function deleteCurrentPaper(page: Page): Promise<void> {
  await page.getByRole("link", { name: "Delete this paper and its notes…" }).click();
  await expect(page.getByText(/^Files: \d+/)).toBeVisible();
  await page.getByRole("checkbox", { name: "Delete this paper and its notes" }).check();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page).toHaveURL(/\/library\/find\?deleted=paper/);
  await expect(page.getByText(/^Paper deleted, with its files/)).toBeVisible();
}

async function noHorizontalScroll(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}

async function noSeriousAxeViolations(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious, `${label}: ${serious.map((v) => `${v.id} ${v.nodes[0]?.target.join(" ")}`).join("; ")}`).toEqual([]);
}

test.describe("research library: find and paper", () => {
  test.beforeEach(async ({ page, request }) => {
    await expectFixtureProviders(request);
    await signInOrBootstrap(page);
  });

  test("find by words, a DOI in a link and an arXiv id; preview; save; the paper page, its flags, versions and lists", async ({
    page,
    browser,
  }) => {
    test.setTimeout(240_000);
    for (const id of ["arXiv:2305.18290", "10.7717/peerj.4375", "W4391941798"]) await deleteIfPresent(page, id);
    await deleteMineMatching(page, "preference");

    // My library: a genuine empty result before anything matching is saved.
    await page.goto("/library/find?q=preference&scope=mine");
    await expect(page.getByText("No paper in your library matches these words and filters.")).toBeVisible();

    // Words in All papers: OpenAlex's recorded search, pages, counts as OpenAlex's, fixture label.
    await find(page, "direct preference optimization");
    await expect(page).toHaveURL(/\/library\/find\?q=direct\+preference\+optimization/);
    await expect(page.getByText(/^Results 1–25 of [\d,]+ according to OpenAlex/)).toBeVisible();
    await expect(page.getByText("Fixture data").first()).toBeVisible();
    const rows = page.getByRole("region", { name: "All papers" }).locator("ol > li");
    await expect(rows).toHaveCount(25);
    await expect(rows.first()).toContainText(/Cited by [\d,]+ according to OpenAlex/);
    await noHorizontalScroll(page);
    await noSeriousAxeViolations(page, "find results");
    await screenshot(page, "research-library-find-results");
    await page.getByRole("link", { name: "Next page" }).click();
    await expect(page.getByText(/^Results 26–50 of [\d,]+ according to OpenAlex/)).toBeVisible();

    // Save from a result row: back on the same page, the row is marked.
    await page.goto("/library/find?q=direct+preference+optimization");
    await rows.first().getByRole("button", { name: /^Save/ }).click();
    await expect(page.getByText("Saved to your library.")).toBeVisible();
    await expect(rows.first().getByText("In your library")).toBeVisible();

    // Filters (Computer Science, 2023 to 2024, free to read): the recorded filtered search.
    await page.getByText("Filters", { exact: true }).click();
    await page.getByLabel("Published from (year)").fill("2023");
    await page.getByLabel("Published to (year)").fill("2024");
    await page.getByLabel("Field").selectOption("computer-science");
    await page.getByRole("checkbox", { name: /Free to read/ }).check();
    await page.getByRole("button", { name: "Find", exact: true }).click();
    await expect(page).toHaveURL(/field=computer-science/);
    await expect(page).toHaveURL(/from=2023&to=2024/);
    await expect(rows.first()).toContainText("Free to read according to OpenAlex");

    // A combination nobody recorded says so; it is never shown as "no results".
    await find(page, "an unrecorded search");
    await expect(
      page.getByText("No recorded provider response exists for this request (fixture mode), so it is unavailable."),
    ).toBeVisible();
    await expect(page.locator("ol > li")).toHaveCount(0);

    // A link with no identifier and no words in its path: one notice, nothing searched.
    await find(page, "https://doi.org/not-a-doi");
    await expect(
      page.getByText("No DOI, arXiv id or OpenAlex id was found in that link (doi.org), and it has no words to search for."),
    ).toBeVisible();
    await expect(page.getByText("Type words to search for.")).toHaveCount(0);

    // A DOI inside a link: the preview, never a fetch of the link.
    await find(page, "https://doi.org/10.7717/PEERJ.4375");
    await expect(page).toHaveURL(/\/library\/works\/doi\/10\.7717\/peerj\.4375$/);
    await expect(page.getByRole("heading", { level: 1, name: PEERJ })).toBeVisible();
    await expect(page.getByText("Not in your library")).toBeVisible();
    await expect(page.getByText("Fixture data").first()).toBeVisible();
    await expect(page.getByText(/according to OpenAlex/).first()).toBeVisible();
    await expect(page.getByText("Abstract as indexed by OpenAlex", { exact: false })).toBeVisible();
    await noHorizontalScroll(page);
    await noSeriousAxeViolations(page, "preview");
    await screenshot(page, "research-library-preview");
    await page.getByRole("button", { name: "Save to library" }).click();
    await expect(page).toHaveURL(/\/library\/papers\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1, name: PEERJ })).toBeVisible();
    await expect(page.getByText(/^In your saved papers since \d{4}-\d{2}-\d{2}\./)).toBeVisible();

    // DOI-only Read: the best open location (host and version named) or the publisher's page, in a new tab.
    const openCopy = page.getByRole("link", { name: "Read at PeerJ, published version" });
    await expect(openCopy).toHaveAttribute("target", "_blank");
    await expect(openCopy).toHaveAttribute("rel", "noopener noreferrer");
    await expect(page.getByRole("link", { name: "Publisher's page (through doi.org)" })).toHaveAttribute(
      "href",
      "https://doi.org/10.7717/peerj.4375",
    );

    // Flags.
    const flag = (name: string) => page.getByRole("button", { name, exact: true });
    for (const name of ["Favourite", "Read later", "Have read"]) {
      await flag(name).click();
      await expect(flag(name)).toHaveAttribute("aria-pressed", "true");
    }
    await flag("Favourite").click();
    await expect(flag("Favourite")).toHaveAttribute("aria-pressed", "false");

    // Bounded lists with what OpenAlex counted and matched; related is similarity, not citation.
    const references = page.locator("#list-references");
    await expect(references).toContainText(/OpenAlex lists 46 references and returned records for 42/);
    await expect(references.locator("ol > li")).toHaveCount(10);
    await references.getByRole("link", { name: /^Show more/ }).click();
    await expect(page.locator("#list-references ol > li")).toHaveCount(42);
    await expect(page.locator("#list-cited-by")).toContainText(/[\d,]+ works cite this paper according to OpenAlex/);
    await expect(page.locator("#list-related")).toContainText("Similar according to OpenAlex (similarity, not citation)");
    await noHorizontalScroll(page);
    await noSeriousAxeViolations(page, "paper page");

    // Without JavaScript a streamed part never replaces its placeholder: each placeholder still shown
    // links to the page rendered whole, which shows the Read links and the lists.
    const { origin, pathname: paperPath } = new URL(page.url());
    const noScript = await browser.newContext({ javaScriptEnabled: false, storageState: await page.context().storageState() });
    const plain = await noScript.newPage();
    await plain.goto(`${origin}${paperPath}`);
    const placeholders = await plain.getByText("Loading from OpenAlex…").count();
    await expect(plain.getByRole("link", { name: /^Show the (references|cited by|related) list$/ })).toHaveCount(placeholders);
    const readPlaceholder = await plain.getByText("Looking up where it can be read…").count();
    await expect(plain.getByRole("link", { name: "Show where it can be read" })).toHaveCount(readPlaceholder);
    await plain.goto(`${origin}${paperPath}?full=1`);
    await expect(plain.getByRole("link", { name: "Read at PeerJ, published version" })).toBeVisible();
    await expect(plain.locator("#list-references")).toContainText(/OpenAlex lists 46 references and returned records for 42/);
    await plain
      .locator("#list-references")
      .getByRole("link", { name: /^Show more/ })
      .click();
    await expect(plain).toHaveURL(/full=1&more=references/);
    await expect(plain.locator("#list-references ol > li")).toHaveCount(42);
    await expect(plain.getByText("Loading from OpenAlex…")).toHaveCount(0);
    await noScript.close();

    // An arXiv id: preview, Save, then the worker's arXiv record (versions and licences as arXiv reported them).
    await find(page, "arXiv:2305.18290");
    await expect(page).toHaveURL(/\/library\/works\/arxiv\/2305\.18290$/);
    await expect(page.getByRole("heading", { level: 1, name: DPO })).toBeVisible();
    await page.getByRole("button", { name: "Save to library" }).click();
    await expect(page).toHaveURL(/\/library\/papers\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 3, name: "arXiv v3", exact: true })).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText(/Licence CC BY 4\.0, as reported by arXiv OAI-PMH on \d{4}-\d{2}-\d{2}\./)).toBeVisible();
    const v1 = page.locator("#versions li").filter({ has: page.getByRole("heading", { name: "arXiv v1", exact: true }) });
    await expect(v1).toContainText("No licence reported by arXiv for this version.");
    await expect(v1.getByRole("button", { name: /Keep a private copy/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Keep a private copy of v3" })).toBeVisible();
    await expect(page.getByText("Fetching the arXiv record")).toHaveCount(0);
    await screenshot(page, "research-library-paper");

    // The search marks the saved paper.
    await page.goto("/library/find?q=direct+preference+optimization");
    await expect(page.locator("ol > li").filter({ hasText: DPO }).getByText("In your library")).toBeVisible();
    await page.goto("/library/find?q=preference&scope=mine");
    await expect(page.getByRole("link", { name: DPO })).toBeVisible();
    // Past the last page of My library: said so, with no invented number of pages.
    await page.goto("/library/find?q=preference&scope=mine&page=3");
    await expect(page.getByText("No more papers in your library match these words and filters on page 3.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to page 1" })).toBeVisible();

    // An arXiv id OpenAlex does not know: said so, with Save. A DOI nobody knows: said so.
    await find(page, "2611.99999");
    await expect(page.getByText("OpenAlex did not describe arXiv:2611.99999")).toBeVisible();
    await expect(page.getByText("OpenAlex has no record of this identifier.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save to library" })).toBeVisible();
    await find(page, "10.7717/corniversity-no-such-work");
    await expect(page.getByText("Neither OpenAlex nor Crossref has a record of this DOI.")).toBeVisible();

    // The paper saved from a result row goes again.
    await deleteIfPresent(page, "W4391941798");
  });

  test("reading an arXiv version opens the reader on the file the browser fetches from arxiv.org", async ({ page }) => {
    test.setTimeout(120_000);
    let served = 0;
    await page.route("https://arxiv.org/pdf/**", async (route) => {
      served++;
      await route.fulfill({
        status: 200,
        contentType: "application/pdf",
        headers: { "access-control-allow-origin": "*" },
        body: makePdf([`Generated stand-in for arXiv:2305.18290v2 (journey 17, ${run})`, "Second page."], false),
      });
    });
    await openSaved(page, "arXiv:2305.18290");
    await expect(page.getByRole("button", { name: "Read v2" })).toBeVisible({ timeout: 90_000 });
    await page.getByRole("button", { name: "Read v2" }).click();
    await expect(page).toHaveURL(/\/library\/read\/[0-9a-f-]{36}/);
    await expect(page.getByRole("region", { name: /^Pages of / })).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => served).toBeGreaterThan(0);
  });

  test("attach your copy (and its refusal elsewhere), a private copy through the worker, shelves, corrections, remove and delete", async ({
    page,
  }, testInfo) => {
    test.setTimeout(300_000);
    const shelf = `Preference learning ${run} ${testInfo.project.name}`;
    const own = makePdf([`The state of OA: the owner's copy (journey 17, ${run})`, "Page two of the owner's copy."], false);
    const peerj = await openSaved(page, "10.7717/peerj.4375");

    // A paper's file is a PDF: a text file, and a file named .pdf that is not one, are refused with their reasons.
    const fileInput = page.getByLabel(/^PDF of your copy/);
    await fileInput.setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("Plain notes.") });
    await page.getByRole("button", { name: "Attach", exact: true }).click();
    await expect(page.getByText("A paper's file must be a PDF; nothing was stored.")).toBeVisible();
    await page
      .getByLabel(/^PDF of your copy/)
      .setInputFiles({ name: "fake.pdf", mimeType: "application/pdf", buffer: Buffer.from("Not a PDF.") });
    await page.getByRole("button", { name: "Attach", exact: true }).click();
    await expect(page.getByText("The file does not start with a PDF signature; it was not stored.")).toBeVisible();
    await expect(page.locator("#files")).toContainText("No file of this paper is stored here.");

    // Attach the owner's copy: readable here at once, in the reader's Page view.
    await page.getByLabel(/^PDF of your copy/).setInputFiles({ name: `peerj-${run}.pdf`, mimeType: "application/pdf", buffer: own });
    await page.getByRole("button", { name: "Attach", exact: true }).click();
    await expect(page).toHaveURL(/saved=attached-stored/);
    await expect(page.getByText("Your copy is attached and can be read here.")).toBeVisible();
    await page.getByRole("link", { name: "Read your copy" }).click();
    await expect(page).toHaveURL(/\/library\/read\/[0-9a-f-]{36}/);
    await expect(page.getByRole("region", { name: /^Pages of / })).toBeVisible({ timeout: 30_000 });

    // The same file on another paper is refused, with a link to the paper it belongs to.
    const dpo = await openSaved(page, "arXiv:2305.18290");
    await page.getByLabel(/^PDF of your copy/).setInputFiles({ name: `again-${run}.pdf`, mimeType: "application/pdf", buffer: own });
    await page.getByRole("button", { name: "Attach", exact: true }).click();
    await expect(page.getByText("This file is already attached to another paper in your library.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Open the paper that file belongs to" })).toHaveAttribute("href", peerj);

    // A private copy of v3 (CC BY 4.0 as reported by arXiv for v3): fetched by the worker, stored here.
    await expect(page.getByRole("button", { name: "Keep a private copy of v3" })).toBeVisible({ timeout: 90_000 });
    await page.getByRole("button", { name: "Keep a private copy of v3" }).click();
    await expect(page.getByText(/^Private copy requested/)).toBeVisible();
    await expect(page.getByText("Private copy stored here")).toBeVisible({ timeout: 120_000 });
    const copy = page.locator("#files li").filter({ has: page.getByRole("heading", { name: "arXiv v3 (private copy)" }) });
    await expect(copy).toContainText("Allowed: Read here, Extract and index the text, Store a private copy");
    await expect(page.getByRole("button", { name: "Keep a private copy of v3" })).toHaveCount(0);
    // The stored copy of the latest version is read directly: one Read for it, not two.
    await expect(page.getByRole("link", { name: "Read arXiv v3 (copy stored here)" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Read arXiv v3" })).toHaveCount(0);
    await screenshot(page, "research-library-private-copy");

    // A shelf with a reason, then off it again.
    await page.getByLabel("Name").fill(shelf);
    await page.getByLabel("Why (optional)").last().fill("The method this course of reading starts from.");
    await page.getByRole("button", { name: "Create and add" }).click();
    const collections = page.locator("#collections");
    await expect(collections).toContainText(shelf);
    await expect(collections).toContainText("The method this course of reading starts from.");
    await collections.getByRole("button", { name: `Remove from ${shelf}` }).click();
    await expect(page.locator("#collections")).toContainText("Not on a shelf or trail.");

    // A correction is the owner's and says so; a long unbroken value wraps instead of widening the page.
    await page.getByText("Edit details", { exact: true }).click();
    await page.getByLabel("Venue").fill("V".repeat(500));
    await page.getByRole("button", { name: "Save corrections" }).click();
    await expect(page.getByText(/^Your corrections are saved/)).toBeVisible();
    await noHorizontalScroll(page);
    await page.getByText("Edit details", { exact: true }).click();
    await page.getByLabel("Venue").fill("NeurIPS 2023");
    await page.getByRole("button", { name: "Save corrections" }).click();
    await expect(page.getByText(/^Your corrections are saved/)).toBeVisible();
    await expect(page.getByText(/NeurIPS 2023\s*\(edited by you on \d{4}-\d{2}-\d{2}\)/)).toBeVisible();

    // Remove from library keeps the paper; delete removes it after a confirmation step.
    await page.getByRole("button", { name: "Remove from library" }).click();
    await expect(page.getByText("Not in your saved papers.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save to library" })).toBeVisible();
    // Find says so too, and offers Save again.
    await page.goto("/library/find?q=direct+preference+optimization");
    const removed = page.locator("ol > li").filter({ hasText: DPO });
    await expect(removed.getByText("Not in your saved papers")).toBeVisible();
    await expect(removed.getByText("In your library")).toHaveCount(0);
    await expect(removed.getByRole("button", { name: /^Save/ })).toBeVisible();
    await page.goto(dpo);
    await deleteCurrentPaper(page);
    await page.goto(peerj);
    await deleteCurrentPaper(page);
    expect((await page.goto(dpo))?.status()).toBe(404);
  });

  test("a paper without an identifier: added from a PDF, readable at once, merged into the identified paper after confirmation", async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    // Earlier unidentified copies of this title would be further suggestions; start without them.
    await deleteMineMatching(page, "preference");
    const dpo = await openSaved(page, "arXiv:2305.18290");
    await page.goto("/library/find");
    await page.getByRole("link", { name: "Add a paper without an identifier (PDF)" }).click();
    await expect(page).toHaveURL(/\/library\/papers\/new$/);
    await page.getByLabel(/^PDF \(up to/).setInputFiles({
      name: `printout-${run}.pdf`,
      mimeType: "application/pdf",
      buffer: makePdf([`My printout of DPO (journey 17, ${run}, ${testInfo.project.name})`], false),
    });
    await page.getByLabel("Title (optional)").fill(DPO);
    await page.getByRole("button", { name: "Add paper" }).click();
    await expect(page).toHaveURL(/\/library\/papers\/[0-9a-f-]{36}\?saved=added$/);
    const added = new URL(page.url()).pathname;
    await expect(page.getByText("Not identified")).toBeVisible();
    await expect(page.getByRole("link", { name: "Read your copy" })).toBeVisible();

    // The identified paper suggests it (a near-identical title: a suggestion only); merging needs the box ticked.
    await page.goto(dpo);
    const duplicates = page.locator("#duplicates");
    await expect(duplicates).toContainText("has a near-identical title (a suggestion only)");
    await duplicates.getByRole("button", { name: "Merge into this paper" }).click();
    await expect(page.getByText("Tick the box to merge these papers.")).toBeVisible();
    await page.locator("#duplicates").getByRole("checkbox", { name: "They are the same paper" }).check();
    await page.locator("#duplicates").getByRole("button", { name: "Merge into this paper" }).click();
    await expect(page.getByText("Merged into this paper.")).toBeVisible();
    await expect(page.locator("#files")).toContainText("Your copy");
    // The merged paper's address now opens the paper it was merged into.
    await page.goto(added);
    await expect(page).toHaveURL(new RegExp(`${dpo}$`));
    await deleteCurrentPaper(page);
  });

  test("a confirmed PDF in Files opens in the reading room before its text is extracted", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/library/upload");
    await page.getByLabel(/^File \(PDF, Markdown or plain text/).setInputFiles({
      name: `unextracted-${run}.pdf`,
      mimeType: "application/pdf",
      buffer: makePdf([`An unextracted PDF (journey 17, ${run})`], false),
    });
    await page.getByRole("button", { name: "Upload to quarantine" }).click();
    await expect(page).toHaveURL(/\/library\/items\/[0-9a-f-]{36}/);
    await page.getByLabel("Title").fill(`Unextracted ${run}`);
    await page.getByRole("button", { name: "Confirm metadata" }).click();
    await expect(page.getByText("Metadata saved.")).toBeVisible();
    await expect(page.getByText("Not yet extracted.")).toBeVisible();
    await page.getByRole("link", { name: "Open in the reading room" }).click();
    await expect(page.getByRole("region", { name: /^Pages of / })).toBeVisible({ timeout: 30_000 });
    await page.goBack();
    await page.getByRole("checkbox", { name: /Delete the stored original/ }).check();
    await page.getByRole("button", { name: "Delete item" }).click();
    await expect(page).toHaveURL(/\/library\?deleted=1/);
  });
});

test.describe("research library: signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("the find, preview and paper pages need a session; the upload routes refuse other sites and absent sessions", async ({
    page,
    request,
  }) => {
    await expectFixtureProviders(request);
    for (const path of [
      "/library/find",
      "/library/works/doi/10.7717/peerj.4375",
      "/library/papers/00000000-0000-4000-8000-000000000000",
      "/library/papers/new",
    ]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/sign-in/);
    }
    for (const path of ["/api/library/papers/00000000-0000-4000-8000-000000000000/attach", "/api/library/papers/new"]) {
      const crossSite = await request.post(path, {
        multipart: { file: { name: "x.pdf", mimeType: "application/pdf", buffer: makePdf(["x"], false) } },
      });
      expect(crossSite.status(), path).toBe(403);
      const unsigned = await request.post(path, {
        headers: { "sec-fetch-site": "same-origin" },
        multipart: { file: { name: "x.pdf", mimeType: "application/pdf", buffer: makePdf(["x"], false) } },
        maxRedirects: 0,
      });
      expect(unsigned.status(), path).toBe(303);
      expect(unsigned.headers().location, path).toMatch(/\/sign-in\?next=/);
    }
  });
});
