import { test as setup } from "@playwright/test";
import { AUTH_STATE, signInOrBootstrap } from "./helpers";

/**
 * Signs the owner in once per run and saves the session cookies; every journey project then
 * starts signed in. This keeps the journeys inside the sign-in rate limit (ten attempts a
 * minute), which is a security feature of the application, not something to loosen for tests.
 */
setup("sign in once for the journeys", async ({ page }) => {
  await signInOrBootstrap(page);
  await page.context().storageState({ path: AUTH_STATE });
});
