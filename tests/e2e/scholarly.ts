import { type APIRequestContext, expect } from "@playwright/test";

/**
 * Research-library journeys run only against a stack whose scholarly providers are recorded
 * fixtures (SCHOLARLY_PROVIDER=fixture): they must never call OpenAlex, arXiv or Crossref, and the
 * pages they check label fixture data as such. Call this first in every such journey.
 */
export async function expectFixtureProviders(request: APIRequestContext): Promise<void> {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { scholarlyProviders?: string };
  expect(body.scholarlyProviders, "research-library journeys need SCHOLARLY_PROVIDER=fixture on the stack").toBe("fixture");
}
