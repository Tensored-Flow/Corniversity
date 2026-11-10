import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { signInOrBootstrap } from "./helpers";

/**
 * Automated accessibility pass (WCAG 2.2 A/AA rules that axe can check) over the main surfaces
 * at both viewports. Serious and critical violations fail the run; lesser findings are printed
 * for the Milestone 7 repair list. This checks the relevant criteria; it is not a certification.
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
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
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
