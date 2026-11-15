import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page, test } from "@playwright/test";
import pg from "pg";
import { ownerEnv, screenshot, signInOrBootstrap } from "./helpers";
import { makePdf } from "./pdf";
import { expectFixtureProviders } from "./scholarly";

/**
 * Journey 20: the Library home, shelves, trails and library notes (contract docs/RESEARCH_LIBRARY.md
 * §2, §3, §6), against a production build whose scholarly providers are recorded fixtures.
 *
 * Three papers are saved through Find and the preview (arXiv hep-th/9711200 and 1706.03762, whose
 * versions arrive through the stack's worker from the recordings, and OpenAlex W2143981217). The
 * home's saved views follow the flags set on the paper pages; *Continue reading* names the paper
 * opened in the reader (the browser's arxiv.org request is answered here with a generated PDF) and
 * reopens it on the page it was left at. A paper note with maths is written from the paper page;
 * highlights, a bookmark and a page note are made in the reader; the notebook's library view filters
 * them by paper, kind, subject and words and reopens their pages, and says when an anchor needs
 * repair (the one state set through E2E_DATABASE_URL, test data only, and restored). A shelf and a
 * trail are created, filled from the library, ordered, annotated, renamed and deleted; the paper
 * page names a paper's trail step and the next paper. The records export carries the library.
 * Notices are checked in the viewport: each form's notice shows where its redirect lands. Long links
 * in owner Markdown wrap instead of widening the page.
 *
 * Both projects share one database: the first test deletes the journey's paper notes and the three
 * papers if an earlier run or the other project left them, the last deletes its own paper note, and
 * shelves and trails are named by run and project.
 */
test.describe.configure({ mode: "serial" });

const BOX = "DOI, arXiv id, OpenAlex id, a link to one of them, or words";
const LARGE = "The Large-N Limit of Superconformal Field Theories and Supergravity";
const ATTENTION = "Attention Is All You Need";
const BECKE = "Density-functional thermochemistry. III. The role of exact exchange";
const run = Date.now().toString(36);
const PDF = makePdf(
  [
    `Generated stand-in for arXiv:1706.03762 (journey 20, ${run}). Not the paper.\nScaled dot-product attention divides by the square root of the key dimension.`,
    "Page two of the stand-in.\nMulti-head attention runs several heads in parallel.",
    "Page three of the stand-in.",
    "Page four of the stand-in.",
  ],
  false,
);

const paths = { large: "", attention: "", becke: "" };
let attentionDocument = "";

const workId = (path: string) => path.split("/").pop()!;
const compact = (page: Page) => (page.viewportSize()?.width ?? 1440) <= 640 || (page.viewportSize()?.height ?? 900) <= 500;

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

async function deleteIfPresent(page: Page, identifier: string): Promise<void> {
  await find(page, identifier);
  if (!/\/library\/papers\//.test(page.url())) return;
  await page.getByRole("link", { name: "Delete this paper and its notes…" }).click();
  await page.getByRole("checkbox", { name: "Delete this paper and its notes" }).check();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page).toHaveURL(/\/library\/find\?deleted=paper/);
}

/**
 * The page is no wider than its layout viewport. Compared with clientWidth: in phone emulation an
 * overflowing page widens window.innerWidth to the content, so innerWidth would hide the overflow.
 */
async function noHorizontalScroll(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth))
    .toBeLessThanOrEqual(1);
}

/** A bare link with no break opportunity after its host, as owners paste them into notes. */
const LONG_URL = `https://example.org/${"abcdefghij".repeat(14)}`;

/** Deletes this journey's paper notes (from any run) through the notebook, so no run leaves entries behind. */
async function deleteJourneyNotes(page: Page): Promise<void> {
  const entries = page.locator("section[aria-labelledby=entries-heading] h3 a", { hasText: /^Why the coupling stays fixed / });
  for (let i = 0; i < 20; i++) {
    await page.goto(`/notebook?q=${encodeURIComponent("coupling stays fixed")}`);
    if ((await entries.count()) === 0) return;
    await entries.first().click();
    await page.getByRole("checkbox", { name: "I want to delete this entry" }).check();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page).toHaveURL(/deleted=1/);
  }
  throw new Error("journey 20's paper notes were not all deleted");
}

