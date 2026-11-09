import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { checkAiAssets, REQUIRED_FIXTURES } from "./assets";
import { DEFAULT_FIXTURE_ROOT } from "./fixture";

const scratch = mkdtempSync(join(tmpdir(), "ai-assets-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

describe("the asset diagnostic", () => {
  it("finds every scripted response the application asks for in the source tree", () => {
    const report = checkAiAssets(DEFAULT_FIXTURE_ROOT);
    expect(report.ok).toBe(true);
    expect(report.fixtures).toEqual({ required: REQUIRED_FIXTURES.length, loaded: REQUIRED_FIXTURES.length, missing: [] });
    expect(report.prompts.tutor).toMatch(/^tutor-/);
    expect(report.prompts.supervisor).toMatch(/^supervisor-/);
  });

  it("names what is missing or unreadable, by role and scenario only", () => {
    mkdirSync(join(scratch, "tutor"), { recursive: true });
    writeFileSync(join(scratch, "tutor", "default.json"), JSON.stringify({ text: "scripted" }));
    mkdirSync(join(scratch, "assessor"), { recursive: true });
    writeFileSync(join(scratch, "assessor", "default.json"), "{ not json");
    const report = checkAiAssets(scratch);
    expect(report.ok).toBe(false);
    expect(report.fixtures.missing).toContain("assessor/default");
    expect(report.fixtures.missing).not.toContain("tutor/default");
    expect(report.fixtures.loaded).toBe(1);
  });

  it("never reveals a response's text or where the files are stored", () => {
    const serialised = JSON.stringify(checkAiAssets(DEFAULT_FIXTURE_ROOT));
    expect(serialised).not.toMatch(/Scripted demo turn|no model is configured/i);
    expect(serialised).not.toContain(DEFAULT_FIXTURE_ROOT);
    expect(serialised).not.toMatch(/[A-Za-z]:\\|\/packages\//);
  });
});
