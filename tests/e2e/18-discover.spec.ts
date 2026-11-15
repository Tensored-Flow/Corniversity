import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import pg from "pg";
import { ownerEnv, screenshot, signInOrBootstrap, takeCourse } from "./helpers";
import { expectFixtureProviders } from "./scholarly";

/**
 * Discover in fixture mode (responses recorded once from OpenAlex and arXiv by
 * scripts/scholarly-record/discover.ts, labelled as fixture data): the lists say Not fetched yet
 * until the worker's jobs have filled the provider cache, then render with their source; subjects
 * are chosen with a checkbox form (none is a choice, with its own empty state); a subject room shows
 * the taxonomy's subfields and the lists in full; Surprise me shows one sampled review; saving two
 * papers from a list fills Cited by 2 or more of your papers and Similar to; a course's registry
 * sources appear under From your courses. A second browser without JavaScript checks that "Check
 * again" really reloads, that cached lists render without it (nothing left on "Loading"), and that
 * Save works without it; a failed Save shows its notice in the list it came from, in view.
 *
 * The journey needs the rehearsal database (E2E_DATABASE_URL, test data only) to start from a known
 * state: it clears the provider cache and the owner's Discover jobs and subjects, removes the two
 * papers it saves, and sets the owner's other saved papers aside (their references would change the
 * recorded Cited by request); afterwards it removes what it added and puts the others back.
 */

/** The two density-functional papers from Physics · Earlier work that share a reference (see the recording). */
const PAPER_A = "Development of the Colle-Salvetti correlation-energy formula into a functional of the electron density";
const PAPER_B = "Density-functional exchange-energy approximation with correct asymptotic behavior";
const SAVED_IDS = ["W2023271753", "W2086957099"];
const LISTS_TIMEOUT = 120_000;
const REFRESH_NOTE = "This page refreshes when the list arrives.";
const LOADING = "Loading from OpenAlex…";

let setAside: { id: string; saved_at: Date }[] = [];

async function withDb<T>(run: (db: pg.Client, ownerId: string) => Promise<T>): Promise<T> {
  const url = process.env.E2E_DATABASE_URL;
  if (!url) throw new Error("The Discover journey needs E2E_DATABASE_URL: the rehearsal database (test data only).");
  const parsed = new URL(url);
  if (!["127.0.0.1", "localhost"].includes(parsed.hostname) || parsed.pathname === "/corniversity_owner")
    throw new Error("E2E_DATABASE_URL must be a local rehearsal database, never the owner's installation.");
  const db = new pg.Client({ connectionString: url });
  await db.connect();
  try {
    const owner = await db.query<{ id: string }>(`select id from "user" where email = $1`, [ownerEnv().email]);
    if (!owner.rows[0]) throw new Error("The owner account does not exist yet; the setup project creates it.");
    return await run(db, owner.rows[0].id);
  } finally {
    await db.end();
  }
}

async function removeJourneyPapers(db: pg.Client, ownerId: string): Promise<void> {
  await db.query(
    `delete from scholarly_work where owner_id = $1 and id in
       (select work_id from scholarly_identifier where owner_id = $1 and scheme = 'openalex' and value = any($2))`,
    [ownerId, SAVED_IDS],
  );
}

