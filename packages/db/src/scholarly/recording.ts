import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { canonicalRequest } from "./cache";
import type { FixtureEntry, FixtureManifest } from "./fixture-transport";
import type {
  LiveTransport,
  PdfRequest,
  PdfResponse,
  ProviderRequest,
  ProviderResponse,
  RequestOptions,
  ScholarlyTransport,
} from "./transport";

/**
 * Records live responses as fixtures: each request goes to the live transport (never the cache) and
 * its body is written under the fixtures folder with a manifest entry naming the canonical request,
 * status and retrieval time. Used only by the opt-in `pnpm library:live-check --record`.
 */
export class RecordingTransport implements ScholarlyTransport {
  readonly mode = "live" as const;
  readonly recorded: FixtureEntry[] = [];

  constructor(
    private readonly inner: LiveTransport,
    private readonly dir: string,
  ) {}

  async get(request: ProviderRequest, _options?: RequestOptions): Promise<ProviderResponse> {
    const response = await this.inner.get(request, { cache: "refresh" });
    const canonical = canonicalRequest(request);
    const file = fixtureFileName(request.provider, canonical, response.contentType);
    const target = join(this.dir, file);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, response.body.endsWith("\n") ? response.body : `${response.body}\n`, "utf8");
    this.recorded.push({
      request: canonical,
      status: response.status,
      contentType: response.contentType,
      file,
      retrievedAt: response.retrievedAt,
    });
    return response;
  }

  getPdf(request: PdfRequest): Promise<PdfResponse> {
    return this.inner.getPdf(request);
  }

  /** Writes the manifest: earlier entries for other requests are kept, re-recorded ones replaced. */
  writeManifest(description: string): void {
    const path = join(this.dir, "manifest.json");
    const earlier: FixtureEntry[] = existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as FixtureManifest).entries : [];
    const byRequest = new Map(earlier.map((e) => [e.request, e]));
    for (const entry of this.recorded) byRequest.set(entry.request, entry);
    const manifest: FixtureManifest = {
      description,
      entries: [...byRequest.values()].sort((a, b) => (a.request < b.request ? -1 : a.request > b.request ? 1 : 0)),
    };
    writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }
}

export function fixtureFileName(provider: string, canonical: string, contentType: string | null): string {
  const extension = contentType?.includes("json") ? "json" : contentType?.includes("xml") ? "xml" : "txt";
  const withoutHost = canonical.replace(/^GET https:\/\/[^/]+/, "");
  const slug = withoutHost
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  const hash = createHash("sha256").update(canonical).digest("hex").slice(0, 10);
  return `${provider}/${slug}-${hash}.${extension}`;
}
