import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { canonicalRequest } from "./cache";
import { providerName, ScholarlyProviderError } from "./errors";
import type { PdfRequest, PdfResponse, ProviderRequest, ProviderResponse, ScholarlyTransport } from "./transport";

/**
 * The fixture provider: answers requests from responses recorded once from the live providers
 * (packages/db/src/scholarly/fixtures, see its README). Requests are matched by their canonical form,
 * exactly as the live transport would send them (credentials never take part). Everything it returns
 * is marked as fixture data, with the recording time as its retrieval time. A request with no
 * recording fails with `fixture_missing`; nothing is ever invented.
 */

export interface FixtureEntry {
  /** Canonical request (`GET https://host/path?sorted-query`). */
  request: string;
  status: 200 | 404;
  contentType: string | null;
  /** Path of the recorded body, relative to the fixtures folder. */
  file: string;
  /** ISO time the response was recorded from the live provider. */
  retrievedAt: string;
}

export interface FixtureManifest {
  description: string;
  entries: FixtureEntry[];
}

const MANIFEST = "manifest.json";
const RELATIVE_DIRS = ["packages/db/src/scholarly/fixtures", "src/scholarly/fixtures", "scholarly/fixtures"];

/** Finds the fixtures folder by walking up from `start` (the web app and worker run in their own folders). */
export function findFixtureDir(start = process.cwd()): string | null {
  let dir = resolve(start);
  for (let i = 0; i < 8; i++) {
    for (const relative of RELATIVE_DIRS) {
      const candidate = join(dir, relative);
      if (existsSync(join(candidate, MANIFEST))) return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

export class FixtureTransport implements ScholarlyTransport {
  readonly mode = "fixture" as const;
  private manifest: Map<string, FixtureEntry> | null = null;
  private readonly dir: string;

  constructor(dir?: string) {
    const found = dir ?? findFixtureDir();
    if (!found) throw new Error("The scholarly fixtures folder (packages/db/src/scholarly/fixtures) was not found.");
    this.dir = found;
  }

  private entries(): Map<string, FixtureEntry> {
    if (!this.manifest) {
      const parsed = JSON.parse(readFileSync(join(this.dir, MANIFEST), "utf8")) as FixtureManifest;
      this.manifest = new Map(parsed.entries.map((e) => [e.request, e]));
    }
    return this.manifest;
  }

  /** The recorded requests, for tests and diagnostics. */
  recordedRequests(): string[] {
    return [...this.entries().keys()];
  }

  async get(request: ProviderRequest): Promise<ProviderResponse> {
    const entry = this.entries().get(canonicalRequest(request));
    if (!entry)
      throw new ScholarlyProviderError(
        request.provider,
        "fixture_missing",
        `No recorded ${providerName(request.provider)} response for this request (fixture mode).`,
      );
    const file = resolve(this.dir, entry.file);
    if (!file.startsWith(resolve(this.dir) + sep)) throw new Error("Fixture path escapes the fixtures folder.");
    return {
      status: entry.status,
      contentType: entry.contentType,
      body: readFileSync(file, "utf8"),
      retrievedAt: entry.retrievedAt,
      fixture: true,
      fromCache: false,
      stale: false,
    };
  }

  async getPdf(request: PdfRequest): Promise<PdfResponse> {
    throw new ScholarlyProviderError(request.provider, "fixture_missing", "No recorded arXiv PDF for this request (fixture mode).");
  }
}
