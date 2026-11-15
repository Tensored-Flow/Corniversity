import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page, test } from "@playwright/test";
import pg from "pg";
import { ownerEnv, signInOrBootstrap, takeCourse } from "./helpers";
import { makePdf, makePdfWithOutline } from "./pdf";
import { expectFixtureProviders } from "./scholarly";

/**
 * Automated accessibility pass (WCAG 2.2 A/AA rules that axe can check) over the main surfaces
 * at both viewports. Serious and critical violations fail the run; lesser findings are printed
 * for the Milestone 7 repair list. This checks the relevant criteria; it is not a certification.
 *
 * The research library (contract docs/RESEARCH_LIBRARY.md §2, §7, §8) is checked in both themes:
 * every Library page (each address checked to show its own page, not a redirect), a notebook entry,
 * and the reader with each panel, the Text view, the phone's Panels dialog, the selection bar and the
 * companion's permission form. Beyond axe it checks by hand what axe cannot: the reader by keyboard
 * on the desktop (the bar's controls and links, Contents, Find, Notes, Paper, Ask and Send, the
 * selection bar reached by Tab from the pages, Hide panel, Full screen) with a visible focus ring at
 * each stop; focus moving into a panel and back out of a dialog (Escape closes it); focus going to the
 * page a Contents entry opens and staying where the owner puts it afterwards; focus kept when a note or
 * a decision replaces the control that made it; the Page view without JavaScript; touch targets of at
 * least 24 × 24 CSS pixels on the phone (reader, shelves, trails, notebook, records); named navigation
 * landmarks; and transitions switched off under reduced motion. Selecting text in a PDF needs a pointer
 * or the browser's caret browsing (F7); the keyboard alternative to a highlight is a page note, and
 * Mark area needs a pointer.
 *
 * Its paper is OpenAlex W2117847125 (recorded, with a recorded Crossref retraction notice), which no
 * other journey uses; a generated PDF with an outline is attached as the owner's copy and extracted
 * by the stack's worker, and a generated PDF is uploaded as a file of its own for the item page. Its
 * preview is of W4413840294, recorded and saved by no journey. Everything is named by run and project
 * and deleted at the end; the stack must be in fixture mode, and E2E_DATABASE_URL (test data only)
 * removes what a failed run left.
 */
const PAGES = [
  "/campus",
  "/catalogue",
  "/courses/MAT-230",
  "/courses/MAT-230/units/MAT-230-u01",
  "/library",
  "/library/sync",
  "/notebook",
  "/records",
  "/settings",
  "/common-room",
  "/timetable",
  "/campus/map",
  "/programmes/mind-and-computation",
  "/programmes/mind-and-computation/blocks/MBI-09",
  "/studio",
  "/studies",
  "/visuals/lif-membrane-potential",
  "/courses/NEU-220/prepare",
  "/bridges/metric-spaces",
  "/operations",
  "/proposals",
];

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test.describe("accessibility (axe)", () => {
  test("the skip link reaches the content, and every place on the campus map opens a real page", async ({ page }) => {
    test.setTimeout(120_000);
    await signInOrBootstrap(page);
    await page.goto("/campus");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main$/);
    await expect(page.locator("main#main")).toHaveCount(1);

    await page.goto("/campus/map");
    const listed = await page
      .getByRole("navigation", { name: "Places on the campus" })
      .getByRole("link")
      .evaluateAll((links) => links.map((a) => a.getAttribute("href")));
    const drawn = await page.locator("svg a").evaluateAll((links) => links.map((a) => a.getAttribute("href")));
    // The list is the drawing's equivalent: the same places, lecture and tutorial rooms among them.
    expect([...listed].sort()).toEqual([...drawn].sort());
    expect(listed).toContain("/timetable");
    for (const href of listed) {
      const response = await page.request.get(href!);
      expect(response.status(), href!).toBe(200);
      expect(response.url(), href!).not.toContain("/sign-in");
    }
  });

  test("no serious or critical WCAG violations on the main pages", async ({ page }) => {
    test.setTimeout(240_000);
    await signInOrBootstrap(page);
    const report: string[] = [];
    for (const path of PAGES) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      for (const v of results.violations)
        report.push(
          `${path} · ${v.impact} · ${v.id}: ${v.help} (${v.nodes.length} node${v.nodes.length === 1 ? "" : "s"}) ${v.nodes[0]?.target.join(" ") ?? ""}`,
        );
      expect(serious, `${path}: ${serious.map((v) => `${v.id} ${v.nodes[0]?.target.join(" ")}`).join("; ")}`).toEqual([]);
    }
    console.log(report.length ? `axe findings (minor/moderate):\n${report.join("\n")}` : "axe: no violations on the listed pages");
  });
});

