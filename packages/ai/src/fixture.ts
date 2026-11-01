import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type BaseRequest,
  EMPTY_USAGE,
  type ModelProvider,
  ProviderError,
  type StructuredRequest,
  type StructuredResult,
  type TextResult,
} from "./provider";

interface FixtureFile {
  text?: string;
  object?: unknown;
  note?: string;
}

const here = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_FIXTURE_ROOT = resolve(here, "..", "fixtures");

/**
 * The fixtures folder. Beside this source file in development and in the worker, which run from
 * source; the web app's production build bundles this code elsewhere and carries the folder at
 * packages/ai/fixtures beside the app, so it is also looked for from the working directory.
 * AI_FIXTURE_ROOT overrides everything.
 */
export function findFixtureRoot(options: { env?: Record<string, string | undefined>; cwd?: string; sourceRoot?: string } = {}): string {
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const sourceRoot = options.sourceRoot ?? DEFAULT_FIXTURE_ROOT;
  const candidates = [
    env.AI_FIXTURE_ROOT,
    sourceRoot,
    resolve(cwd, "packages", "ai", "fixtures"),
    resolve(cwd, "..", "..", "packages", "ai", "fixtures"),
  ].filter((c): c is string => Boolean(c));
  return candidates.find((c) => existsSync(c)) ?? sourceRoot;
}

/**
 * Deterministic provider. Responses come from JSON files under fixtures/<role>/<scenario>.json.
 * It exists so the whole product can be exercised and tested without spending money or
 * depending on a network; it is never described as a live model check, and it refuses rather
 * than inventing a response when no fixture matches a structured request.
 */
export class FixtureProvider implements ModelProvider {
  readonly name = "fixture" as const;
  constructor(private readonly root: string = findFixtureRoot()) {}

  private load(role: string, scenario: string | undefined): FixtureFile | null {
    const candidates = [scenario, "default"].filter((s): s is string => Boolean(s));
    for (const candidate of candidates) {
      const path = join(this.root, role, `${sanitize(candidate)}.json`);
      if (existsSync(path)) {
        return JSON.parse(readFileSync(path, "utf8")) as FixtureFile;
      }
    }
    return null;
  }

  async *streamText(request: BaseRequest): AsyncGenerator<string, TextResult, void> {
    const fixture = this.load(request.role, request.scenario);
    const text =
      fixture?.text ??
      `*(Fixture provider: no scripted ${request.role} response for scenario "${request.scenario ?? "default"}". ` +
        "This is a placeholder, not teaching. Configure a model provider in Settings to receive a real response.)*";
    for (const chunk of chunks(text, 48)) {
      yield chunk;
    }
    return {
      text,
      usage: { ...EMPTY_USAGE },
      model: "fixture",
      provider: "fixture",
      stopReason: "end_turn",
    };
  }

  async generateStructured<T>(request: StructuredRequest<T>): Promise<StructuredResult<T>> {
    const fixture = this.load(request.role, request.scenario);
    if (!fixture || fixture.object === undefined) {
      throw new ProviderError(
        "fixture_missing",
        `No fixture object for ${request.role}/${request.scenario ?? "default"} (${request.schemaName}).`,
      );
    }
    const parsed = request.schema.safeParse(fixture.object);
    if (!parsed.success) {
      throw new ProviderError(
        "invalid_output",
        `Fixture ${request.role}/${request.scenario ?? "default"} does not match ${request.schemaName}: ${parsed.error.message}`,
      );
    }
    return { object: parsed.data, usage: { ...EMPTY_USAGE }, model: "fixture", provider: "fixture" };
  }

  /** Lists available scenarios so tests and docs can be explicit about coverage. */
  listScenarios(role: string): string[] {
    const dir = join(this.root, role);
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""))
      .sort();
  }
}

function sanitize(scenario: string): string {
  return scenario.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function* chunks(text: string, size: number): Generator<string> {
  for (let i = 0; i < text.length; i += size) {
    yield text.slice(i, i + size);
  }
}
