import { unstable_getResponseFromNextConfig } from "next/experimental/testing/server";
import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, securityHeaders } from "./csp";

const PRODUCTION_PAGE_POLICY =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; " +
  "font-src 'self' data:; connect-src 'self' https://arxiv.org; frame-src 'self'; frame-ancestors 'none'; object-src 'none'; " +
  "base-uri 'self'; form-action 'self'";

const PRODUCTION_PDFJS_POLICY = PRODUCTION_PAGE_POLICY.replace(
  "script-src 'self' 'unsafe-inline';",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval';",
);

describe("content security policy", () => {
  it("is exactly the production policy for pages", () => {
    expect(contentSecurityPolicy({ production: true })).toBe(PRODUCTION_PAGE_POLICY);
  });

  it("grants WebAssembly compilation only to the PDF.js policy", () => {
    expect(contentSecurityPolicy({ production: true, wasm: true })).toBe(PRODUCTION_PDFJS_POLICY);
    expect(contentSecurityPolicy({ production: true })).not.toContain("wasm-unsafe-eval");
    expect(contentSecurityPolicy({ production: false })).not.toContain("wasm-unsafe-eval");
  });

  it("allows eval only in development and never widens connect-src beyond arxiv.org", () => {
    const development = contentSecurityPolicy({ production: false });
    expect(development).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval';");
    expect(contentSecurityPolicy({ production: true })).not.toContain("'unsafe-eval'");
    for (const policy of [development, PRODUCTION_PAGE_POLICY, PRODUCTION_PDFJS_POLICY]) {
      expect(policy).toContain("; connect-src 'self' https://arxiv.org;");
      // Workers fall back to script-src 'self': no blob: or foreign worker is ever allowed.
      expect(policy).not.toMatch(/worker-src/);
    }
  });
});

describe("header rules as Next applies them", () => {
  const nextConfig = { headers: async () => securityHeaders(true) };

  it("sends the page policy on pages and API routes", async () => {
    for (const url of [
      "https://example.com/library/read/0f0e2d1c-1111-4222-8333-444455556666?view=page",
      "https://example.com/api/health",
    ]) {
      const response = await unstable_getResponseFromNextConfig({ url, nextConfig });
      expect(response.headers.get("content-security-policy")).toBe(PRODUCTION_PAGE_POLICY);
      expect(response.headers.get("cache-control")).toBeNull();
    }
  });

  it("replaces the policy and caches immutably under /pdfjs/ only", async () => {
    const response = await unstable_getResponseFromNextConfig({
      url: "https://example.com/pdfjs/6.4.299/pdf.worker.min.mjs",
      nextConfig,
    });
    expect(response.headers.get("content-security-policy")).toBe(PRODUCTION_PDFJS_POLICY);
    expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });
});
