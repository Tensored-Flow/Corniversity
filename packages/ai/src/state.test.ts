import { describe, expect, it } from "vitest";
import { approvalCovers, decideProviderState, type PaidUseApproval, type ProviderStateInput, publicProviderState } from "./state";

const limits = { perRunUsd: 1, dailyUsd: 3, monthlyUsd: 40 };
const env = { provider: "fixture" as const, apiKey: undefined, defaultModel: "claude-opus-5-5" };
const approval: PaidUseApproval = {
  model: "claude-opus-5-5",
  perRunUsd: 1,
  dailyUsd: 3,
  monthlyUsd: 40,
  refusalFallback: true,
  approvedAt: "2026-11-09T10:00:00.000Z",
};
const live = (over: Partial<NonNullable<ProviderStateInput["setting"]>> = {}): ProviderStateInput["setting"] => ({
  provider: "anthropic",
  keyStored: true,
  key: "sk-ant-test-key-0000000000",
  model: "claude-opus-5-5",
  refusalFallback: true,
  approval,
  ...over,
});

describe("which provider answers", () => {
  it("is the scripted demo when nothing is configured", () => {
    expect(decideProviderState({ setting: null, env, limits })).toEqual({ mode: "scripted", reason: "not_configured" });
  });

  it("is the scripted demo when the owner chose it, even if the deployment has a key", () => {
    const state = decideProviderState({
      setting: live({ provider: "fixture" }),
      env: { ...env, provider: "anthropic", apiKey: "sk-env" },
      limits,
    });
    expect(state).toEqual({ mode: "scripted", reason: "owner_chose_scripted" });
  });

  it("is live only with a readable key, a supported model and an approval covering the current settings", () => {
    const state = decideProviderState({ setting: live(), env, limits });
    expect(state).toMatchObject({ mode: "live", model: "claude-opus-5-5", refusalFallback: true, source: "owner_setting" });
  });

  it("uses the deployment's key when the owner stored none, still only with the owner's approval", () => {
    const setting = live({ keyStored: false, key: undefined });
    expect(decideProviderState({ setting, env: { ...env, apiKey: "sk-env-key" }, limits })).toMatchObject({
      mode: "live",
      source: "environment",
    });
    expect(decideProviderState({ setting: null, env: { ...env, provider: "anthropic", apiKey: "sk-env-key" }, limits })).toMatchObject({
      mode: "blocked",
      code: "not_approved",
    });
  });
});

describe("a live model that cannot run is blocked, never replaced by scripted replies", () => {
  it("without a key", () => {
    expect(decideProviderState({ setting: live({ keyStored: false, key: undefined }), env, limits })).toMatchObject({
      mode: "blocked",
      code: "no_key",
    });
  });

  it("when the stored key can no longer be read (the server secret changed)", () => {
    expect(decideProviderState({ setting: live({ key: undefined }), env, limits })).toMatchObject({
      mode: "blocked",
      code: "key_unreadable",
    });
  });

  it("when the model is not a supported identifier", () => {
    expect(decideProviderState({ setting: live({ model: "claude-imaginary-9" }), env, limits })).toMatchObject({
      mode: "blocked",
      code: "unsupported_model",
    });
  });

  it("until paid use is approved", () => {
    expect(decideProviderState({ setting: live({ approval: null }), env, limits })).toMatchObject({
      mode: "blocked",
      code: "not_approved",
    });
  });

  it("when a limit was raised, the model changed or fallback was switched on after approval", () => {
    expect(decideProviderState({ setting: live(), env, limits: { ...limits, dailyUsd: 4 } })).toMatchObject({ code: "approval_outdated" });
    expect(decideProviderState({ setting: live({ model: "claude-sonnet-5-5" }), env, limits })).toMatchObject({
      code: "approval_outdated",
    });
    const approvedWithoutFallback = { ...approval, refusalFallback: false };
    expect(decideProviderState({ setting: live({ approval: approvedWithoutFallback }), env, limits })).toMatchObject({
      code: "approval_outdated",
    });
  });
});

describe("approval coverage", () => {
  const current = { model: "claude-opus-5-5", refusalFallback: true, ...limits };
  it("lowering a limit or switching fallback off needs no new approval", () => {
    expect(approvalCovers(approval, { ...current, monthlyUsd: 20 })).toBe(true);
    expect(approvalCovers(approval, { ...current, refusalFallback: false })).toBe(true);
  });
  it("raising any limit does", () => {
    expect(approvalCovers(approval, { ...current, perRunUsd: 1.5 })).toBe(false);
  });
});

describe("the public view", () => {
  it("never carries the key", () => {
    const view = publicProviderState(decideProviderState({ setting: live(), env, limits }));
    expect(JSON.stringify(view)).not.toContain("sk-ant");
    expect(view).toEqual({ mode: "live", model: "claude-opus-5-5", refusalFallback: true, source: "owner_setting" });
  });
});
