import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page, test } from "@playwright/test";
import pg from "pg";
import { ownerEnv, screenshot, signInOrBootstrap } from "./helpers";
import { makePdfWithOutline } from "./pdf";
import { expectFixtureProviders } from "./scholarly";

/**
 * Journey 22: one research session as a person runs it (the owner's brief §3: discover → read →
 * understand → follow), on a production build in fixture mode (recorded OpenAlex, arXiv and Crossref
 * responses, labelled "Fixture data"; the scripted demo instead of a model), at both viewports.
 *
 * A new owner's library is empty and says what fills each part. Discover shows a subject's lists with
 * their factual explanations, and Surprise me. Find searches words, says honestly when nothing in the
 * library matches, and refuses a DOI link with no DOI in it. The paper (Maldacena's arXiv
 * hep-th/9711200, whose references, cited-by and related lists are recorded) is previewed and saved;
 * its paper page labels the lists as OpenAlex reports them, related works as similarity. Its arXiv
 * version opens in the reader on the file the browser fetches from arxiv.org, which this journey
 * answers itself with a generated stand-in PDF (tests/e2e/pdf.ts makePdfWithOutline; its own text
 * says it is not the paper), so arxiv.org is never contacted and the build keeps its production CSP.
 * In the reader: Contents (the stand-in's outline), Find and zoom; a highlight, a page note with
 * maths and a bookmark, all still there after a reload, with the position. The notebook's library
 * view lists the highlight and the note and reopens their page; a paper note with maths. A shelf
 * holds the paper with a note, a trail holds it as a step with a reason, and the paper page names
 * the step. The companion is closed until opened, shows the version's licence on its permission
 * form, records the owner's basis, and answers a question about a selection with a labelled scripted
 * answer that says what was sent. The home page's Continue reading reopens the paper at its page,
 * and the records export carries the paper, the shelf, the trail and the annotations.
 *
 * Both projects share one database. The loop's names carry the run and the project, the first loop
 * step deletes whatever an earlier run (or journey 20, which saves the same paper) left of the
 * paper, and the last step deletes what the loop made: the paper with its annotations and reading
 * position, the shelf, the trail and the paper note. Records exports stay (there is no way to
 * delete one). E2E_DATABASE_URL (the rehearsal database, test data only) is read to decide whether
 * the library is empty, to wait for the worker, and to remove what a failed earlier run left.
 */

const run = Date.now().toString(36);
const BOX = "DOI, arXiv id, OpenAlex id, a link to one of them, or words";
const ARXIV = "hep-th/9711200";
const TITLE = "The Large-N Limit of Superconformal Field Theories and Supergravity";
const LINKED_LABEL = "Text you selected in the reader; Corniversity has not checked it against the paper";
/** Names this journey gives to what it creates, so a failed run's leftovers can be found again. */
const PREFIX = "Loop 22";
const HIGHLIGHTED = "In the generated text the coupling lambda is held fixed as N grows.";
/** The page note's words (with maths below), distinct from every other journey's notes. */
const PAGE_NOTE = "Loop page note: the coupling";
// The same bytes every run, so no earlier run's notes could be measured on another file.
const STAND_IN = makePdfWithOutline(
  [
    `Generated stand-in for arXiv:${ARXIV} (journey 22). Not the paper.\nIntroduction\nThis page is test text standing in for a first page.`,
    `Page 2 of the generated stand-in. Not the paper.\nThe decoupling limit\n${HIGHLIGHTED}`,
    "Page 3 of the generated stand-in. Not the paper.\nSupergravity\nGenerated filler text for the third page.",
    "Page 4 of the generated stand-in. Not the paper.\nDiscussion\nThe word horizon appears only on this page.",
  ],
  [
    { title: "Introduction", page: 1 },
    { title: "The decoupling limit", page: 2 },
    { title: "Supergravity", page: 3 },
    { title: "Discussion", page: 4 },
  ],
);

const compact = (page: Page) => (page.viewportSize()?.width ?? 1440) <= 640 || (page.viewportSize()?.height ?? 900) <= 500;