test.describe("Discover", () => {
  test.beforeAll(async () => {
    await withDb(async (db, ownerId) => {
      // Discover's cached lists (the rehearsal cache holds nothing else) and this owner's refresh jobs and subjects.
      await db.query("delete from scholarly_cache.provider_cache");
      await db.query("delete from job_record where owner_id = $1 and idempotency_key like 'discover:%'", [ownerId]);
      await db.query("delete from library_preference where owner_id = $1", [ownerId]);
      await removeJourneyPapers(db, ownerId);
      const aside = await db.query<{ id: string; saved_at: Date }>(
        "update scholarly_work w set saved_at = null from scholarly_work old where w.id = old.id and w.owner_id = $1 and old.saved_at is not null returning w.id, old.saved_at",
        [ownerId],
      );
      setAside = aside.rows;
    });
  });

  test.afterAll(async () => {
    await withDb(async (db, ownerId) => {
      await removeJourneyPapers(db, ownerId);
      for (const row of setAside) await db.query("update scholarly_work set saved_at = $2 where id = $1", [row.id, row.saved_at]);
      await db.query("delete from library_preference where owner_id = $1", [ownerId]);
    });
  });

  test.beforeEach(async ({ page }) => {
    await signInOrBootstrap(page);
  });

  async function noHorizontalScroll(page: Page): Promise<void> {
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  }

  async function noSeriousAxeFindings(page: Page): Promise<void> {
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id} ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
  }

  test("lists arrive from the worker; subjects, a subject room, Surprise me, saving and courses", async ({
    page,
    request,
    browser,
    baseURL,
  }) => {
    test.setTimeout(480_000);
    await expectFixtureProviders(request);
    // The same owner in a browser without JavaScript.
    const nojsContext = await browser.newContext({
      baseURL,
      viewport: page.viewportSize(),
      isMobile: test.info().project.use.isMobile,
      storageState: await page.context().storageState(),
      javaScriptEnabled: false,
    });
    const nojs = await nojsContext.newPage();

    // Nothing is cached: the first view says so for every list and asks the worker to fetch them.
    // Without JavaScript nothing refreshes the page, so it does not say it does; "Check again" reloads.
    await nojs.goto("/library/discover");
    await expect(nojs.getByRole("heading", { level: 1, name: "Discover" })).toBeVisible();
    const nojsMaths = nojs.locator("#mathematics-most-cited");
    await expect(nojsMaths.getByText(/^Not fetched yet\./)).toBeVisible();
    await expect(nojs.getByText(REFRESH_NOTE)).toHaveCount(0);
    await screenshot(nojs, "18-discover-not-fetched-nojs");
    await expect(async () => {
      const again = nojsMaths.getByRole("link", { name: "Check again" });
      if (await again.isVisible()) await again.click();
      await expect(nojsMaths.getByRole("link", { name: "R: A Language and Environment for Statistical Computing" })).toBeVisible({
        timeout: 1_000,
      });
    }).toPass({ timeout: LISTS_TIMEOUT, intervals: [2_000] });

    await page.goto("/library/discover");
    await expect(page.getByRole("heading", { level: 1, name: "Discover" })).toBeVisible();
    const maths = page.locator("#mathematics-most-cited");
    // Empty states that are not failures.
    await expect(page.getByText("No work is cited by two or more of your saved papers yet.", { exact: false })).toBeVisible();
    await expect(page.getByText("Save a paper to see the works OpenAlex considers similar to it.")).toBeVisible();

    // The page refreshes itself until the worker's jobs have filled the cache.
    await expect(page.getByText(/^Not fetched yet\./)).toHaveCount(0, { timeout: LISTS_TIMEOUT });
    await expect(maths.getByRole("link", { name: "R: A Language and Environment for Statistical Computing" })).toBeVisible();
    await expect(maths.getByText("Cited by 356,000 works in OpenAlex")).toBeVisible();
    await expect(maths.getByText("Fixture data")).toBeVisible();
    await expect(maths.getByText(/recorded from OpenAlex on 2026-11-15/)).toBeVisible();
    await expect(maths.getByRole("listitem")).toHaveCount(5);
    const mathsArxiv = page.locator("#mathematics-new");
    await expect(mathsArxiv.getByText(/recorded from arXiv on 2026-11-15/)).toBeVisible();
    await expect(mathsArxiv.getByRole("listitem")).toHaveCount(5);
    await expect(mathsArxiv.getByText(/^Submitted to arXiv \d{4}-\d{2}-\d{2}/).first()).toBeVisible();
    await expect(page.locator("#physics-new").getByRole("listitem")).toHaveCount(5);
    await expect(
      page.locator("#artificial-intelligence-earlier").getByText("Maximum Likelihood from Incomplete Data Via the EM Algorithm"),
    ).toBeVisible();
    await noHorizontalScroll(page);
    await screenshot(page, "18-discover-lists");

    // A Save that fails (no recorded lookup for this paper) says so in the list it came from, in view, and only there.
    await maths.getByRole("button", { name: "Save R: A Language and Environment for Statistical Computing" }).click();
    await expect(page).toHaveURL(/at=mathematics-most-cited.*#mathematics-most-cited$/);
    const notSaved = maths.getByRole("alert");
    await expect(notSaved).toContainText("Not saved. No recorded provider response exists for this request (fixture mode)");
    await expect(notSaved).toBeInViewport();
    await expect(page.getByText(/No recorded provider response exists/)).toHaveCount(1);
    await expect(maths.getByRole("button", { name: "Save R: A Language and Environment for Statistical Computing" })).toBeVisible();

    // Surprise me: one sampled review from a field outside the owner's subjects, with its abstract.
    await page.getByRole("link", { name: "Surprise me" }).click();
    await expect(page).toHaveURL(/surprise=1/);
    const surprise = page.locator("#surprise");
    await expect(surprise.getByText(/A review in Health Professions, outside your subjects/)).toBeVisible();
    await expect(surprise.getByRole("link", { name: /^Laboratory approaches to determining blood culture contamination/ })).toBeVisible();
    await expect(surprise.getByText("Abstract, as indexed by OpenAlex")).toBeVisible();
    await expect(surprise.getByText("Fixture data")).toBeVisible();
    await surprise.getByRole("link", { name: "Another" }).click();
    await expect(page).toHaveURL(/surprise=2/);
    await expect(surprise.getByText(/A review in Decision Sciences, outside your subjects/)).toBeVisible();

    // Without JavaScript, what is cached renders at once: the lists and the surprise, nothing left loading.
    await nojs.goto("/library/discover?surprise=1");
    await expect(nojsMaths.getByRole("link", { name: "R: A Language and Environment for Statistical Computing" })).toBeVisible();
    await expect(
      nojs.locator("#surprise").getByRole("link", { name: /^Laboratory approaches to determining blood culture contamination/ }),
    ).toBeVisible();
    await expect(nojs.getByText(LOADING)).toHaveCount(0);

    // Choosing no subject is a choice with its own empty state.
    await page.goto("/library/discover");
    const subjects = page.getByRole("region", { name: "Your subjects" });
    await subjects.getByText("Choose subjects").click();
    for (const name of ["Mathematics", "Physics", "Computer science", "Artificial intelligence"])
      await subjects.getByLabel(name, { exact: true }).uncheck();
    await subjects.getByRole("button", { name: "Save subjects" }).click();
    await expect(page.getByText("Subjects saved.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "No subjects chosen" })).toBeVisible();
    await expect(subjects.getByText("None chosen.")).toBeVisible();

    // Artificial intelligence out, chemistry in: chemistry's lists are fetched, with no arXiv list.
    for (const name of ["Mathematics", "Physics", "Computer science", "Chemistry"])
      await subjects.getByLabel(name, { exact: true }).check();
    await subjects.getByRole("button", { name: "Save subjects" }).click();
    await expect(page.getByText("Subjects saved.")).toBeVisible();
    await expect(subjects.getByText("Mathematics, Physics, Computer science, Chemistry")).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Chemistry", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Artificial intelligence", exact: true })).toHaveCount(0);
    await expect(page.locator("#chemistry-new")).toHaveCount(0);
    // The page says it refreshes itself (it does, with JavaScript) until chemistry's lists arrive.
    await expect(page.locator("#chemistry-most-cited").getByText(REFRESH_NOTE)).toBeVisible();
    await expect(page.locator("#chemistry-most-cited").getByRole("link", { name: "CRC Handbook of Chemistry and Physics" })).toBeVisible({
      timeout: LISTS_TIMEOUT,
    });

    // The subject room: subfields from the taxonomy and the lists in full.
    await page.getByRole("link", { name: "Mathematics: subject room" }).click();
    await expect(page).toHaveURL(/\/library\/subjects\/mathematics$/);
    await expect(page.getByRole("heading", { level: 1, name: "Mathematics" })).toBeVisible();
    await expect(page.getByText("One of your subjects", { exact: false })).toBeVisible();
    const subfields = page.getByRole("region", { name: "Subfields" });
    await expect(subfields.getByText("Algebra and Number Theory")).toBeVisible();
    await expect(subfields.getByText("Fixture data")).toBeVisible();
    await expect(page.locator("#mathematics-most-cited").getByRole("listitem")).toHaveCount(10);
    await noHorizontalScroll(page);
    await noSeriousAxeFindings(page);
    await screenshot(page, "18-discover-subject-room");
    await page.goto("/library/subjects/artificial-intelligence");
    await expect(page.getByText("Not one of your subjects", { exact: false })).toBeVisible();
    await expect(page.getByText(/is an OpenAlex subfield/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Computer science", exact: true })).toBeVisible();
    // Without JavaScript the cached subfields render at once.
    await nojs.goto("/library/subjects/mathematics");
    await expect(nojs.getByRole("region", { name: "Subfields" }).getByText("Algebra and Number Theory")).toBeVisible();
    await expect(nojs.getByText(LOADING)).toHaveCount(0);

    // Save two papers from Physics · Earlier work, the second without JavaScript: they are marked, and
    // the lists that depend on them appear.
    await page.goto("/library/discover");
    const earlier = page.locator("#physics-earlier");
    await earlier.getByRole("button", { name: `Save ${PAPER_A}` }).click();
    await expect(page.getByText("Saved to your library.")).toBeVisible();
    await expect(earlier.getByRole("listitem").filter({ hasText: PAPER_A }).getByText("In your library")).toBeVisible();
    await nojs.goto("/library/discover");
    const nojsEarlier = nojs.locator("#physics-earlier");
    await nojsEarlier.getByRole("button", { name: `Save ${PAPER_B}` }).click();
    await expect(nojs.getByText("Saved to your library.")).toBeVisible();
    await expect(nojsEarlier.getByRole("listitem").filter({ hasText: PAPER_B }).getByText("In your library")).toBeVisible();
    // The lists that depend on the new paper were fetched while that page loaded (a fetch still
    // running when the page is sent leaves, without JavaScript, a placeholder that says to reload);
    // reloaded, they render from the cache.
    await nojs.reload();
    await expect(nojs.locator("#cited-by-yours").getByRole("link", { name: "Roothaan-Hartree-Fock atomic wavefunctions" })).toBeVisible();
    await expect(nojs.locator("#similar").getByRole("heading", { name: `Similar to ${PAPER_B}` })).toBeVisible();
    await expect(nojs.getByText(LOADING)).toHaveCount(0);
    await nojsContext.close();

    await page.goto("/library/discover");
    await expect(earlier.getByRole("listitem").filter({ hasText: PAPER_B }).getByText("In your library")).toBeVisible();
    const cited = page.locator("#cited-by-yours");
    await expect(cited.getByRole("link", { name: "Roothaan-Hartree-Fock atomic wavefunctions" })).toBeVisible();
    await expect(cited.getByText("Cited by 2 papers in your library")).toBeVisible();
    const similar = page.locator("#similar");
    await expect(similar.getByRole("heading", { name: `Similar to ${PAPER_B}` })).toBeVisible();
    await expect(similar.getByText(/similarity, not a citation/)).toBeVisible();
    expect(await similar.getByRole("listitem").count()).toBeGreaterThan(0);

    // From your courses: registry sources of a course taken, read-only (no Save).
    await takeCourse(page, "COG-250");
    await page.goto("/library/discover");
    const courses = page.locator("#from-courses");
    await expect(
      courses.getByRole("link", { name: "Model-based influences on humans' choices and striatal prediction errors" }),
    ).toBeVisible();
    await expect(courses.getByText(/COG-250 Planning and Structured Cognition/).first()).toBeVisible();
    await expect(courses.getByRole("button", { name: /^Save/ })).toHaveCount(0);

    await noHorizontalScroll(page);
    await noSeriousAxeFindings(page);
    await screenshot(page, "18-discover-saved");
  });
});