const run = Date.now().toString(36);
const PREFIX = "A11y 08";
const PAPER = "W2117847125";
const BOX = "DOI, arXiv id, OpenAlex id, a link to one of them, or words";
const FIRST_LINE = "The first page of the test text.";
const compact = (page: Page) => (page.viewportSize()?.width ?? 1440) <= 640 || (page.viewportSize()?.height ?? 900) <= 500;
/**
 * The paper page, its shelf and trail pages, the reader's Document of the owner's copy, the item page of
 * an uploaded file that belongs to no paper, and a notebook entry's page, shared by the serial steps.
 */
const state = { paper: "", shelf: "", trail: "", copy: "", item: "", entry: "" };
/** A recorded OpenAlex work that no journey saves, so its address shows the preview (a saved paper's goes to its paper page). */
const PREVIEW = "/library/works/openalex/W4413840294";

/** Runs SQL on the rehearsal database (test data only), refusing anything that is not a local rehearsal database. */
async function withDb<T>(work: (db: pg.Client, ownerId: string) => Promise<T>): Promise<T> {
  const url = process.env.E2E_DATABASE_URL;
  if (!url) throw new Error("Journey 08's research-library part needs E2E_DATABASE_URL: the rehearsal database (test data only).");
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

async function find(page: Page, text: string): Promise<void> {
  await page.goto("/library/find");
  await page.getByLabel(BOX).fill(text);
  await page.getByRole("button", { name: "Find", exact: true }).click();
  await page.waitForLoadState("domcontentloaded");
}

async function deletePaper(page: Page): Promise<void> {
  await page.getByRole("link", { name: "Delete this paper and its notes…" }).click();
  await page.getByRole("checkbox", { name: "Delete this paper and its notes" }).check();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page).toHaveURL(/\/library\/find\?deleted=paper/);
}

/** Serious or critical axe findings on the page as it stands. */
async function seriousAxe(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

async function readerReady(page: Page): Promise<void> {
  await expect(page.getByRole("region", { name: /^Pages of / })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByLabel("Page", { exact: true })).toBeEnabled({ timeout: 30_000 });
}

/** A reader panel: the aside on desktop, the Panels dialog on phones. */
async function openPanel(page: Page, name: string): Promise<Locator> {
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

/** Selects one line of the copy's text layer, as a pointer's drag would. */
async function selectLine(page: Page, pageNumber: number, text: string): Promise<void> {
  const span = page.locator(`.page[data-page-number="${pageNumber}"] .textLayer span`, { hasText: text }).first();
  await expect(span).toBeAttached({ timeout: 30_000 });
  await span.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
  });
  await expect(page.getByRole("toolbar", { name: "Selected text" })).toBeVisible();
}

/** The last line of each page of the owner's copy (see the setup step). */
const LAST_LINES = [FIRST_LINE, "The second page of the test text.", "The word accessible appears only on this page."];

/** Selects a line on the page in view (a page scrolled out of view has no laid-out text to select). */
async function selectInView(page: Page): Promise<void> {
  const shown = Number(await page.getByLabel("Page", { exact: true }).inputValue());
  await selectLine(page, shown, LAST_LINES[shown - 1]!);
}

/** Presses Tab until `target` has focus (at most `max` times): it is reachable by keyboard, in this order. */
async function tabTo(page: Page, target: Locator, max = 60): Promise<void> {
  for (let i = 0; i < max; i++) {
    if (await target.evaluate((el) => el === document.activeElement).catch(() => false)) return;
    await page.keyboard.press("Tab");
  }
  await expect(target).toBeFocused();
}

/** The focused element draws the 2 px focus ring. */
async function focusRingShown(page: Page): Promise<void> {
  const ring = await page.evaluate(() => {
    const style = getComputedStyle(document.activeElement!);
    return { style: style.outlineStyle, width: style.outlineWidth };
  });
  expect(ring).toEqual({ style: "solid", width: "2px" });
}

/**
 * Arms a watch on page `n`'s text layer through its next redraw, and returns a wait for it. PDF.js hides a
 * page's text layer while it redraws the page and shows it again just before it reports the page's text
 * rendered; the wait ends a task after that, so whatever PDF.js does on that report (such as moving focus)
 * has happened.
 */
async function watchRedraw(page: Page, n: number): Promise<() => Promise<void>> {
  await page.evaluate((pageNumber) => {
    const layer = document.querySelector(`.page[data-page-number="${pageNumber}"] .textLayer`);
    if (!layer) throw new Error(`Page ${pageNumber} has no text layer to watch.`);
    const flag = window as unknown as { __redrawn?: boolean };
    flag.__redrawn = false;
    let hidden = false;
    const observer = new MutationObserver((records) => {
      if (records.some((r) => r.oldValue === null)) hidden = true;
      if (hidden && !layer.hasAttribute("hidden")) {
        observer.disconnect();
        setTimeout(() => {
          flag.__redrawn = true;
        }, 0);
      }
    });
    observer.observe(layer, { attributes: true, attributeFilter: ["hidden"], attributeOldValue: true });
  }, n);
  return () =>
    expect
      .poll(() => page.evaluate(() => (window as unknown as { __redrawn?: boolean }).__redrawn), {
        message: `page ${n} redrawn`,
        timeout: 15_000,
      })
      .toBe(true);
}

