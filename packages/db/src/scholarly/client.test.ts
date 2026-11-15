import { afterEach, describe, expect, it } from "vitest";
import { getEnv, resetEnvCache, scholarlyProviderRefusal } from "../env";
import { scholarlyClientFromEnv } from "./client";
import { FixtureTransport, findFixtureDir } from "./fixture-transport";

describe("scholarly client selection", () => {
  it("uses the recorded fixtures in fixture mode and marks what it returns as fixture data", async () => {
    const client = scholarlyClientFromEnv({ SCHOLARLY_PROVIDER: "fixture" });
    expect(client.mode).toBe("fixture");
    const work = await client.openalexWork({ scheme: "openalex", value: "W7133208539" });
    expect(work.record.provenance.source).toBe("fixture");
  });

  it("refuses fixture data in production even when asked directly", () => {
    expect(() => scholarlyClientFromEnv({ SCHOLARLY_PROVIDER: "fixture", DEPLOYMENT_MODE: "production" })).toThrow(/refused in production/);
  });

  it("builds the live client without making any request", () => {
    expect(scholarlyClientFromEnv({ SCHOLARLY_PROVIDER: "live", OPENALEX_API_KEY: "k".repeat(20) }).mode).toBe("live");
  });

  it("finds the fixtures folder from the repository root or the package folder, and refuses paths outside it", async () => {
    const dir = findFixtureDir();
    expect(dir).not.toBeNull();
    expect(findFixtureDir(`${dir}/../..`)).toBe(dir);
    expect(new FixtureTransport(dir!).recordedRequests().length).toBeGreaterThan(20);
  });
});

describe("scholarly settings", () => {
  const saved = { ...process.env };
  afterEach(() => {
    for (const key of [
      "DEPLOYMENT_MODE",
      "SCHOLARLY_PROVIDER",
      "OPENALEX_API_KEY",
      "CROSSREF_MAILTO",
      "BETTER_AUTH_URL",
      "CORNIVERSITY_INSTALLATION",
    ]) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    resetEnvCache();
  });

  it("refuses fixture data in production and in the owner's local installation, and only there", () => {
    expect(scholarlyProviderRefusal({ DEPLOYMENT_MODE: "production", SCHOLARLY_PROVIDER: "fixture" })).toMatch(
      /refusing to start in production/,
    );
    expect(
      scholarlyProviderRefusal({ DEPLOYMENT_MODE: "local", SCHOLARLY_PROVIDER: "fixture", CORNIVERSITY_INSTALLATION: "owner" }),
    ).toMatch(/the owner's local installation refuses it/);
    expect(scholarlyProviderRefusal({ DEPLOYMENT_MODE: "local", SCHOLARLY_PROVIDER: "fixture" })).toBeNull();
    expect(
      scholarlyProviderRefusal({ DEPLOYMENT_MODE: "local", SCHOLARLY_PROVIDER: "fixture", CORNIVERSITY_INSTALLATION: "development" }),
    ).toBeNull();
    expect(scholarlyProviderRefusal({ DEPLOYMENT_MODE: "production", SCHOLARLY_PROVIDER: "live" })).toBeNull();
    expect(
      scholarlyProviderRefusal({ DEPLOYMENT_MODE: "local", SCHOLARLY_PROVIDER: "live", CORNIVERSITY_INSTALLATION: "owner" }),
    ).toBeNull();
  });

  it("getEnv refuses fixture data in a process of the owner's installation (what pnpm local:owner starts)", () => {
    process.env.DEPLOYMENT_MODE = "local";
    process.env.SCHOLARLY_PROVIDER = "fixture";
    process.env.CORNIVERSITY_INSTALLATION = "owner";
    resetEnvCache();
    expect(() => getEnv()).toThrow(/the owner's local installation refuses it/);
    process.env.SCHOLARLY_PROVIDER = "live";
    resetEnvCache();
    expect(getEnv().CORNIVERSITY_INSTALLATION).toBe("owner");
  });

  it("getEnv applies the refusal, defaults to live and treats empty optional settings as unset", () => {
    process.env.DEPLOYMENT_MODE = "production";
    process.env.BETTER_AUTH_URL = "https://corniversity.example.org";
    process.env.SCHOLARLY_PROVIDER = "fixture";
    resetEnvCache();
    expect(() => getEnv()).toThrow(/SCHOLARLY_PROVIDER is 'fixture'/);

    process.env.DEPLOYMENT_MODE = "local";
    delete process.env.SCHOLARLY_PROVIDER;
    process.env.OPENALEX_API_KEY = "";
    process.env.CROSSREF_MAILTO = "  ";
    resetEnvCache();
    const env = getEnv();
    expect(env.SCHOLARLY_PROVIDER).toBe("live");
    expect(env.OPENALEX_API_KEY).toBeUndefined();
    expect(env.CROSSREF_MAILTO).toBeUndefined();

    process.env.CROSSREF_MAILTO = "not-an-email";
    resetEnvCache();
    expect(() => getEnv()).toThrow(/CROSSREF_MAILTO/);
  });
});