/** Runs SQL on the rehearsal database (test data only), refusing anything that is not a local rehearsal database. */
async function withDb<T>(work: (db: pg.Client, ownerId: string) => Promise<T>): Promise<T> {
  const url = process.env.E2E_DATABASE_URL;
  if (!url) throw new Error("Journey 22 needs E2E_DATABASE_URL: the rehearsal database (test data only).");
  const parsed = new URL(url);
  if (!["127.0.0.1", "localhost"].includes(parsed.hostname) || parsed.pathname === "/corniversity_owner")
    throw new Error("E2E_DATABASE_URL must be a local rehearsal database, never the owner's installation.");
  const db = new pg.Client({ connectionString: url });
  await db.connect();
  try {
    const owner = await db.query<{ id: string }>('select id from "user" where email = $1', [ownerEnv().email]);
    if (!owner.rows[0]) throw new Error("The owner account does not exist yet; the setup project creates it.");
    return await work(db, owner.rows[0].id);
  } finally {
    await db.end();
  }
}

/** The page is no wider than its layout viewport (clientWidth: in phone emulation innerWidth grows with overflow). */
async function noHorizontalScroll(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth))
    .toBeLessThanOrEqual(1);
}

async function noSeriousAxeViolations(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious, `${label}: ${serious.map((v) => `${v.id} ${v.nodes[0]?.target.join(" ")}`).join("; ")}`).toEqual([]);
}

async function find(page: Page, text: string): Promise<void> {
  await page.goto("/library/find");
  await page.getByLabel(BOX).fill(text);
  await page.getByRole("button", { name: "Find", exact: true }).click();
  await page.waitForLoadState("domcontentloaded");
}

/** Answers the browser's arXiv PDF requests with the stand-in (CORS as arXiv sends it) and records them. */
async function serveArxiv(page: Page): Promise<string[]> {
  const seen: string[] = [];
  await page.route("https://arxiv.org/**", (route) => {
    seen.push(route.request().url());
    return route.fulfill({ status: 200, contentType: "application/pdf", headers: { "access-control-allow-origin": "*" }, body: STAND_IN });
  });
  return seen;
}

async function readerReady(page: Page): Promise<void> {
  await expect(page.getByRole("region", { name: `Pages of ${TITLE}` })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByLabel("Page", { exact: true })).toBeEnabled({ timeout: 30_000 });
}

/** A reader panel: the aside on desktop, the Panels dialog on phones. */
async function openPanel(page: Page, name: "Contents" | "Find" | "Notes" | "Paper" | "Ask"): Promise<Locator> {
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
  if (compact(page) && (await page.getByRole("dialog").isVisible()))
    await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
}

