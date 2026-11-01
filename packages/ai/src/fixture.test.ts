import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { DEFAULT_FIXTURE_ROOT, FixtureProvider, findFixtureRoot } from "./fixture";

const scratch = mkdtempSync(join(tmpdir(), "fixture-root-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

describe("finding the fixtures folder", () => {
  it("uses AI_FIXTURE_ROOT when it exists", () => {
    expect(findFixtureRoot({ env: { AI_FIXTURE_ROOT: scratch }, cwd: scratch })).toBe(scratch);
  });

  it("uses the folder beside the source when it exists, as in development and the worker", () => {
    expect(findFixtureRoot({ env: {}, cwd: scratch })).toBe(DEFAULT_FIXTURE_ROOT);
  });

  it("finds the folder carried beside a bundled app from its working directory", () => {
    // The standalone web server runs in <root>/apps/web with the fixtures at <root>/packages/ai/fixtures.
    const carried = join(scratch, "bundle", "packages", "ai", "fixtures");
    mkdirSync(carried, { recursive: true });
    mkdirSync(join(scratch, "bundle", "apps", "web"), { recursive: true });
    const found = findFixtureRoot({
      env: { AI_FIXTURE_ROOT: join(scratch, "missing") },
      cwd: join(scratch, "bundle", "apps", "web"),
      sourceRoot: join(scratch, "bundled-code-has-no-source", "fixtures"),
    });
    expect(found).toBe(carried);
  });

  it("a provider with the default folder answers from the scripted fixtures", async () => {
    const provider = new FixtureProvider();
    const stream = provider.streamText({ role: "peer", scenario: "default", system: "", messages: [] } as never);
    let text = "";
    for (;;) {
      const next = await stream.next();
      if (next.done) break;
      text += next.value;
    }
    expect(text).toMatch(/Scripted fixture turn/);
  });
});