/**
 * Controls smaller than 24 × 24 CSS pixels (WCAG 2.5.8) inside `scope`. A radio or checkbox counts by
 * its label; a link inside a sentence is exempt (WCAG's inline exception), and so is the PDF's own
 * content (its link annotations are where the paper put them).
 */
async function smallTargets(scope: Locator): Promise<string[]> {
  return scope.evaluate((root) => {
    const small: string[] = [];
    const selector = "a[href], button, input:not([type=hidden]), select, textarea, summary, [tabindex]:not([tabindex='-1'])";
    for (const el of root.querySelectorAll<HTMLElement>(selector)) {
      if (el.closest(".pdfViewer")) continue;
      const style = getComputedStyle(el);
      let box = el.getBoundingClientRect();
      if ((box.width === 0 && box.height === 0) || style.visibility === "hidden") continue;
      if (el instanceof HTMLInputElement && (el.type === "radio" || el.type === "checkbox")) {
        const label = el.closest("label") ?? (el.id ? document.querySelector(`label[for="${el.id}"]`) : null);
        if (label) box = label.getBoundingClientRect();
      }
      if (el.tagName === "A" && style.display === "inline") {
        const own = el.textContent?.trim().length ?? 0;
        const around = el.parentElement?.textContent?.trim().length ?? 0;
        if (around > own) continue;
      }
      if (box.width < 24 || box.height < 24) {
        const name = (el.getAttribute("aria-label") ?? el.textContent ?? el.getAttribute("name") ?? "").trim().slice(0, 40);
        small.push(`${el.tagName.toLowerCase()} "${name}" ${Math.round(box.width)}×${Math.round(box.height)}`);
      }
    }
    return small;
  });
}

