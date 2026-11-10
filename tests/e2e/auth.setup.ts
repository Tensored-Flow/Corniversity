import { test as setup } from "@playwright/test";
import { AUTH_STATE, signInOrBootstrap } from "./helpers";

/**
 * Signs the owner in once per run and saves the session cookies; every journey project then
 * starts signed in. This keeps the journeys inside the sign-in rate limit (ten attempts a
 * minute), which is a security feature of the application, not something to loosen for tests.
 */
setup("sign in once for the journeys", async ({ page }) => {
  await signInOrBootstrap(page);
  // The journeys assume the scripted demo: with a live model they would spend money and mix live
  // replies into scripted evidence, so they stop here instead.
  await page.goto("/settings");
  const scripted = page.locator("#provider").getByRole("status").filter({ hasText: "No model is configured" });
  if (!(await scripted.isVisible().catch(() => false))) {
    throw new Error("This stack has a live (or blocked) model configured; the journeys run only in the scripted demo.");
  }
  await page.context().storageState({ path: AUTH_STATE });
});
