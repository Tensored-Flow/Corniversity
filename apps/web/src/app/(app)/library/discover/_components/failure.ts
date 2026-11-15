import type { ListFailureCode } from "@corniversity/db/services/discover";
import { ERROR_NOTICES } from "@/lib/notices";

/** A list that cannot be shown says what happened, in the application's own registered words. */
export function failureText(code: ListFailureCode): string {
  switch (code) {
    case "budget_exhausted":
      return ERROR_NOTICES["discover-list-budget"];
    case "rate_limited":
      return ERROR_NOTICES["discover-list-rate-limited"];
    case "unavailable":
      return ERROR_NOTICES["discover-list-unavailable"];
    case "fixture_missing":
      return ERROR_NOTICES["discover-list-fixture-missing"];
    case "refresh_failed":
      return ERROR_NOTICES["discover-list-refresh-failed"];
    default:
      return ERROR_NOTICES["discover-list-unusable"];
  }
}

/** An out-of-date list whose refresh failed stays on the page, with what happened to the refresh. */
export function refreshFailureText(code: ListFailureCode): string {
  switch (code) {
    case "budget_exhausted":
      return ERROR_NOTICES["discover-refresh-budget"];
    case "rate_limited":
      return ERROR_NOTICES["discover-refresh-rate-limited"];
    case "unavailable":
      return ERROR_NOTICES["discover-refresh-unavailable"];
    case "fixture_missing":
      return ERROR_NOTICES["discover-refresh-fixture-missing"];
    case "refresh_failed":
      return ERROR_NOTICES["discover-refresh-failed"];
    default:
      return ERROR_NOTICES["discover-refresh-unusable"];
  }
}

/** "It resets at 2026-11-16 00:00 UTC." when OpenAlex said when its allowance resets. */
export function resetText(resetAt: string | null): string | null {
  if (!resetAt) return null;
  const date = new Date(resetAt);
  return Number.isNaN(date.getTime()) ? null : `It resets at ${date.toISOString().slice(0, 16).replace("T", " ")} UTC.`;
}

/** "07:00 UTC": the hour from which a page asks for a list's next refresh. */
export function hourText(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "the next hour" : `${date.toISOString().slice(11, 16)} UTC`;
}

export const KEY_NEEDED = ERROR_NOTICES["discover-openalex-key-needed"];
