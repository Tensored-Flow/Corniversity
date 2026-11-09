import { readFileSync } from "node:fs";
import { join } from "node:path";
import { findFixtureRoot } from "./fixture";
import { ASSESSOR_PROMPT_VERSION } from "./prompts/assessor";
import { DIRECTOR_PROMPT_VERSION } from "./prompts/director";
import { DISCUSSION_PROMPT_VERSION } from "./prompts/discussion";
import { READING_PROMPT_VERSION } from "./prompts/reading";
import { SUPERVISOR_PROMPT_VERSION } from "./prompts/supervisor";
import { TUTOR_PROMPT_VERSION } from "./prompts/tutor";

/** The scripted responses the application asks for by name; each must load for the scripted demo to answer. */
export const REQUIRED_FIXTURES = [
  { role: "tutor", scenario: "default" },
  { role: "assessor", scenario: "default" },
  { role: "director", scenario: "default" },
  { role: "director", scenario: "welcome-note" },
  { role: "lecturer", scenario: "reading-passage" },
  { role: "peer", scenario: "default" },
  { role: "seminar_chair", scenario: "default" },
] as const;

export interface AssetReport {
  ok: boolean;
  fixtures: { required: number; loaded: number; missing: string[] };
  /** The prompt version compiled into this build for each role family. */
  prompts: Record<string, string>;
}

/**
 * Checks that the prompt and scripted-response assets this build relies on are present and parse,
 * without returning their contents or where they are stored: role and scenario names, counts and
 * prompt versions only. The web health check reports it and the worker logs it on start, so a
 * deployment can be checked without opening a shell in its container.
 */
export function checkAiAssets(root: string = findFixtureRoot()): AssetReport {
  const missing: string[] = [];
  for (const f of REQUIRED_FIXTURES) {
    try {
      const parsed = JSON.parse(readFileSync(join(root, f.role, `${f.scenario}.json`), "utf8")) as { text?: unknown; object?: unknown };
      if (typeof parsed.text !== "string" && parsed.object === undefined) missing.push(`${f.role}/${f.scenario}`);
    } catch {
      missing.push(`${f.role}/${f.scenario}`);
    }
  }
  return {
    ok: missing.length === 0,
    fixtures: { required: REQUIRED_FIXTURES.length, loaded: REQUIRED_FIXTURES.length - missing.length, missing },
    prompts: {
      tutor: TUTOR_PROMPT_VERSION,
      assessor: ASSESSOR_PROMPT_VERSION,
      director: DIRECTOR_PROMPT_VERSION,
      reading: READING_PROMPT_VERSION,
      discussion: DISCUSSION_PROMPT_VERSION,
      supervisor: SUPERVISOR_PROMPT_VERSION,
    },
  };
}
