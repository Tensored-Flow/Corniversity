import { describe, expect, it } from "vitest";
import { nextInterval } from "./revision";

describe("revision intervals", () => {
  it("doubles on recall up to 60 days, holds when shaky, resets when forgotten", () => {
    expect(nextInterval(2, "recalled")).toBe(4);
    expect(nextInterval(40, "recalled")).toBe(60);
    expect(nextInterval(8, "shaky")).toBe(8);
    expect(nextInterval(8, "forgot")).toBe(1);
    expect(nextInterval(0, "recalled")).toBe(2);
  });
});
