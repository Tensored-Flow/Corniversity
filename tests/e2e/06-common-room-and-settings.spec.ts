import { expect, test } from "@playwright/test";
import { screenshot, signInOrBootstrap } from "./helpers";

/**
 * Journey 8 and the settings surfaces.
 *
 * 8. An optional peer discussion runs for a bounded number of rounds, stays within released
 *    material (fixed at opening), can be muted, and creates no background messages: the room
 *    speaks only after the learner does, and a reload without a new turn adds nothing.
 *
 * Settings: the experience baseline can be changed after orientation; quiet mode removes the
 * social layer from navigation and the common room while every academic surface stays; the
 * live-tutoring limits save; the campus map lists every place it draws.
 */
test.describe.configure({ mode: "serial" });

const run = Date.now().toString(36);

async function setImmersion(page: import("@playwright/test").Page, immersion: "quiet" | "collegiate", social: boolean) {
  await page.goto("/settings");
  await page.locator(`input[name="immersion"][value="${immersion}"]`).check();
  const socialBox = page.locator('input[name="socialLayerEnabled"]');
  if (social) await socialBox.check();
  else await socialBox.uncheck();
  await page.locator("#experience").getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
}

test.describe("common room and settings", () => {
  test("journey 8: a bounded society discussion with two AI classmates closes at its limit and never speaks unprompted", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await signInOrBootstrap(page);
    await setImmersion(page, "collegiate", true);

    await page.goto("/common-room");
    await expect(page.getByRole("heading", { level: 1, name: /Societies, classmates and office hours/ })).toBeVisible();
    const society = page.locator("li", { hasText: "Mathematics Reading Room" }).first();
    await society.getByText("Open a discussion").click();
    await society.getByLabel("What do you want to discuss?").fill(`Does completeness of C([0,1]) depend on the norm? ${run}`);
    await society.getByLabel("Rounds").selectOption("2");
    const peerBoxes = society.locator('input[name="peers"]');
    await expect(peerBoxes.first()).toBeVisible();
    await peerBoxes.nth(0).check();
    await peerBoxes.nth(1).check();
    await society.getByRole("button", { name: "Open", exact: true }).click();
    await expect(page).toHaveURL(/\/common-room\//);
    await expect(page.getByText("round 0 of 2")).toBeVisible();
    await expect(page.getByText("Nobody has spoken yet")).toBeVisible();
    // Three AI participants: the chair and two classmates, all labelled.
    await expect(page.getByText("AI classmate · scripted demo")).toHaveCount(2);
    await screenshot(page, "32-discussion-open");

    await page
      .getByLabel(/Your turn/)
      .fill(
        "I think the sup norm makes C([0,1]) complete but the integral norm does not; is completeness really a property of the norm rather than the space?",
      );
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("round 1 of 2")).toBeVisible({ timeout: 60_000 });
    // Each AI turn is headed with what wrote it, apart from what its text says.
    const aiTurns = page.locator("ol > li").filter({ has: page.getByText(/ · Scripted demo$/) });
    await expect(aiTurns).toHaveCount(3);

    // Nothing happens while the learner is away: a reload adds no turns.
    await page.reload();
    await expect(page.locator("ol > li").filter({ has: page.getByText(/ · Scripted demo$/) })).toHaveCount(3);

    await page
      .getByLabel(/Your turn/)
      .fill(
        "Then the right statement is that completeness is a property of the normed space, and the two norms give two different normed spaces on the same set.",
      );
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText(/Closed after 2 rounds/).first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByLabel(/Your turn/)).toHaveCount(0);
    await screenshot(page, "33-discussion-closed");
  });

  test("a discussion can be muted, after which nobody speaks", async ({ page }) => {
    await signInOrBootstrap(page);
    await page.goto("/common-room");
    const office = page.locator("section", { has: page.getByRole("heading", { name: "Office hours", exact: true }) });
    await office.getByLabel("About").fill(`Office hours about norms ${run}`);
    await office.getByRole("button", { name: /open office hours/i }).click();
    await expect(page).toHaveURL(/\/common-room\//);
    await page.getByRole("button", { name: "Mute" }).click();
    await expect(page.getByText("You muted this discussion")).toBeVisible();
    await expect(page.getByLabel(/Your turn/)).toHaveCount(0);
  });

  test("quiet mode removes the social layer but not the academic surfaces", async ({ page }) => {
    await signInOrBootstrap(page);
    await setImmersion(page, "quiet", false);
    await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Common Room" })).toHaveCount(0);
    await page.goto("/common-room");
    await expect(page.getByText("Quiet mode", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Office hours", exact: true })).toBeVisible();
    await page.goto("/campus/map");
    await expect(page.getByRole("heading", { level: 1, name: "Map of the college" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Places on the campus" }).getByRole("link", { name: "Library" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Places on the campus" }).getByRole("link", { name: "Common Room" })).toHaveCount(0);
    await screenshot(page, "34-campus-map-quiet");
    await page.goto("/studies");
    await expect(page.getByRole("heading", { level: 1, name: "Your courses" })).toBeVisible();
    await setImmersion(page, "collegiate", true);
    await page.goto("/campus/map");
    await expect(page.getByRole("navigation", { name: "Places on the campus" }).getByRole("link", { name: "Common Room" })).toBeVisible();
  });

  test("settings: live tutoring is a labelled scripted demo without a key, and its limits save", async ({ page }) => {
    await signInOrBootstrap(page);
    await page.goto("/settings");
    const card = page.locator("#provider");
    // The state notice, not the runs table, where every scripted run is also named "Scripted demo".
    await expect(card.getByRole("status").filter({ hasText: "No model is configured" })).toBeVisible();
    await expect(card.getByRole("status").filter({ hasText: "No model is configured" })).toContainText("Scripted demo");
    await expect(page.getByLabel("Provider", { exact: true })).toHaveValue("fixture");
    await page.getByLabel("Per day", { exact: true }).fill("2.5");
    await card.getByRole("button", { name: "Save live tutoring settings" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
    await expect(page.getByLabel("Per day", { exact: true })).toHaveValue("2.5");
    await screenshot(page, "35-settings");
  });
});