test.describe("research library accessibility", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(async ({ page, request }) => {
    await expectFixtureProviders(request);
    await signInOrBootstrap(page);
  });

  test("setup: a saved paper on a shelf and a trail, with its own copy extracted, a tagged note and a course", async ({
    page,
  }, testInfo) => {
    test.setTimeout(300_000);
    const name = (what: string) => `${PREFIX} ${what} ${run} ${testInfo.project.name}`;
    await withDb(async (db, ownerId) => {
      await db.query("delete from library_collection where owner_id = $1 and name like $2", [ownerId, `${PREFIX} %`]);
      await db.query("delete from notebook_entry where owner_id = $1 and title like $2", [ownerId, `${PREFIX} %`]);
    });
    await find(page, PAPER);
    if (/\/library\/papers\//.test(page.url())) await deletePaper(page);
    await find(page, PAPER);
    await expect(page).toHaveURL(new RegExp(`/library/works/openalex/${PAPER}$`));
    await page.getByRole("button", { name: "Save to library" }).click();
    await expect(page).toHaveURL(/\/library\/papers\/[0-9a-f-]{36}$/);
    state.paper = new URL(page.url()).pathname;

    for (const kind of ["shelf", "trail"] as const) {
      const collections = page.locator("#collections");
      await collections.getByLabel("New").selectOption(kind);
      await collections.getByLabel("Name").fill(name(kind));
      await collections.getByLabel("Why (optional)").last().fill(`Kept here to check the ${kind} page, with $x^2$.`);
      await collections.getByRole("button", { name: "Create and add" }).click();
      await expect(page.locator("#collections")).toContainText(name(kind));
      state[kind] = (await page
        .locator("#collections")
        .getByRole("link", { name: name(kind) })
        .getAttribute("href"))!;
    }

    // The owner's copy (a generated PDF with an outline; its text says what it is), extracted here.
    const pdf = makePdfWithOutline(
      [
        `Generated test PDF attached as the owner's copy (journey 08, ${run}, ${testInfo.project.name}). Not the paper.\nFirst section\n${FIRST_LINE}`,
        "Second section\nThe second page of the test text.",
        "Third section\nThe word accessible appears only on this page.",
      ],
      [
        { title: "First section", page: 1 },
        { title: "Second section", page: 2 },
        { title: "Third section", page: 3 },
      ],
    );
    await page.getByLabel(/^PDF of your copy/).setInputFiles({ name: `a11y-${run}.pdf`, mimeType: "application/pdf", buffer: pdf });
    await page.getByRole("button", { name: "Attach", exact: true }).click();
    await expect(page.getByText("Your copy is attached and can be read here.")).toBeVisible();
    const file = () =>
      page
        .locator("#files li")
        .filter({ has: page.getByRole("heading", { name: "Your copy" }) })
        .first();
    state.copy = (await file().getByRole("link", { name: "Read this file" }).getAttribute("href"))!.split("/").pop()!;
    await file().getByText("Permissions and removal").click();
    const extract = file().locator("li", { hasText: "Extract and index the text" });
    await extract.getByLabel("Basis for Extract and index the text").fill("a generated test file");
    await extract.getByRole("button", { name: "Allow" }).click();
    await file().getByRole("button", { name: "Extract and index" }).click();
    await expect(async () => {
      await page.reload();
      await expect(file().getByText("Ready", { exact: true })).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 120_000, intervals: [2_000] });

    // A tagged notebook entry and a course taken, so the notebook's Tags and Courses navigation shows.
    await page.goto("/notebook");
    await page.getByLabel("Title").fill(name("tagged note"));
    await page.getByLabel("Tags (comma or space separated)").fill("a11y");
    await page.getByLabel("Body (Markdown with LaTeX)").fill("A note with a tag, for the navigation check.");
    await page.getByRole("button", { name: "Save entry" }).click();
    await expect(page.getByText(name("tagged note")).first()).toBeVisible();
    // Saving opens the entry's own page.
    await expect(page).toHaveURL(/\/notebook\/[0-9a-f-]{36}$/);
    state.entry = new URL(page.url()).pathname;
    await takeCourse(page, "MAT-230");

    // A file of the owner's own that belongs to no paper, for its item page (unique bytes per run, since
    // identical content is deduplicated onto an earlier upload).
    await page.goto("/library/upload");
    await page.getByLabel(/^File/).setInputFiles({
      name: `a11y-file-${run}.pdf`,
      mimeType: "application/pdf",
      buffer: makePdf([`Generated test file (journey 08, ${run}, ${testInfo.project.name}).`], false),
    });
    await page.getByRole("button", { name: /upload to quarantine/i }).click();
    await expect(page).toHaveURL(/\/library\/items\/[0-9a-f-]{36}\?saved=uploaded$/, { timeout: 30_000 });
    state.item = new URL(page.url()).pathname;
  });

  test("axe finds nothing serious on the research library and the reader, in light and dark", async ({ page, baseURL }) => {
    test.setTimeout(480_000);
    const host = new URL(baseURL!).hostname;
    const failures: string[] = [];
    const check = async (label: string) => {
      const found = await seriousAxe(page);
      if (found.length) failures.push(`${label}: ${found.join("; ")}`);
    };
    // A page note for the Notes panel, on the copy (deleted with the paper at the end).
    await page.goto(`/library/read/${state.copy}`);
    await readerReady(page);
    const notes = await openPanel(page, "Notes");
    await notes.getByRole("button", { name: "Page note", exact: true }).click();
    await notes.getByLabel("Note", { exact: true }).fill("A page note with $\\sum_i x_i$ for the accessibility check.");
    await notes.getByRole("button", { name: "Save note", exact: true }).click();
    await expect(notes.locator("math").first()).toBeVisible();
    await closePanel(page);

    for (const theme of ["light", "dark"] as const) {
      await page.context().addCookies([{ name: "corniversity-theme", value: theme, domain: host, path: "/" }]);
      const pages = [
        "/library",
        "/library/find?q=direct+preference+optimization",
        PREVIEW,
        state.paper,
        "/library/papers/new",
        "/library/discover",
        "/library/subjects/mathematics",
        "/library/shelves",
        state.shelf,
        "/library/trails",
        state.trail,
        `/notebook?library=1&work=${state.paper.split("/").pop()}`,
        "/notebook",
        "/library/sources",
        "/library/requests",
        "/library/upload",
        state.item,
        "/library/sync",
        "/library/jobs",
        state.entry,
        "/records",
        `/library/read/${state.copy}?view=text&page=1`,
      ];
      for (const path of pages) {
        await page.goto(path);
        // Streamed parts (the paper page's lists, Discover's cross-subject lists) arrive before axe looks.
        await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
        await expect(page.getByText(/^Loading from OpenAlex/)).toHaveCount(0, { timeout: 30_000 });
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        // Each address shows the page it names: no redirect (a saved paper's preview goes to its paper page).
        expect(new URL(page.url()).pathname, path).toBe(path.split("?")[0]);
        await check(`${theme} ${path}`);
      }
      // The Text view's Ask, opened.
      await page.locator("details#ask > summary").click();
      await check(`${theme} Text view with Ask open`);

      // The Page view with each panel open (on the phone: the Panels dialog), the selection bar, and the
      // companion's permission form (external AI not decided on this copy).
      await page.goto(`/library/read/${state.copy}`);
      await readerReady(page);
      for (const name of ["Contents", "Find", "Notes", "Paper", "Ask"]) {
        const panel = await openPanel(page, name);
        if (name === "Find") {
          await panel.getByLabel("Find in this PDF").fill("accessible");
          await panel.getByLabel("Find in this PDF").press("Enter");
          await expect(panel.getByRole("status")).toHaveText(/^1 of 1 match/);
        }
        if (name === "Ask") await expect(panel.getByRole("heading", { name: "External AI: not decided" })).toBeVisible();
        await check(`${theme} reader, ${name} ${compact(page) ? "dialog" : "panel"}`);
        await closePanel(page);
      }
      // Find left page 3 in view: a line there is selected (a page out of view has no laid-out text).
      await selectLine(page, 3, "The word accessible appears");
      await check(`${theme} reader, selection bar`);
      await page.getByRole("toolbar", { name: "Selected text" }).getByRole("button", { name: "Clear" }).click();
      if (!compact(page)) {
        await page.getByRole("button", { name: "Hide panel" }).click();
        await check(`${theme} reader, panel hidden`);
        await page.getByRole("button", { name: "Show panel" }).click();
      }
    }
    await page.context().addCookies([{ name: "corniversity-theme", value: "light", domain: host, path: "/" }]);
    expect(failures).toEqual([]);
  });

  test("the reader by keyboard: pages, zoom, contents, find, notes, paper, Ask and the bar's links, with a visible focus ring", async ({
    page,
  }) => {
    test.skip(compact(page), "The phone's bar puts the panels in a dialog; its keyboard and focus behaviour has its own test below.");
    test.setTimeout(240_000);
    await page.goto(`/library/read/${state.copy}`);
    await readerReady(page);
    const pageBox = page.getByLabel("Page", { exact: true });
    const pages = page.getByRole("region", { name: /^Pages of / });

    // The skip link reaches the pages; Home and End page through them.
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to the pages" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(pages).toBeFocused();
    await focusRingShown(page);
    await page.keyboard.press("End");
    await expect(pageBox).toHaveValue("3");
    await page.keyboard.press("Home");
    await expect(pageBox).toHaveValue("1");

    // The bar: next and previous page, go to a page, zoom, each reachable by Tab with its ring.
    const next = page.getByRole("button", { name: "Next page" });
    await page.getByRole("link", { name: "Back to paper" }).focus();
    await tabTo(page, next);
    await focusRingShown(page);
    await page.keyboard.press("Enter");
    await expect(pageBox).toHaveValue("2");
    await page.keyboard.press("Shift+Tab");
    await expect(pageBox).toBeFocused();
    await focusRingShown(page);
    await page.keyboard.press("Control+A");
    await page.keyboard.type("3");
    await page.keyboard.press("Enter");
    await expect(pageBox).toHaveValue("3");
    await page.keyboard.press("Shift+Tab");
    await expect(page.getByRole("button", { name: "Previous page" })).toBeFocused();
    await focusRingShown(page);
    await page.keyboard.press("Enter");
    await expect(pageBox).toHaveValue("2");
    const zoom = page.getByLabel("Zoom");
    await tabTo(page, zoom);
    await focusRingShown(page);
    await page.keyboard.press("ArrowDown");
    await expect(zoom).toHaveValue("page-fit");
    await page.keyboard.press("ArrowUp");
    await expect(zoom).toHaveValue("page-width");

    // Contents: the button opens the panel and moves focus into it; an entry is followed by keyboard, and
    // focus goes to the page it opens (PDF.js focuses that page's text).
    await tabTo(page, page.getByRole("button", { name: "Contents", exact: true }));
    await focusRingShown(page);
    await page.keyboard.press("Enter");
    const contents = page.getByRole("complementary", { name: "Contents" });
    await expect(contents.getByRole("heading", { name: "Contents", exact: true })).toBeFocused();
    const firstSection = contents.getByRole("button", { name: "First section" });
    await tabTo(page, firstSection, 5);
    await focusRingShown(page);
    await page.keyboard.press("Enter");
    await expect(pageBox).toHaveValue("1");
    const firstPageText = page.locator('.page[data-page-number="1"] .textLayer');
    await expect(firstPageText).toBeFocused();
    // The entry again, for a page already drawn: focus moves to it at once, as for a page drawn after the
    // jump, and a later zoom change by keyboard leaves focus on Zoom. (PDF.js on its own focuses the
    // destination only when that page next redraws, so a page already drawn took focus from Zoom, or from
    // Hide panel, into the pages at the next redraw.) Zoom is focused directly here: Tab from the page's text
    // passes through the later pages' text and scrolls page 1 out of view, and Zoom's place in the tab order
    // is checked above.
    await tabTo(page, firstSection);
    await page.keyboard.press("Enter");
    await expect(pageBox).toHaveValue("1");
    await expect(firstPageText).toBeFocused();
    await zoom.focus();
    const redrawn = await watchRedraw(page, 1);
    await page.keyboard.press("ArrowDown");
    await expect(zoom).toHaveValue("page-fit");
    await redrawn();
    await expect(zoom).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(zoom).toHaveValue("page-width");
    await expect(zoom).toBeFocused();

    // Find: focus lands in its box; Enter finds.
    await tabTo(page, page.getByRole("button", { name: "Find", exact: true }));
    await focusRingShown(page);
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Find in this PDF")).toBeFocused();
    await page.keyboard.type("accessible");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("complementary", { name: "Find" }).getByRole("status")).toHaveText(/^1 of 1 match/);
    await expect(pageBox).toHaveValue("3");

    // Notes: bookmark the page, write a page note, go to it, edit and delete it; focus never falls out of the panel.
    await tabTo(page, page.getByRole("button", { name: "Notes", exact: true }));
    await focusRingShown(page);
    await page.keyboard.press("Enter");
    const notes = page.getByRole("complementary", { name: "Notes" });
    await expect(notes.getByRole("heading", { name: "Notes", exact: true })).toBeFocused();
    await tabTo(page, notes.getByRole("button", { name: "Bookmark page", exact: true }), 5);
    await focusRingShown(page);
    await page.keyboard.press("Enter");
    await expect(notes.getByRole("button", { name: "Remove bookmark", exact: true })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(notes.getByRole("button", { name: "Bookmark page", exact: true })).toBeFocused();
    await tabTo(page, notes.getByRole("button", { name: "Page note", exact: true }), 5);
    await focusRingShown(page);
    await page.keyboard.press("Enter");
    await expect(notes.getByLabel("Note", { exact: true })).toBeFocused();
    await page.keyboard.type("Written by keyboard.");
    await tabTo(page, notes.getByRole("button", { name: "Save note", exact: true }), 5);
    await focusRingShown(page);
    await page.keyboard.press("Enter");
    const written = notes.locator("li", { hasText: "Written by keyboard." });
    await expect(written).toBeVisible();
    await expect(notes.getByRole("heading", { name: /^All notes \(\d+\)$/ })).toBeFocused();
    // Go to reopens the note's page (page 3) from another page.
    await pageBox.fill("1");
    await pageBox.press("Enter");
    await expect(pageBox).toHaveValue("1");
    await tabTo(page, written.getByRole("button", { name: /^Go to / }));
    await focusRingShown(page);
    await page.keyboard.press("Enter");
    await expect(pageBox).toHaveValue("3");
    await tabTo(page, written.getByRole("button", { name: /^Edit page note/ }));
    await focusRingShown(page);
    await page.keyboard.press("Enter");
    await expect(written.getByLabel("Note", { exact: true })).toBeFocused();
    await tabTo(page, written.getByRole("button", { name: "Cancel" }), 5);
    await page.keyboard.press("Enter");
    await expect(written.getByRole("button", { name: /^Edit page note/ })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(written.getByRole("button", { name: /^Delete page note/ })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(written.getByRole("button", { name: "Keep" })).toBeFocused();
    await focusRingShown(page);
    await page.keyboard.press("Enter");
    await expect(written.getByRole("button", { name: /^Delete page note/ })).toBeFocused();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Shift+Tab");
    await expect(written.getByRole("button", { name: "Delete", exact: true })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(written).toHaveCount(0);
    await expect(notes.getByRole("heading", { name: /^All notes \(\d+\)$/ })).toBeFocused();
    // Mark area needs a pointer; Escape cancels it.
    // From the list, Tab goes on through the page and round to the panel's first buttons.
    await tabTo(page, notes.getByRole("button", { name: "Mark area", exact: true }));
    await page.keyboard.press("Enter");
    await expect(page.getByText("Mark area: click one corner of the area on a page.")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByText("Mark area: click one corner of the area on a page.")).toHaveCount(0);

    // A selection (made with a pointer or caret browsing): the selection bar follows the pages in tab order,
    // so Tab from the pages reaches it. Highlight by keyboard: the bar goes, and focus returns to the pages
    // instead of being lost.
    await selectLine(page, 3, "The word accessible appears");
    await pages.focus();
    const highlight = page.getByRole("toolbar", { name: "Selected text" }).getByRole("button", { name: "Highlight" });
    await tabTo(page, highlight, 20);
    await focusRingShown(page);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("toolbar", { name: "Selected text" })).toBeHidden();
    await expect(page.locator('.page[data-page-number="3"] .reader-mark[data-kind="highlight"]')).toHaveCount(1);
    await expect(pages).toBeFocused();

    // Paper, then Ask: the decision is made by keyboard and focus stays in the panel.
    await tabTo(page, page.getByRole("button", { name: "Paper", exact: true }));
    await focusRingShown(page);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("complementary", { name: "Paper" }).getByRole("heading", { name: "Paper", exact: true })).toBeFocused();
    await tabTo(page, page.getByRole("button", { name: "Ask", exact: true }));
    await focusRingShown(page);
    await page.keyboard.press("Enter");
    const ask = page.getByRole("complementary", { name: "Ask" });
    await expect(ask.getByRole("heading", { name: "Ask", exact: true })).toBeFocused();
    await tabTo(page, ask.getByLabel("Basis"), 10);
    await page.keyboard.type("a generated test file");
    await tabTo(page, ask.getByRole("button", { name: "Allow external AI" }), 3);
    await focusRingShown(page);
    await page.keyboard.press("Enter");
    await expect(ask.getByRole("heading", { name: "External AI: allowed" })).toBeFocused();

    // A selection's Ask (reached by Tab from the pages) hands it to the panel, and focus goes to the chosen
    // action; Send by keyboard brings the labelled scripted answer, with focus still in the panel.
    await selectLine(page, 3, "The word accessible appears");
    await pages.focus();
    await tabTo(page, page.getByRole("toolbar", { name: "Selected text" }).getByRole("button", { name: "Ask", exact: true }), 20);
    await page.keyboard.press("Enter");
    await expect(ask.getByRole("radio", { checked: true })).toBeFocused();
    await tabTo(page, ask.getByRole("button", { name: "Send", exact: true }), 5);
    await focusRingShown(page);
    await page.keyboard.press("Enter");
    await expect(ask.getByRole("heading", { name: "Last answer" })).toBeVisible({ timeout: 60_000 });
    await expect(ask.getByText(/Scripted demo response: no model is configured/).first()).toBeVisible();
    expect(await ask.evaluate((panel) => panel.contains(document.activeElement))).toBe(true);

    // Hide panel and Show panel keep focus on the toggle.
    await tabTo(page, page.getByRole("button", { name: "Hide panel" }));
    await focusRingShown(page);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Show panel" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Hide panel" })).toBeFocused();

    // Full screen and back: the toggle keeps focus.
    await tabTo(page, page.getByRole("button", { name: "Full screen" }));
    await focusRingShown(page);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Exit full screen" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Full screen" })).toBeFocused();

    // The Text view and back to the pages, then Back to paper, each by keyboard.
    await tabTo(page, page.getByRole("link", { name: "Text view" }));
    await focusRingShown(page);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\?view=text&page=\d+$/);
    await tabTo(page, page.getByRole("link", { name: "Page view" }));
    await focusRingShown(page);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\?view=page&page=\d+$/);
    await readerReady(page);
    await tabTo(page, page.getByRole("link", { name: "Back to paper" }));
    await focusRingShown(page);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`${state.paper}$`));
  });

  test("the phone's Panels dialog: focus moves in, Escape and Close shut it, and focus returns to Panels", async ({ page }) => {
    test.skip(!compact(page), "The Panels dialog exists only on phones and short screens.");
    test.setTimeout(120_000);
    await page.goto(`/library/read/${state.copy}`);
    await readerReady(page);
    const panels = page.getByRole("button", { name: "Panels" });
    await tabTo(page, panels);
    await focusRingShown(page);
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(panels).toBeFocused();

    // Section switches inside the dialog, by keyboard; Close returns focus too.
    await page.keyboard.press("Enter");
    await tabTo(page, dialog.getByRole("button", { name: "Notes", exact: true }), 10);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: "Notes" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Notes", exact: true })).toHaveAttribute("aria-pressed", "true");
    await tabTo(page, dialog.getByRole("button", { name: "Bookmark page", exact: true }), 10);
    await page.keyboard.press("Enter");
    await expect(dialog.getByRole("button", { name: "Remove bookmark", exact: true })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(dialog.getByRole("button", { name: "Bookmark page", exact: true })).toBeFocused();
    await dialog.getByRole("button", { name: "Close" }).focus();
    await page.keyboard.press("Enter");
    await expect(dialog).toBeHidden();
    await expect(panels).toBeFocused();

    // A selection's Ask opens the dialog on the Ask panel with focus inside it. The selection bar that had
    // focus is gone by then, so Escape returns focus to Panels rather than to nothing.
    await selectInView(page);
    await page.getByRole("toolbar", { name: "Selected text" }).getByRole("button", { name: "Ask", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Ask" })).toBeVisible();
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(panels).toBeFocused();
  });

  test("without JavaScript the Page view says it needs it and offers the Text view, the original file and the way back", async ({
    browser,
    page,
    baseURL,
  }) => {
    // A context made here does not take the project's base URL, so addresses are absolute.
    const at = (path: string) => new URL(path, baseURL).href;
    const noScript = await browser.newContext({ javaScriptEnabled: false, storageState: await page.context().storageState() });
    try {
      const plain = await noScript.newPage();
      await plain.goto(at(`/library/read/${state.copy}?page=2`));
      await expect(plain.getByRole("heading", { name: "The Page view needs JavaScript" })).toBeVisible();
      // No loading status that never ends.
      await expect(plain.getByText("Loading the reader…")).toBeHidden();
      await expect(plain.getByRole("link", { name: "Back to paper" })).toHaveAttribute("href", state.paper);
      await expect(plain.getByRole("link", { name: "Open the original PDF" })).toHaveAttribute(
        "href",
        `/api/library/assets/${state.copy}/file#page=2`,
      );
      await plain.getByRole("link", { name: "Text view" }).click();
      await expect(plain).toHaveURL(at(`/library/read/${state.copy}?view=text&page=2`));
      await expect(plain.getByText("The second page of the test text.")).toBeVisible();
    } finally {
      await noScript.close();
    }
  });

  test("named navigation landmarks, and no transitions under reduced motion", async ({ page }) => {
    // Named navigation on the notebook (Kinds, Tags, Courses) and the library home.
    await page.goto("/notebook");
    for (const name of ["Notebook views", "Kinds", "Tags", "Courses"])
      await expect(page.getByRole("navigation", { name, exact: true })).toBeVisible();
    await page.goto("/library");
    for (const name of ["Primary", "Library sections", "Saved papers views"])
      await expect(page.getByRole("navigation", { name, exact: true })).toBeVisible();
    // Under reduced motion transitions finish at once (the side navigation's links fade their colour otherwise).
    await page.emulateMedia({ reducedMotion: "reduce" });
    const duration = await page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("link")
      .first()
      .evaluate((el) => Number.parseFloat(getComputedStyle(el).transitionDuration));
    expect(duration).toBeLessThan(0.01);
    // Without the preference the same link fades (so the check above is not vacuous).
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const normal = await page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("link")
      .first()
      .evaluate((el) => Number.parseFloat(getComputedStyle(el).transitionDuration));
    expect(normal).toBeGreaterThan(0.05);
  });

  test("touch targets on the phone are at least 24 × 24 CSS pixels in the reader, shelves, trails, notebook and records", async ({
    page,
  }) => {
    test.skip(!compact(page), "Touch targets are measured on the phone.");
    test.setTimeout(240_000);
    const report: string[] = [];
    const measure = async (label: string, scope: Locator) => {
      for (const small of await smallTargets(scope)) report.push(`${label}: ${small}`);
    };
    const work = state.paper.split("/").pop();
    for (const path of [
      state.shelf,
      state.trail,
      "/library/shelves",
      "/library/trails",
      `/notebook?library=1&work=${work}`,
      "/notebook",
      "/records",
    ]) {
      await page.goto(path);
      await measure(path, page.locator("body"));
    }
    await page.goto(`/library/read/${state.copy}?view=text&page=1`);
    await page.locator("details#ask > summary").click();
    await measure("Text view", page.locator("body"));
    await page.goto(`/library/read/${state.copy}`);
    await readerReady(page);
    await measure("reader bar", page.locator("header").first());
    for (const name of ["Contents", "Find", "Notes", "Paper", "Ask"]) {
      const panel = await openPanel(page, name);
      await measure(`Panels dialog, ${name}`, panel);
      await closePanel(page);
    }
    await selectInView(page);
    await measure("selection bar", page.getByRole("toolbar", { name: "Selected text" }));
    expect(report).toEqual([]);
  });

  test("clean up: the tagged note, the shelf, the trail, the uploaded file and the paper with its copy go", async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await page.goto(`/notebook?q=${encodeURIComponent(`${PREFIX} tagged note ${run} ${testInfo.project.name}`)}`);
    await page.locator("section[aria-labelledby=entries-heading] h3 a").first().click();
    await page.getByRole("checkbox", { name: "I want to delete this entry" }).check();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page).toHaveURL(/deleted=1/);
    for (const kind of ["shelf", "trail"] as const) {
      await page.goto(state[kind]);
      await page.getByRole("checkbox", { name: new RegExp(`^Delete this ${kind}; its papers, notes and files are kept`) }).check();
      await page.getByRole("button", { name: `Delete ${kind}` }).click();
      await expect(page).toHaveURL(/\?deleted=1$/);
    }
    await page.goto(state.item);
    await page.getByRole("checkbox", { name: "Delete the stored original, extracted text and index" }).check();
    await page.getByRole("button", { name: "Delete item" }).click();
    await expect(page).toHaveURL(/\/library\?deleted=1$/);
    await page.goto(state.paper);
    await deletePaper(page);
    expect((await page.goto(`/library/read/${state.copy}`))?.status()).toBe(404);
  });
});