/** Selects one line of the stand-in's text layer, as a reader's drag would. */
async function selectLine(page: Page, pageNumber: number, text: string): Promise<void> {
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

/** The paper page, the reader's Document and the loop's names, shared by the serial loop below. */
const loop = { paper: "", documentId: "", shelf: "", trail: "", note: "" };

test.describe("research loop", () => {
  test.beforeEach(async ({ page, request }) => {
    await expectFixtureProviders(request);
    await signInOrBootstrap(page);
  });

  test("a new owner's empty library says what fills each part and offers the next step", async ({ page }) => {
    const held = await withDb(async (db, ownerId) => {
      const count = async (sql: string) => Number((await db.query<{ n: string }>(sql, [ownerId])).rows[0]!.n);
      return {
        papers: await count("select count(*) as n from scholarly_work where owner_id = $1"),
        collections: await count("select count(*) as n from library_collection where owner_id = $1"),
        files: await count("select count(*) as n from resource_asset where owner_id = $1 and deleted_at is null"),
      };
    });
    test.skip(
      held.papers + held.collections + held.files > 0,
      `This state exists only on a fresh database; the rehearsal database already holds ${held.papers} papers, ${held.collections} shelves or trails and ${held.files} files (start journey 22 right after a --fresh-db stack).`,
    );
    await page.goto("/library");
    await expect(page.getByRole("heading", { level: 1, name: "Library" })).toBeVisible();
    await expect(page.getByLabel("Find a paper: DOI, arXiv id, OpenAlex id, a link to one of them, or words")).toBeVisible();

    const reading = page.getByRole("region", { name: "Continue reading" });
    await expect(reading).toContainText(
      "Nothing opened yet. Papers and files you open in the reader appear here with the page you were on.",
    );
    const saved = page.getByRole("region", { name: "Saved papers" });
    await expect(saved).toContainText("No saved papers yet. Find a paper by its DOI, arXiv id, OpenAlex id or words, or browse Discover.");
    await expect(saved.getByRole("link", { name: "Find papers" })).toHaveAttribute("href", "/library/find");
    await expect(saved.getByRole("link", { name: "Discover" })).toHaveAttribute("href", "/library/discover");
    const collections = page.getByRole("region", { name: "Shelves and trails" });
    await expect(collections).toContainText("None yet. A shelf gathers papers under a name; a trail puts papers in an order");
    await expect(collections.getByRole("button", { name: "Create" })).toBeVisible();
    await expect(page.getByText("No files yet")).toBeVisible();
    await expect(page.getByRole("link", { name: "Upload a file" })).toHaveAttribute("href", "/library/upload");
    // Each saved view says what fills it; none counts, scores or nudges.
    await saved.getByRole("navigation", { name: "Saved papers views" }).getByRole("link", { name: "Read", exact: true }).click();
    await expect(saved).toContainText("You mark it yourself with Have read on a paper page; nothing is marked automatically.");
    expect(await page.locator("main").textContent()).not.toMatch(/streak|quota|badge|points|\d+ ?%/i);
    await noHorizontalScroll(page);
    await noSeriousAxeViolations(page, "empty library");
    await screenshot(page, "80-loop-empty-library");
    await page.getByRole("link", { name: "Add a paper" }).click();
    await expect(page).toHaveURL(/\/library\/find$/);
  });

  test("discover: a subject's lists with their factual explanations, and Surprise me", async ({ page }) => {
    test.setTimeout(240_000);
    await page.goto("/library");
    await page.getByRole("link", { name: "Discover", exact: true }).first().click();
    await expect(page).toHaveURL(/\/library\/discover$/);
    await expect(page.getByRole("heading", { level: 1, name: "Discover" })).toBeVisible();
    // On a fresh database the worker fetches the lists (from the recordings); the page refreshes itself until they arrive.
    await expect(page.getByText(/^Not fetched yet\./)).toHaveCount(0, { timeout: 180_000 });
    const mostCited = page.locator("#mathematics-most-cited");
    await expect(mostCited.getByRole("listitem")).toHaveCount(5);
    await expect(mostCited.getByText("Most cited in OpenAlex (a count, not a judgement of importance)").first()).toBeVisible();
    await expect(mostCited.getByText(/^Cited by [\d,]+ works in OpenAlex$/).first()).toBeVisible();
    await expect(mostCited.getByText("Fixture data")).toBeVisible();
    await expect(mostCited.getByText(/recorded from OpenAlex on 2026-11-15/)).toBeVisible();
    const earlier = page.locator("#physics-earlier");
    await expect(
      earlier.getByText(/^Most cited in OpenAlex among works published before 1990 \(a count, not a judgement of importance\)$/).first(),
    ).toBeVisible();
    await expect(
      page
        .locator("#mathematics-new")
        .getByText(/^Newest submissions to arXiv in /)
        .first(),
    ).toBeVisible();
    await noHorizontalScroll(page);

    // Surprise me: one sampled review from a field outside the owner's subjects, with what chose it.
    await page.getByRole("link", { name: "Surprise me" }).click();
    await expect(page).toHaveURL(/surprise=1/);
    const surprise = page.locator("#surprise");
    await expect(
      surprise.getByText(
        /^A review in .+, outside your subjects, with an abstract and free to read according to OpenAlex; chosen by OpenAlex sampling/,
      ),
    ).toBeVisible({ timeout: 60_000 });
    await expect(surprise.getByText("Abstract, as indexed by OpenAlex")).toBeVisible();
    await expect(surprise.getByText("Fixture data")).toBeVisible();
    await screenshot(page, "81-loop-discover");
  });

  test("find: words, a search with nothing in the library, and a DOI link with no DOI in it", async ({ page }) => {
    test.setTimeout(120_000);
    await find(page, "direct preference optimization");
    await expect(page.getByText(/^Results 1–25 of [\d,]+ according to OpenAlex/)).toBeVisible();
    const rows = page.getByRole("region", { name: "All papers" }).locator("ol > li");
    await expect(rows).toHaveCount(25);
    await expect(rows.first()).toContainText(/Cited by [\d,]+ according to OpenAlex/);
    await expect(page.getByText("Fixture data").first()).toBeVisible();

    // Words that match nothing the owner saved: a genuine empty result. (In fixture mode an OpenAlex
    // search nobody recorded is reported as unavailable, never as "no results", so My library is the
    // honest empty case here.)
    await page.getByLabel(BOX).fill(`nothing saved matches ${run}`);
    await page.getByRole("radio", { name: "My library" }).check();
    await page.getByRole("button", { name: "Find", exact: true }).click();
    await expect(page).toHaveURL(/scope=mine/);
    await expect(page.getByText("No paper in your library matches these words and filters.")).toBeVisible();

    // A doi.org link whose path is not a DOI: refused with its sentence, and nothing is searched or fetched.
    await find(page, "https://doi.org/10.1234");
    await expect(
      page.getByText("No DOI, arXiv id or OpenAlex id was found in that link (doi.org), and it has no words to search for."),
    ).toBeVisible();
    await expect(page.locator("ol > li")).toHaveCount(0);
    await noHorizontalScroll(page);
  });

  test.describe("one paper, from preview to export", () => {
    test.describe.configure({ mode: "serial" });

    test("preview, then save; the paper page labels its lists as OpenAlex reports them", async ({ page }, testInfo) => {
      test.setTimeout(300_000);
      loop.shelf = `${PREFIX} shelf ${run} ${testInfo.project.name}`;
      loop.trail = `${PREFIX} trail ${run} ${testInfo.project.name}`;
      loop.note = `${PREFIX} note ${run} ${testInfo.project.name}`;
      // What a failed earlier run left (test data only): this journey's shelves, trails and paper notes;
      // then the paper itself, through the page, if an earlier run or journey 20 left it saved.
      await withDb(async (db, ownerId) => {
        await db.query("delete from library_collection where owner_id = $1 and name like $2", [ownerId, `${PREFIX} %`]);
        await db.query("delete from notebook_entry where owner_id = $1 and title like $2", [ownerId, `${PREFIX} %`]);
      });
      await find(page, `arXiv:${ARXIV}`);
      if (/\/library\/papers\//.test(page.url())) await deletePaper(page);

      await find(page, `arXiv:${ARXIV}`);
      await expect(page).toHaveURL(/\/library\/works\/arxiv\/hep-th\/9711200$/);
      await expect(page.getByRole("heading", { level: 1, name: TITLE })).toBeVisible();
      await expect(page.getByText("Not in your library")).toBeVisible();
      await expect(page.getByText("Fixture data").first()).toBeVisible();
      await page.getByRole("button", { name: "Save to library" }).click();
      await expect(page).toHaveURL(/\/library\/papers\/[0-9a-f-]{36}$/);
      loop.paper = new URL(page.url()).pathname;
      await expect(page.getByText(/^In your saved papers since \d{4}-\d{2}-\d{2}\./)).toBeVisible();
      await expect(page.getByText("Fixture data").first()).toBeVisible();

      // References, cited by and related, each as OpenAlex reports it; related is similarity, never citation.
      const references = page.locator("#list-references");
      await expect(references).toContainText(/OpenAlex lists [\d,]+ references and returned records for [\d,]+/, { timeout: 30_000 });
      await expect(references.locator("ol > li").first()).toBeVisible();
      await expect(references.getByText("Fixture data").first()).toBeVisible();
      await expect(page.locator("#list-cited-by")).toContainText(/[\d,]+ works cite this paper according to OpenAlex/);
      const related = page.locator("#list-related");
      await expect(related).toContainText("Similar according to OpenAlex (similarity, not citation)");
      await expect(related).not.toContainText(/\bcites?\b|citing/i);
      // The arXiv record (versions and licences as arXiv reported them) arrives through the worker.
      await expect(page.getByRole("button", { name: "Read arXiv v3" })).toBeVisible({ timeout: 120_000 });
      await noHorizontalScroll(page);
      await screenshot(page, "82-loop-paper");
    });

    test("read the arXiv version: contents, find and zoom; a highlight, a page note with maths and a bookmark survive a reload", async ({
      page,
    }) => {
      test.setTimeout(240_000);
      const seen = await serveArxiv(page);
      await page.goto(loop.paper);
      await page.getByRole("button", { name: "Read arXiv v3" }).click();
      await expect(page).toHaveURL(/\/library\/read\/[0-9a-f-]{36}$/);
      loop.documentId = new URL(page.url()).pathname.split("/").pop()!;
      await readerReady(page);
      // The browser fetched arXiv's file for exactly this version; this journey answered it.
      expect(seen).toEqual([`https://arxiv.org/pdf/${ARXIV}v3`]);
      await expect(page.getByText(`arXiv:${ARXIV}v3 · read from arxiv.org ·`)).toBeVisible();
      const pageBox = page.getByLabel("Page", { exact: true });
      await expect(page.getByText("of 4", { exact: true })).toBeVisible();

      // Contents: the PDF's own outline.
      const contents = await openPanel(page, "Contents");
      await contents.getByRole("button", { name: "Supergravity" }).click();
      await expect(pageBox).toHaveValue("3");
      await expect(page.getByRole("button", { name: "Back to page 1" })).toBeVisible();
      await closePanel(page);
      // Find in the PDF.
      const findPanel = await openPanel(page, "Find");
      await findPanel.getByLabel("Find in this PDF").fill("horizon");
      await findPanel.getByLabel("Find in this PDF").press("Enter");
      await expect(findPanel.getByRole("status")).toHaveText(/^1 of 1 match/);
      await expect(pageBox).toHaveValue("4");
      await closePanel(page);
      // Zoom: 200% doubles the page's width at 100%; Fit width brings it back.
      const zoom = page.getByLabel("Zoom");
      const width = () => page.locator('.page[data-page-number="4"]').evaluate((el) => el.getBoundingClientRect().width);
      await zoom.selectOption("1");
      await expect.poll(width).toBeGreaterThan(0);
      const atHundred = await width();
      await zoom.selectOption("2");
      await expect.poll(async () => Math.round((await width()) / atHundred)).toBe(2);
      await zoom.selectOption("page-width");
      await expect(zoom).toHaveValue("page-width");

      // Page 2: a highlight, a page note with maths, and a bookmark.
      await pageBox.fill("2");
      await pageBox.press("Enter");
      await expect(pageBox).toHaveValue("2");
      await selectLine(page, 2, HIGHLIGHTED);
      await page.getByRole("toolbar", { name: "Selected text" }).getByRole("button", { name: "Highlight" }).click();
      await expect(page.getByRole("toolbar", { name: "Selected text" })).toBeHidden();
      await expect(marks(page, 2, "highlight")).toHaveCount(1);
      const notes = await openPanel(page, "Notes");
      await notes.getByRole("button", { name: "Page note", exact: true }).click();
      await notes.getByLabel("Note", { exact: true }).fill(`${PAGE_NOTE} $\\lambda = g^2_{YM} N$ is held fixed as $N \\to \\infty$.`);
      await notes.getByRole("button", { name: "Save note", exact: true }).click();
      await expect(notes.locator("li", { hasText: PAGE_NOTE }).locator("math").first()).toBeVisible();
      await notes.getByRole("button", { name: "Bookmark page", exact: true }).click();
      await expect(notes.getByRole("button", { name: "Remove bookmark", exact: true })).toBeVisible();
      await closePanel(page);

      // The move to page 2 reaches the server; a reload opens there with everything drawn again.
      await expect
        .poll(
          () =>
            withDb(async (db, ownerId) => {
              const rows = await db.query<{ physical_index: number }>(
                "select physical_index from reading_progress where owner_id = $1 and asset_id = $2",
                [ownerId, loop.documentId],
              );
              return rows.rows[0]?.physical_index ?? null;
            }),
          { timeout: 20_000 },
        )
        .toBe(1);
      await page.reload();
      await readerReady(page);
      await expect(pageBox).toHaveValue("2");
      await expect(marks(page, 2, "highlight")).toHaveCount(1);
      await expect(page.locator('.page[data-page-number="2"] .reader-bookmark')).toHaveCount(1);
      const after = await openPanel(page, "Notes");
      await expect(after.getByRole("heading", { name: "All notes (3)" })).toBeVisible();
      await expect(after.locator("li", { hasText: PAGE_NOTE }).locator("math").first()).toBeVisible();
      await expect(after.locator("li", { hasText: HIGHLIGHTED })).toContainText("Highlight");
      await noHorizontalScroll(page);
      await screenshot(page, "83-loop-reader");
      await closePanel(page);
    });

    test("library notes list the highlight and the note and reopen their page; a paper note with maths", async ({ page }) => {
      test.setTimeout(120_000);
      await serveArxiv(page);
      await page.goto("/library");
      await page.getByRole("link", { name: "Library notes" }).click();
      await expect(page).toHaveURL(/\/notebook\?library=1$/);
      const notes = page.getByRole("region", { name: /^Library notes/ });
      const highlight = notes.locator(":scope > ul > li").filter({ hasText: HIGHLIGHTED });
      await expect(highlight).toContainText("Highlight");
      await expect(highlight).toContainText(TITLE);
      const pageNote = notes.locator(":scope > ul > li").filter({ hasText: PAGE_NOTE });
      await expect(pageNote.locator("math").first()).toBeVisible();
      await expect(pageNote).toContainText("arXiv v3");
      // Each reopens its page: the highlight first, then the page note.
      await highlight.getByRole("link", { name: "Open page 2 in the reader" }).click();
      await expect(page).toHaveURL(new RegExp(`/library/read/${loop.documentId}\\?page=2$`));
      await readerReady(page);
      await expect(page.getByLabel("Page", { exact: true })).toHaveValue("2");
      await page.goBack();
      await expect(page).toHaveURL(/\/notebook\?library=1$/);
      await pageNote.getByRole("link", { name: "Open page 2 in the reader" }).click();
      await expect(page).toHaveURL(new RegExp(`/library/read/${loop.documentId}\\?page=2$`));
      await readerReady(page);
      await expect(page.getByLabel("Page", { exact: true })).toHaveValue("2");

      // A paper note, written from the paper page, with maths.
      await page.goto(loop.paper);
      await page.getByRole("link", { name: "New note for this paper" }).click();
      await expect(page.getByRole("heading", { level: 2, name: TITLE })).toBeVisible();
      await page.getByLabel("Title").fill(loop.note);
      // The box holds what the notebook keeps (50,000 characters), so nothing is cut off unseen or lost to an oversized request.
      await expect(page.getByLabel("Note (Markdown with LaTeX)")).toHaveAttribute("maxlength", "50000");
      await expect(page.getByText("Up to 50,000 characters.")).toBeVisible();
      await page.getByLabel("Note (Markdown with LaTeX)").fill("Why $AdS_5 \\times S^5$? The near-horizon geometry of the branes.");
      await page.getByRole("button", { name: "Save note", exact: true }).click();
      await expect(page).toHaveURL(/\/notebook\/[0-9a-f-]{36}\?saved=created$/);
      await expect(page.getByRole("heading", { level: 1, name: loop.note })).toBeVisible();
      await expect(page.locator("article math").first()).toBeVisible();
      await expect(page.getByRole("link", { name: TITLE })).toHaveAttribute("href", loop.paper);
      await noHorizontalScroll(page);
    });

    test("a shelf with the paper and a note; a trail with the paper as a step with a reason; the paper page names the step", async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await page.goto(loop.paper);
      const collections = page.locator("#collections");
      await collections.getByLabel("Name").fill(loop.shelf);
      await collections.getByLabel("Why (optional)").last().fill("For the decoupling argument; $\\lambda$ stays fixed.");
      await collections.getByRole("button", { name: "Create and add" }).click();
      await expect(page.locator("#collections")).toContainText(`Shelf: ${loop.shelf}`);
      await page.locator("#collections").getByLabel("New").selectOption("trail");
      await page.locator("#collections").getByLabel("Name").fill(loop.trail);
      await page.locator("#collections").getByLabel("Why (optional)").last().fill("Where the correspondence starts.");
      await page.locator("#collections").getByRole("button", { name: "Create and add" }).click();
      await expect(page.locator("#collections")).toContainText(`Trail: ${loop.trail}, step 1 of 1; the last step`);
      await expect(page.locator("#collections")).toContainText("Where the correspondence starts.");

      // The shelf shows the paper with its note, maths rendered.
      await page.locator("#collections").getByRole("link", { name: loop.shelf }).click();
      await expect(page.getByRole("heading", { level: 1, name: loop.shelf })).toBeVisible();
      const shelved = page.locator("#papers ol > li").filter({ hasText: TITLE });
      await expect(shelved).toContainText("For the decoupling argument");
      await expect(shelved.locator("math").first()).toBeVisible();
      await expect(shelved.getByRole("link", { name: /^Read/ })).toHaveAttribute("href", `/library/read/${loop.documentId}`);
      await noHorizontalScroll(page);
      // The trail shows it as step 1 with its reason.
      await page.goto(loop.paper);
      await page.locator("#collections").getByRole("link", { name: loop.trail }).click();
      await expect(page.getByRole("heading", { level: 1, name: loop.trail })).toBeVisible();
      const step = page.locator("#papers ol > li").filter({ hasText: TITLE });
      await expect(step).toContainText("Step 1");
      await expect(step).toContainText("Where the correspondence starts.");
      await noHorizontalScroll(page);
      await screenshot(page, "84-loop-trail");
    });

    test("the companion: closed by default; the licence on its permission form; a labelled scripted answer about a selection", async ({
      page,
    }) => {
      test.setTimeout(180_000);
      await serveArxiv(page);
      await page.goto(`/library/read/${loop.documentId}`);
      await readerReady(page);
      // Closed by default: nothing of the companion shows until the owner opens it.
      await expect(page.getByText("AI reading companion")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Send", exact: true })).toHaveCount(0);
      // The browser's report of the file it received is recorded before anything is asked.
      await expect
        .poll(() =>
          withDb(
            async (db) =>
              (await db.query<{ h: string | null }>("select observed_sha256 as h from resource_asset where id = $1", [loop.documentId]))
                .rows[0]?.h ?? null,
          ),
        )
        .toMatch(/^[0-9a-f]{64}$/);

      let panel = await openPanel(page, "Ask");
      await expect(panel.getByText("AI reading companion · scripted demo")).toBeVisible();
      await expect(panel.getByRole("heading", { name: "External AI: not decided" })).toBeVisible();
      // The exact version's licence as arXiv reported it: the recording names none for this paper. The line
      // stands alone (no "Licence:" label before a sentence that names itself).
      await expect(
        panel.getByText("No licence reported by arXiv for this version (recorded fixture data).", { exact: true }),
      ).toBeVisible();
      await expect(panel.getByRole("button", { name: "Send", exact: true })).toHaveCount(0);
      await panel.getByLabel("Basis").fill("personal study of passages I select");
      await panel.getByRole("button", { name: "Allow external AI" }).click();
      await expect(panel.getByRole("heading", { name: "External AI: allowed" })).toBeVisible();
      await expect(panel.getByText(/^Basis: personal study of passages I select \[licence shown: /)).toBeVisible();
      await closePanel(page);

      await selectLine(page, 2, HIGHLIGHTED);
      await page.getByRole("toolbar", { name: "Selected text" }).getByRole("button", { name: "Ask", exact: true }).click();
      panel = compact(page) ? page.getByRole("dialog", { name: "Ask" }) : page.getByRole("complementary", { name: "Ask" });
      await expect(panel.getByText(HIGHLIGHTED)).toBeVisible();
      await expect(panel.getByText(`${LINKED_LABEL}.`).first()).toBeVisible();
      await panel.getByRole("radio", { name: "Explain this passage" }).check();
      await expect(panel.getByText("Sent: only your selection, marked as not checked against the paper.")).toBeVisible();
      await panel.getByRole("button", { name: "Send", exact: true }).click();
      await expect(panel.getByRole("heading", { name: "Last answer" })).toBeVisible({ timeout: 60_000 });
      await expect(
        panel.getByText(/Scripted demo response: no model is configured, so this is not an explanation of your passage\./),
      ).toBeVisible();
      await expect(panel.getByText("the reading companion · Scripted demo")).toBeVisible();
      await expect(panel.getByText(`E1: ${LINKED_LABEL}`)).toBeVisible();
      await expect(panel.getByText(`Only your selection was sent. ${LINKED_LABEL}.`)).toBeVisible();
      await expect(panel.getByText("What was sent:")).toBeVisible();
      await noHorizontalScroll(page);
      await screenshot(page, "85-loop-companion");
      await closePanel(page);
    });

    test("home: Continue reading names the paper at its saved page and reopens it there", async ({ page }) => {
      test.setTimeout(90_000);
      await serveArxiv(page);
      await page.goto("/library");
      const reading = page.getByRole("region", { name: "Continue reading" });
      const item = reading.locator("li").filter({ hasText: TITLE });
      await expect(item).toContainText(/arXiv v3 · page 2( of 4)? · opened \d{4}-\d{2}-\d{2}/);
      await expect(item.getByText("Fixture data")).toBeVisible();
      await item.getByRole("link", { name: TITLE, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/library/read/${loop.documentId}$`));
      await readerReady(page);
      await expect(page.getByLabel("Page", { exact: true })).toHaveValue("2");
    });

    test("records export: built by the worker, it carries the paper, the shelf and trail, and the annotations", async ({ page }) => {
      test.setTimeout(180_000);
      await page.goto("/records");
      await page
        .locator("form", { has: page.locator('input[value="full"]') })
        .getByRole("button", { name: "Build" })
        .click();
      await expect(page.getByText("Export queued")).toBeVisible();
      // Newest first: the export just requested gets its Download link once the worker has built it.
      const newest = page.locator("li").filter({ hasText: "Everything (JSON) ·" }).first();
      await expect(async () => {
        await page.reload();
        await expect(newest.getByRole("link", { name: "Download" })).toBeVisible({ timeout: 1_000 });
      }).toPass({ timeout: 120_000, intervals: [2_000] });
      const response = await page.request.get((await newest.getByRole("link", { name: "Download" }).getAttribute("href"))!);
      expect(response.status()).toBe(200);
      const bundle = (await response.json()) as {
        library: {
          works: { title: string; identifiers: { scheme: string; value: string }[] }[];
          collections: { kind: string; name: string; items: { step: number; title: string; reason: string | null }[] }[];
          readingPositions: { item: string; version: string | null; page: number }[];
        };
        annotations: {
          kind: string;
          page: number | null;
          quote: string | null;
          note: string;
          version: { label: string } | null;
          work: { title: string } | null;
        }[];
      };
      const paper = bundle.library.works.find((w) => w.title === TITLE);
      expect(paper?.identifiers).toEqual(expect.arrayContaining([expect.objectContaining({ scheme: "arxiv", value: ARXIV })]));
      const shelf = bundle.library.collections.find((c) => c.name === loop.shelf);
      expect(shelf).toMatchObject({
        kind: "shelf",
        items: [{ step: 1, title: TITLE, reason: "For the decoupling argument; $\\lambda$ stays fixed." }],
      });
      const trail = bundle.library.collections.find((c) => c.name === loop.trail);
      expect(trail).toMatchObject({ kind: "trail", items: [{ step: 1, title: TITLE, reason: "Where the correspondence starts." }] });
      expect(bundle.library.readingPositions).toEqual(
        expect.arrayContaining([expect.objectContaining({ item: TITLE, version: "arXiv v3", page: 2 })]),
      );
      const mine = bundle.annotations.filter((a) => a.work?.title === TITLE);
      const kinds = mine.map((a) => [a.kind, a.page, a.version?.label]).sort();
      expect(kinds).toEqual(
        [
          ["bookmark", 2, "arXiv v3"],
          ["highlight", 2, "arXiv v3"],
          ["note", 2, "arXiv v3"],
        ].sort(),
      );
      expect(mine.find((a) => a.kind === "highlight")?.quote).toBe(HIGHLIGHTED);
      expect(mine.find((a) => a.kind === "note")?.note).toContain("$\\lambda = g^2_{YM} N$");
    });

    test("clean up: the paper note, the shelf, the trail and the paper with its annotations go", async ({ page }) => {
      test.setTimeout(120_000);
      // The paper note (deleting the paper keeps notebook entries, unlinked).
      await page.goto(`/notebook?q=${encodeURIComponent(loop.note)}`);
      await page.locator("section[aria-labelledby=entries-heading] h3 a", { hasText: loop.note }).first().click();
      await page.getByRole("checkbox", { name: "I want to delete this entry" }).check();
      await page.getByRole("button", { name: "Delete", exact: true }).click();
      await expect(page).toHaveURL(/deleted=1/);
      // The shelf and the trail, behind their confirmations.
      for (const [kind, name] of [
        ["shelf", loop.shelf],
        ["trail", loop.trail],
      ] as const) {
        await page.goto(`/library/${kind === "shelf" ? "shelves" : "trails"}`);
        await page.getByRole("link", { name, exact: true }).click();
        await page.getByRole("checkbox", { name: new RegExp(`^Delete this ${kind}; its papers, notes and files are kept`) }).check();
        await page.getByRole("button", { name: `Delete ${kind}` }).click();
        await expect(page).toHaveURL(new RegExp(`/library/${kind === "shelf" ? "shelves" : "trails"}\\?deleted=1$`));
      }
      // The paper, with its Document, annotations and reading position.
      await page.goto(loop.paper);
      await deletePaper(page);
      expect((await page.goto(loop.paper))?.status()).toBe(404);
      expect((await page.goto(`/library/read/${loop.documentId}`))?.status()).toBe(404);
    });
  });
});

async function deletePaper(page: Page): Promise<void> {
  await page.getByRole("link", { name: "Delete this paper and its notes…" }).click();
  await page.getByRole("checkbox", { name: "Delete this paper and its notes" }).check();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page).toHaveURL(/\/library\/find\?deleted=paper/);
}