async function noSeriousAxeViolations(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious, `${label}: ${serious.map((v) => `${v.id} ${v.nodes[0]?.target.join(" ")}`).join("; ")}`).toEqual([]);
}

/** Answers the browser's arXiv PDF requests (CORS as arXiv sends it). */
async function serveArxiv(page: Page): Promise<void> {
  await page.route("https://arxiv.org/pdf/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/pdf", headers: { "access-control-allow-origin": "*" }, body: PDF }),
  );
}

async function readerReady(page: Page): Promise<void> {
  await expect(page.getByRole("region", { name: /^Pages of / })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByLabel("Page", { exact: true })).toBeEnabled({ timeout: 30_000 });
}

async function openNotesPanel(page: Page): Promise<Locator> {
  if (compact(page)) {
    await page.getByRole("button", { name: "Panels" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Notes", exact: true }).click();
    return page.getByRole("dialog", { name: "Notes" });
  }
  await page.getByRole("button", { name: "Notes", exact: true }).click();
  return page.getByRole("complementary", { name: "Notes" });
}

/** The titles of a collection's papers, in the order shown. */
const listed = (page: Page) => page.locator("#papers ol > li h3 a").allTextContents();

async function sql(text: string, values: unknown[]): Promise<void> {
  const url = process.env.E2E_DATABASE_URL;
  if (!url) throw new Error("Journey 20 needs E2E_DATABASE_URL (the rehearsal database, test data only) for the needs-repair state.");
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(text, values);
  } finally {
    await client.end();
  }
}

test.describe("library home, shelves, trails and notes", () => {
  test.beforeEach(async ({ page, request }) => {
    await expectFixtureProviders(request);
    await signInOrBootstrap(page);
  });

  test("three papers saved through Find and the preview, with their arXiv versions from the worker", async ({ page }) => {
    test.setTimeout(300_000);
    await deleteJourneyNotes(page);
    for (const id of ["arXiv:hep-th/9711200", "arXiv:1706.03762", "W2143981217"]) await deleteIfPresent(page, id);
    paths.large = await openSaved(page, "arXiv:hep-th/9711200");
    paths.attention = await openSaved(page, "arXiv:1706.03762");
    paths.becke = await openSaved(page, "W2143981217");
    await expect(page.getByRole("heading", { level: 1, name: BECKE })).toBeVisible();
    // Saving queues Crossref's check for its DOI, which has no recorded response: the page says it was
    // not made, once the worker has run it, and never shows the paper as checked.
    await expect(async () => {
      await page.goto(paths.becke);
      await expect(page.getByText("Not checked for corrections and retractions")).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 90_000 });
    await expect(page.getByText(/No recorded response in fixture mode for DOI 10\.1063\/1\.464913/)).toBeVisible();
    for (const path of [paths.large, paths.attention]) {
      await page.goto(path);
      await expect(page.getByRole("button", { name: /^Read arXiv v\d+$/ })).toBeVisible({ timeout: 120_000 });
    }
  });

  test("home: the find box, saved views that follow the paper pages' flags, and honest empty views", async ({ page }) => {
    test.setTimeout(120_000);
    const flag = async (path: string, name: string) => {
      await page.goto(path);
      await page.getByRole("button", { name, exact: true }).click();
      await expect(page.getByRole("button", { name, exact: true })).toHaveAttribute("aria-pressed", "true");
    };
    await flag(paths.attention, "Favourite");
    await flag(paths.large, "Read later");
    await flag(paths.becke, "Have read");

    await page.goto("/library");
    await expect(page.getByRole("heading", { level: 1, name: "Library" })).toBeVisible();
    const saved = page.getByRole("region", { name: "Saved papers" });
    for (const title of [LARGE, ATTENTION, BECKE]) await expect(saved.getByRole("link", { name: title, exact: true })).toBeVisible();
    await expect(saved.getByText("Fixture data").first()).toBeVisible();
    await noHorizontalScroll(page);
    await noSeriousAxeViolations(page, "library home");
    await screenshot(page, "70-library-home");

    const views = page.getByRole("navigation", { name: "Saved papers views" });
    await views.getByRole("link", { name: "Favourites" }).click();
    await expect(page).toHaveURL(/view=favourites/);
    await expect(views.getByRole("link", { name: "Favourites" })).toHaveAttribute("aria-current", "page");
    await expect(saved.getByRole("link", { name: ATTENTION, exact: true })).toBeVisible();
    await expect(saved.getByRole("link", { name: LARGE, exact: true })).toHaveCount(0);
    await views.getByRole("link", { name: "Read later" }).click();
    await expect(saved.getByRole("link", { name: LARGE, exact: true })).toBeVisible();
    await expect(saved.getByRole("link", { name: ATTENTION, exact: true })).toHaveCount(0);
    await views.getByRole("link", { name: "Read", exact: true }).click();
    await expect(page).toHaveURL(/view=read(&|#|$)/);
    await expect(saved.locator("li").filter({ hasText: BECKE })).toContainText(/marked read \d{4}-\d{2}-\d{2}/);
    // Nothing of the three has been opened in the reader in this run.
    await views.getByRole("link", { name: "Recently opened" }).click();
    await expect(saved.getByRole("link", { name: ATTENTION, exact: true })).toHaveCount(0);
    // A page past the last says so.
    await page.goto("/library?view=favourites&page=40");
    await expect(saved.getByText("No more papers in this view on page 40.")).toBeVisible();
    // However large the number.
    await page.goto("/library?view=favourites&page=1000");
    await expect(saved.getByText("No more papers in this view on page 1000.")).toBeVisible();
    await expect(saved.getByRole("link", { name: ATTENTION, exact: true })).toHaveCount(0);

    // The find box searches Find papers; an identifier opens the paper page.
    await page.goto("/library");
    await page.getByLabel("Find a paper: DOI, arXiv id, OpenAlex id, a link to one of them, or words").fill("arXiv:1706.03762");
    await page.getByRole("button", { name: "Find", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${paths.attention}$`));
    await page.goto("/library");
    await page.getByRole("link", { name: "Add a paper" }).click();
    await expect(page).toHaveURL(/\/library\/find$/);
  });

  test("continue reading: the paper opened in the reader, its page, and the reader reopened there", async ({ page }) => {
    test.setTimeout(150_000);
    await serveArxiv(page);
    await page.goto(paths.attention);
    await page.getByRole("button", { name: /^Read arXiv v\d+$/ }).click();
    await expect(page).toHaveURL(/\/library\/read\/[0-9a-f-]{36}/);
    attentionDocument = new URL(page.url()).pathname.split("/").pop()!;
    await readerReady(page);
    await page.getByRole("button", { name: "Next page" }).click();
    await expect(page.getByLabel("Page", { exact: true })).toHaveValue("2");

    // Leaving the reader sends the latest move; the home page names the paper and its page.
    await page.goto("/library");
    const reading = page.getByRole("region", { name: "Continue reading" });
    await expect
      .poll(
        async () => {
          await page.reload();
          return (await reading.locator("li").first().textContent()) ?? "";
        },
        { timeout: 30_000, intervals: [1_000] },
      )
      .toMatch(new RegExp(`^${ATTENTION}arXiv v\\d+ · page 2( of \\d+)? · opened \\d{4}-\\d{2}-\\d{2}`));
    const link = reading.getByRole("link", { name: ATTENTION, exact: true });
    await expect(link).toHaveAttribute("href", `/library/read/${attentionDocument}`);
    expect(await reading.locator("li").count()).toBeLessThanOrEqual(3);

    // The saved row offers Read, and Recently opened now lists the paper.
    const saved = page.getByRole("region", { name: "Saved papers" });
    await expect(saved.locator("li").filter({ hasText: ATTENTION }).getByRole("link", { name: /^Read/ })).toHaveAttribute(
      "href",
      `/library/read/${attentionDocument}`,
    );
    await page.getByRole("navigation", { name: "Saved papers views" }).getByRole("link", { name: "Recently opened" }).click();
    await expect(saved.locator("li").filter({ hasText: ATTENTION })).toContainText(/opened \d{4}-\d{2}-\d{2}/);

    await page.goto("/library");
    await reading.getByRole("link", { name: ATTENTION, exact: true }).click();
    await readerReady(page);
    await expect(page.getByLabel("Page", { exact: true })).toHaveValue("2", { timeout: 15_000 });
  });

  test("a paper note with maths, written from the paper page, listed under that paper's notes", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto(paths.large);
    await page.getByRole("link", { name: "New note for this paper" }).click();
    await expect(page).toHaveURL(new RegExp(`/notebook\\?library=1&work=${workId(paths.large)}#new-note$`));
    await expect(page.getByRole("heading", { level: 2, name: LARGE })).toBeVisible();
    const title = `Why the coupling stays fixed ${run}`;
    // A note with no body is refused, and the refusal shows on the form, where the page lands.
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Note (Markdown with LaTeX)").fill("   ");
    await page.getByRole("button", { name: "Save note" }).click();
    await expect(page).toHaveURL(/error=[a-z-]+#new-note$/);
    await expect(page.getByText("Write the entry itself; a title on its own is not kept.")).toBeInViewport();
    await page.getByLabel("Title").fill(title);
    await page
      .getByLabel("Note (Markdown with LaTeX)")
      .fill(`The 't Hooft coupling $\\lambda = g^2_{YM} N$ stays fixed as $N \\to \\infty$. Lectures: ${LONG_URL}`);
    await page.getByRole("button", { name: "Save note" }).click();
    await expect(page).toHaveURL(/\/notebook\/[0-9a-f-]{36}\?saved=created$/);
    await expect(page.getByText("Note saved.")).toBeInViewport();
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.locator("article math").first()).toBeVisible();
    await expect(page.getByRole("link", { name: LARGE })).toHaveAttribute("href", paths.large);
    // A long link in the note wraps instead of widening the page.
    await noHorizontalScroll(page);

    // The paper page's link lists exactly this paper's notes.
    await page.goto(paths.large);
    await page.getByRole("link", { name: "Notes for this paper" }).click();
    const notes = page.getByRole("region", { name: /^Library notes/ });
    await expect(notes.locator(":scope > ul > li")).toHaveCount(1);
    await expect(notes.getByRole("link", { name: title, exact: true })).toBeVisible();
    await expect(notes.getByText("Paper note")).toBeVisible();
    await expect(notes.locator("math").first()).toBeVisible();
    await noHorizontalScroll(page);
  });

  test("library notes: a highlight, a bookmark and a page note; filters by paper, kind, subject and words; back to the page", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await serveArxiv(page);
    await page.goto(`/library/read/${attentionDocument}?page=1`);
    await readerReady(page);
    const span = page.locator('.page[data-page-number="1"] .textLayer span', { hasText: "Scaled dot-product attention" }).first();
    await expect(span).toBeAttached({ timeout: 30_000 });
    await span.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
    });
    await page.getByRole("toolbar", { name: "Selected text" }).getByRole("button", { name: "Highlight" }).click();
    await expect(page.getByRole("toolbar", { name: "Selected text" })).toBeHidden();
    await page.getByRole("button", { name: "Next page" }).click();
    await expect(page.getByLabel("Page", { exact: true })).toHaveValue("2");
    const panel = await openNotesPanel(page);
    await panel.getByRole("button", { name: "Bookmark page" }).click();
    await expect(panel.getByRole("button", { name: "Remove bookmark" })).toBeVisible();
    await panel.getByRole("button", { name: "Page note" }).click();
    await panel.getByLabel("Note", { exact: true }).fill("Dividing by $\\sqrt{d_k}$ keeps the softmax away from saturation.");
    await panel.getByRole("button", { name: "Save note" }).click();
    await expect(panel.getByText("keeps the softmax away from saturation")).toBeVisible();

    // Exactly this paper's notes, newest first, each reopening its page.
    await page.goto(paths.attention);
    await page.getByRole("link", { name: "Notes for this paper" }).click();
    const notes = page.getByRole("region", { name: /^Library notes/ });
    const items = notes.locator(":scope > ul > li");
    await expect(items).toHaveCount(3);
    await expect(items.nth(0)).toContainText("keeps the softmax away from saturation");
    await expect(items.nth(0).locator("math")).toHaveCount(1);
    await expect(items.nth(1)).toContainText("Bookmark");
    await expect(items.nth(2)).toContainText("Highlight");
    await expect(items.nth(2).locator("blockquote")).toContainText("Scaled dot-product attention");
    await expect(items.nth(2)).toContainText("Brass");
    await expect(notes.getByText(/Why the coupling stays fixed/)).toHaveCount(0);
    await noHorizontalScroll(page);
    await noSeriousAxeViolations(page, "library notes");
    await screenshot(page, "71-library-notes");
    await items.nth(1).getByRole("link", { name: "Open page 2 in the reader" }).click();
    await expect(page).toHaveURL(new RegExp(`/library/read/${attentionDocument}\\?page=2$`));
    await readerReady(page);
    await expect(page.getByLabel("Page", { exact: true })).toHaveValue("2");

    // An anchor that needs repair says so and still opens the page it was made on.
    await sql(
      `update annotation set mapping_status = 'needs_repair' where kind = 'bookmark' and asset_id = $1 and owner_id = (select id from "user" where email = $2)`,
      [attentionDocument, ownerEnv().email],
    );
    await page.goto(`/notebook?library=1&work=${workId(paths.attention)}&kind=bookmark`);
    await expect(items).toHaveCount(1);
    await expect(items.first().getByText("Needs repair", { exact: true })).toBeVisible();
    await expect(items.first()).toContainText("the reader opens the page it was made on");
    await expect(items.first().getByRole("link", { name: "Open page 2 in the reader" })).toHaveAttribute(
      "href",
      `/library/read/${attentionDocument}?page=2`,
    );
    await sql(
      `update annotation set mapping_status = 'resolved' where kind = 'bookmark' and asset_id = $1 and owner_id = (select id from "user" where email = $2)`,
      [attentionDocument, ownerEnv().email],
    );

    // By kind, by words, and by the paper's OpenAlex field.
    await page.goto(`/notebook?library=1&work=${workId(paths.attention)}`);
    await page.getByRole("navigation", { name: "Kinds of library notes" }).getByRole("link", { name: "Highlights" }).click();
    await expect(page).toHaveURL(/kind=highlight/);
    await expect(items).toHaveCount(1);
    await expect(items.first()).toContainText("Scaled dot-product attention");
    await page.goto("/notebook?library=1");
    await page.getByLabel("Search library notes").fill("saturation");
    await page.getByRole("button", { name: "Go" }).click();
    await expect(notes.getByText("keeps the softmax away from saturation")).toBeVisible();
    await expect(notes.getByText("Scaled dot-product attention")).toHaveCount(0);
    await page.goto("/notebook?library=1&kind=paper");
    await expect(notes.getByRole("link", { name: /^Why the coupling stays fixed/ }).first()).toBeVisible();
    await page.goto("/notebook?library=1");
    const subjects = page.getByRole("navigation", { name: "Subjects of the papers" });
    await subjects.getByRole("link", { name: "Computer Science" }).click();
    await expect(page).toHaveURL(/subject=\d+/);
    await expect(notes.getByText("keeps the softmax away from saturation")).toBeVisible();
    await expect(notes.getByRole("link", { name: `Why the coupling stays fixed ${run}`, exact: true })).toHaveCount(0);
    await subjects.getByRole("link", { name: "Physics and Astronomy" }).click();
    await expect(notes.getByRole("link", { name: `Why the coupling stays fixed ${run}`, exact: true })).toBeVisible();
    await expect(notes.getByText("keeps the softmax away from saturation")).toHaveCount(0);
  });

  test("a shelf: created, filled from the library, ordered, annotated, searched, renamed, emptied and deleted", async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    const name = `Shelf ${run} ${testInfo.project.name}`;
    await page.goto("/library/shelves");
    await page.getByLabel("Name").fill(name);
    await page.getByLabel("Description (optional)").fill("Papers to understand, **slowly**.");
    await page.getByRole("button", { name: "Create shelf" }).click();
    await expect(page).toHaveURL(/\/library\/shelves\/[0-9a-f-]{36}\?saved=created$/);
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(page.locator("strong", { hasText: "slowly" })).toBeVisible();
    await expect(page.getByText("No papers on this shelf yet.")).toBeVisible();
    const shelf = new URL(page.url()).pathname;

    for (const [words, title] of [
      ["attention", ATTENTION],
      ["superconformal", LARGE],
      ["thermochemistry", BECKE],
    ] as const) {
      await page.getByLabel("Search your papers").fill(words);
      await page.getByRole("button", { name: "Search", exact: true }).click();
      await page.getByRole("button", { name: `Add ${title}`, exact: true }).click();
      // The confirmation shows in the section the page returns to, in view.
      await expect(page.getByText("Added.", { exact: true })).toBeInViewport();
      // The same words still match that paper; the page says it is already here, not that nothing matches.
      if (title === LARGE) {
        await expect(page.getByText("Every paper in your library that matches these words is already on this shelf.")).toBeVisible();
        await expect(page.getByText("No paper in your library matches these words.")).toHaveCount(0);
      }
    }
    await expect.poll(() => listed(page)).toEqual([ATTENTION, LARGE, BECKE]);

    // Manual order, then newest first.
    await page.getByRole("button", { name: `Move up: ${BECKE}` }).click();
    await expect(page.getByText("Moved.", { exact: true })).toBeInViewport();
    await expect.poll(() => listed(page)).toEqual([ATTENTION, BECKE, LARGE]);
    await page.getByLabel("Order").selectOption("added");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect.poll(() => listed(page)).toEqual([BECKE, LARGE, ATTENTION]);
    await expect(page.getByRole("button", { name: /^Move (up|down)/ })).toHaveCount(0);

    // A note on one paper, search and a filter within the shelf.
    await page.goto(shelf);
    const large = page.locator("#papers ol > li").filter({ hasText: LARGE });
    await large.getByText("Edit note").click();
    await large.getByLabel(/^Note on this paper/).fill("Start here: $\\mathcal{N} = 4$ super Yang–Mills.");
    await large.getByRole("button", { name: `Save note for ${LARGE}` }).click();
    await expect(page.getByText("Note saved.")).toBeInViewport();
    await expect(page.locator("#papers ol > li").filter({ hasText: LARGE }).locator("math").first()).toBeVisible();
    await page.getByLabel("Search this shelf").fill("attention");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect.poll(() => listed(page)).toEqual([ATTENTION]);
    await page.goto(shelf);
    await page.getByLabel("Show").selectOption("read_later");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect.poll(() => listed(page)).toEqual([LARGE]);
    await noHorizontalScroll(page);
    await noSeriousAxeViolations(page, "shelf");
    await screenshot(page, "72-library-shelf");

    // Rename (a blank name is refused, in view); the paper page names the shelf.
    await page.goto(shelf);
    await page.getByLabel("Name", { exact: true }).fill("   ");
    await page.getByRole("button", { name: "Rename" }).click();
    await expect(page.getByText("Give it a name.")).toBeInViewport();
    await page.getByLabel("Name", { exact: true }).fill(`${name} renamed`);
    await page.getByRole("button", { name: "Rename" }).click();
    await expect(page.getByRole("heading", { level: 1, name: `${name} renamed` })).toBeVisible();
    await page.goto(paths.large);
    await expect(page.locator("#collections")).toContainText(`Shelf: ${name} renamed`);
    await expect(page.locator("#collections")).toContainText("Start here");

    // Removing a paper never deletes it, its notes or files.
    await page.goto(shelf);
    await page.getByRole("button", { name: `Remove ${ATTENTION} from ${name} renamed` }).click();
    await expect(page.getByText("Removed. The paper, its notes and files are still in your library.")).toBeInViewport();
    await expect.poll(() => listed(page)).toEqual([BECKE, LARGE]);
    expect((await page.goto(paths.attention))?.status()).toBe(200);
    await page.goto(`/notebook?library=1&work=${workId(paths.attention)}`);
    await expect(page.getByRole("region", { name: /^Library notes/ }).locator(":scope > ul > li")).toHaveCount(3);

    // Deleting asks for the box, then keeps the papers and their notes.
    await page.goto(shelf);
    await page.getByRole("button", { name: "Delete shelf" }).click();
    await expect(page.getByText("Tick the box to delete this shelf.")).toBeInViewport();
    await page.getByRole("checkbox", { name: /^Delete this shelf; its papers, notes and files are kept/ }).check();
    await page.getByRole("button", { name: "Delete shelf" }).click();
    await expect(page).toHaveURL(/\/library\/shelves\?deleted=1$/);
    await expect(page.getByText("Shelf deleted. Its papers, their notes and files are still in your library.")).toBeVisible();
    await expect(page.getByRole("link", { name: `${name} renamed` })).toHaveCount(0);
    await page.goto(`/notebook?library=1&work=${workId(paths.large)}`);
    await expect(
      page.getByRole("region", { name: /^Library notes/ }).getByRole("link", { name: `Why the coupling stays fixed ${run}`, exact: true }),
    ).toBeVisible();
    expect((await page.goto(shelf))?.status()).toBe(404);
  });

  test("a trail: description with maths and links, steps with reasons, the paper page's step and next paper", async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    const name = `Trail ${run} ${testInfo.project.name}`;
    await page.goto("/library");
    const home = page.getByRole("region", { name: "Shelves and trails" });
    await home.getByLabel("New").selectOption("trail");
    await home.getByLabel("Name").fill(name);
    await home.getByRole("button", { name: "Create" }).click();
    await expect(page).toHaveURL(/\/library\/trails\/[0-9a-f-]{36}\?saved=created$/);
    const trail = new URL(page.url()).pathname;
    // The same name again is refused on the home page's form, where the page lands.
    await page.goto("/library");
    await home.getByLabel("New").selectOption("trail");
    await home.getByLabel("Name").fill(name);
    await home.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText("You already have a trail with that name.")).toBeInViewport();
    // The refused form keeps what was typed (the redirect carries it; this also holds without JavaScript).
    await expect(home.getByLabel("Name")).toHaveValue(name);
    await expect(home.getByLabel("New")).toHaveValue("trail");
    await page.goto(trail);
    await page
      .getByLabel("Description", { exact: true })
      .fill(`From $\\mathcal{N} = 4$ to attention. Before it: [the attention paper](${paths.attention}). Background: ${LONG_URL}`);
    await page.getByRole("button", { name: "Save description" }).click();
    await expect(page.getByText("Description saved.")).toBeInViewport();
    const description = page.locator("section").filter({ has: page.getByRole("heading", { name: "Description", exact: true }) });
    await expect(description.locator("math").first()).toBeVisible();
    await expect(description.getByRole("link", { name: "the attention paper" })).toHaveAttribute("href", paths.attention);

    for (const [words, title, why] of [
      ["superconformal", LARGE, "The duality itself."],
      ["thermochemistry", BECKE, "A detour through density functionals."],
      ["attention", ATTENTION, "Where attention takes over."],
    ] as const) {
      await page.getByLabel("Search your papers").fill(words);
      await page.getByRole("button", { name: "Search", exact: true }).click();
      await page.getByLabel(`Why (optional) for ${title}`).fill(why);
      await page.getByRole("button", { name: `Add ${title}`, exact: true }).click();
      await expect(page.getByText("Added.", { exact: true })).toBeVisible();
    }
    await expect.poll(() => listed(page)).toEqual([LARGE, BECKE, ATTENTION]);
    await expect(page.locator("#papers ol > li").nth(1)).toContainText("Step 2");
    await expect(page.locator("#papers ol > li").nth(1)).toContainText("A detour through density functionals.");
    await page.getByRole("button", { name: `Move up: ${ATTENTION}` }).click();
    await expect.poll(() => listed(page)).toEqual([LARGE, ATTENTION, BECKE]);
    const becke = page.locator("#papers ol > li").filter({ hasText: BECKE });
    await becke.getByText("Edit why").click();
    await becke.getByLabel(/^Why this step/).fill("Density functionals, for contrast with $\\lambda$.");
    await becke.getByRole("button", { name: `Save why for ${BECKE}` }).click();
    await expect(page.getByText("Reason saved.")).toBeInViewport();
    await expect(page.locator("#papers ol > li").filter({ hasText: BECKE }).locator("math").first()).toBeVisible();
    await noHorizontalScroll(page);
    await noSeriousAxeViolations(page, "trail");
    await screenshot(page, "73-library-trail");

    // The paper page names the trail, the step and the next paper; following it walks the trail.
    await page.goto(paths.large);
    const collections = page.locator("#collections");
    await expect(collections).toContainText(`Trail: ${name}, step 1 of 3; next: ${ATTENTION}`);
    await collections.getByRole("link", { name: ATTENTION }).click();
    await expect(page).toHaveURL(new RegExp(`${paths.attention}$`));
    await expect(page.locator("#collections")).toContainText(`Trail: ${name}, step 2 of 3; next: ${BECKE}`);
    await page.locator("#collections").getByRole("link", { name: BECKE }).click();
    await expect(page).toHaveURL(new RegExp(`${paths.becke}$`));
    await expect(page.locator("#collections")).toContainText(`Trail: ${name}, step 3 of 3; the last step`);
    await page.locator("#collections").getByRole("link", { name }).click();
    await expect(page).toHaveURL(new RegExp(`${trail}$`));

    // The home page lists it with its number of steps.
    await page.goto("/library");
    await expect(page.getByRole("region", { name: "Shelves and trails" }).locator("li").filter({ hasText: name })).toContainText("3 steps");
  });

  test("the records export carries the library; the trail is then deleted behind its confirmation", async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const name = `Trail ${run} ${testInfo.project.name}`;
    await page.goto("/records");
    await page
      .locator("form", { has: page.locator('input[value="full"]') })
      .getByRole("button", { name: "Build" })
      .click();
    await expect(page.getByText("Export queued")).toBeVisible();
    const download = page.locator("li").filter({ hasText: "Everything (JSON) ·" }).first().getByRole("link", { name: "Download" });
    await expect(download).toBeVisible({ timeout: 90_000 });
    const response = await page.request.get((await download.getAttribute("href"))!);
    expect(response.status()).toBe(200);
    const bundle = (await response.json()) as {
      library: {
        works: { title: string; identifiers: { scheme: string; value: string }[] }[];
        collections: { kind: string; name: string; items: { title: string; reason: string | null }[] }[];
        readingPositions: { item: string; version: string | null; page: number }[];
      };
      annotations: {
        kind: string;
        colour: string | null;
        quote: string | null;
        version: { label: string } | null;
        work: { title: string } | null;
      }[];
    };
    const large = bundle.library.works.find((w) => w.title === LARGE);
    expect(large?.identifiers).toEqual(expect.arrayContaining([expect.objectContaining({ scheme: "arxiv", value: "hep-th/9711200" })]));
    const exported = bundle.library.collections.find((c) => c.name === name);
    expect(exported?.kind).toBe("trail");
    expect(exported?.items.map((i) => [i.title, i.reason])).toEqual([
      [LARGE, "The duality itself."],
      [ATTENTION, "Where attention takes over."],
      [BECKE, "Density functionals, for contrast with $\\lambda$."],
    ]);
    expect(bundle.library.readingPositions).toEqual(
      expect.arrayContaining([expect.objectContaining({ item: ATTENTION, page: 2, version: expect.stringMatching(/^arXiv v\d+$/) })]),
    );
    const highlight = bundle.annotations.find((a) => a.kind === "highlight" && a.work?.title === ATTENTION);
    expect(highlight).toMatchObject({ colour: "brass", version: { label: expect.stringMatching(/^arXiv v\d+$/) } });
    expect(highlight?.quote).toContain("Scaled dot-product attention");

    // A step with a reason leaves the trail only after the row asks (its reason goes with it); then the
    // trail goes; its papers stay.
    await page.goto("/library/trails");
    await page.getByRole("link", { name, exact: true }).click();
    await page.getByRole("button", { name: `Remove ${BECKE} from ${name}` }).click();
    await expect(page.getByText("Removing this step also deletes the reason you wrote for it.")).toBeInViewport();
    await expect.poll(() => listed(page)).toEqual([LARGE, ATTENTION, BECKE]);
    await page.getByRole("button", { name: `Remove and delete the reason for ${BECKE} on ${name}` }).click();
    await expect(page.getByText(/^Removed, with the reason for that step\./)).toBeInViewport();
    await expect.poll(() => listed(page)).toEqual([LARGE, ATTENTION]);
    await page.getByRole("checkbox", { name: /^Delete this trail; its papers, notes and files are kept/ }).check();
    await page.getByRole("button", { name: "Delete trail" }).click();
    await expect(page).toHaveURL(/\/library\/trails\?deleted=1$/);
    await expect(page.getByRole("link", { name, exact: true })).toHaveCount(0);
    await page.goto(paths.becke);
    await expect(page.getByRole("heading", { level: 1, name: BECKE })).toBeVisible();
    await expect(page.locator("#collections")).toContainText("Not on a shelf or trail.");

    // The journey's own paper note goes too, so no run leaves entries behind.
    await deleteJourneyNotes(page);
  });
});
