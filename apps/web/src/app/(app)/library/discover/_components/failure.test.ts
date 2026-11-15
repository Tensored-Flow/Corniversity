import type { ListFailureCode } from "@corniversity/db/services/discover";
import { describe, expect, it } from "vitest";
import { ERROR_NOTICES } from "@/lib/notices";
import { failureText, hourText, KEY_NEEDED, refreshFailureText, resetText } from "./failure";

const CODES: ListFailureCode[] = [
  "not_found",
  "invalid_identifier",
  "rate_limited",
  "budget_exhausted",
  "unavailable",
  "redirect",
  "refused",
  "too_large",
  "invalid_response",
  "fixture_missing",
  "not_cached",
  "refresh_failed",
];

describe("Discover's failure states", () => {
  it("say what happened in registered sentences, never as an empty list", () => {
    const registered = new Set<string>(Object.values(ERROR_NOTICES));
    for (const code of CODES) {
      for (const text of [failureText(code), refreshFailureText(code)]) {
        expect(registered.has(text), code).toBe(true);
        expect(text).not.toMatch(/no results/i);
      }
    }
    expect(failureText("fixture_missing")).toBe("Not recorded in fixture mode, so this list is unavailable.");
    expect(failureText("budget_exhausted")).toMatch(/daily allowance/);
    expect(KEY_NEEDED).toBe("OpenAlex browsing needs an API key on this server.");
  });

  it("an out-of-date list whose refresh failed says the list shown was not refreshed", () => {
    expect(refreshFailureText("budget_exhausted")).toBe(
      "OpenAlex's daily allowance for this server is used up, so this list was not refreshed.",
    );
    for (const code of CODES) expect(refreshFailureText(code)).toMatch(/refresh/i);
  });

  it("give the reset time of a spent allowance when OpenAlex reported one, and the hour of the next refresh", () => {
    expect(resetText("2026-11-17T00:00:00.000Z")).toBe("It resets at 2026-11-17 00:00 UTC.");
    expect(resetText(null)).toBeNull();
    expect(resetText("not a date")).toBeNull();
    expect(hourText("2026-11-16T15:00:00.000Z")).toBe("15:00 UTC");
  });
});
