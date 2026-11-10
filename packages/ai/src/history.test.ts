import { describe, expect, it } from "vitest";
import { boundedHistory } from "./history";

const turn = (i: number, size = 100) => ({
  role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
  content: `${i}`.padEnd(size, "x"),
});

describe("bounded history", () => {
  it("sends everything when it fits", () => {
    const messages = [turn(0), turn(1), turn(2)];
    expect(boundedHistory(messages, 10_000)).toEqual(messages);
  });

  it("keeps the most recent messages within the budget and says how many were left out", () => {
    const messages = Array.from({ length: 21 }, (_, i) => turn(i));
    const window = boundedHistory(messages, 1_000);
    expect(window[0]!.content).toMatch(/^\(\d+ earlier messages were left out/);
    const kept = window.slice(1);
    expect(kept.at(-1)).toEqual(messages.at(-1));
    expect(kept.reduce((n, m) => n + m.content.length, 0)).toBeLessThanOrEqual(1_000);
    expect(kept[0]!.role).toBe("user");
    expect(window[0]!.content).toContain(`${messages.length - kept.length} earlier`);
  });

  it("always keeps the newest message, even when it alone exceeds the budget", () => {
    const messages = [turn(0), turn(1), turn(2, 5_000)];
    const window = boundedHistory(messages, 1_000);
    expect(window.at(-1)).toEqual(messages[2]);
    expect(window).toHaveLength(2);
  });
});
