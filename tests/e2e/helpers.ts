import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Page } from "@playwright/test";

/** Where the setup project stores the owner's signed-in cookies for the other projects. */
export const AUTH_STATE = "tests/e2e/.auth/owner.json";

/**
 * The owner credentials used by the journeys. They come from the local environment file (never
 * committed) plus a test password kept only in the test process. The journeys create the owner
 * account on a fresh database; on an existing database they sign in instead.
 */
export function ownerEnv(): { email: string; code: string; password: string } {
  const envPath = resolve(process.cwd(), ".env");
  const values: Record<string, string> = {};
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const match = /^([A-Z_]+)=(.*)$/.exec(line.trim());
      if (match) values[match[1]!] = match[2]!;
    }
  }
  const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:3000";
  const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(baseUrl);
  if (!local && !process.env.E2E_OWNER_PASSWORD) {
    throw new Error(`Refusing to use the default test password against ${baseUrl}; set E2E_OWNER_PASSWORD to your own.`);
  }
  return {
    email: process.env.E2E_OWNER_EMAIL ?? values.OWNER_EMAIL ?? "owner@example.com",
    code: process.env.E2E_BOOTSTRAP_CODE ?? values.OWNER_BOOTSTRAP_CODE ?? "",
    password: process.env.E2E_OWNER_PASSWORD ?? "correct-horse-battery-staple-2026",
  };
}

/** Ensures the page is signed in: a no-op when the project's stored session is valid. */
export async function signInOrBootstrap(page: Page): Promise<void> {
  await page.goto("/campus");
  if (!/\/sign-in/.test(page.url())) return;
  const owner = ownerEnv();
  const joinLink = page.getByRole("link", { name: /create the owner account/i });
  if (await joinLink.isVisible().catch(() => false)) {
    await page.goto("/join");
    await page.getByLabel("Your name").fill("Leon");
    await page.getByLabel("Owner email").fill(owner.email);
    await page.getByLabel("Password", { exact: true }).fill(owner.password);
    await page.getByLabel("Bootstrap code").fill(owner.code);
    await page.getByRole("button", { name: /create account and begin/i }).click();
    await expect(page).toHaveURL(/\/onboarding\/1/);
    return;
  }
  await page.getByLabel("Email").fill(owner.email);
  await page.getByLabel("Password", { exact: true }).fill(owner.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page).not.toHaveURL(/\/sign-in/);
}

export async function screenshot(page: Page, name: string): Promise<void> {
  const viewport = page.viewportSize();
  const suffix = viewport && viewport.width < 600 ? "mobile" : "desktop";
  await page.screenshot({ path: `docs/qa/screenshots/${name}-${suffix}.png`, fullPage: true });
}
