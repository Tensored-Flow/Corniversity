import { describe, expect, it } from "vitest";
import { proposeNextTask } from "../progression/progression";
import { isIdentityLabel, nextInterval, nextReviewSet, startOfWeekUtc } from "./review";

const day = (n: number) => new Date(Date.UTC(2026, 10, n, 12)); // November 2026; the 9th is a Monday
const item = (id: string, due: Date, extra: Partial<{ status: "active" | "paused" | "archived"; snoozedUntil: Date }> = {}) => ({
  id,
  dueAt: due,
  status: extra.status ?? ("active" as const),
  snoozedUntil: extra.snoozedUntil ?? null,
});

describe("bounded review", () => {
  it("offers at most five items, oldest first, however many are due: no backlog", () => {
    const items = Array.from({ length: 40 }, (_, i) => item(`r${i}`, day(1 + (i % 9))));
    const set = nextReviewSet(items, { now: day(10), budgetPerWeek: 20, reviewedThisWeek: 0, paused: false });
    expect(set.kind).toBe("offered");
    expect(set.items).toHaveLength(5);
    expect(set.dueCount).toBe(40);
  });

  it("stops at the weekly budget, respects pause, rest days, snooze and archive", () => {
    const items = [
      item("a", day(1)),
      item("b", day(2), { status: "archived" }),
      item("c", day(3), { snoozedUntil: day(20) }),
      item("d", day(4)),
    ];
    const base = { now: day(10), budgetPerWeek: 6, reviewedThisWeek: 4, paused: false };
    expect(nextReviewSet(items, base)).toMatchObject({ kind: "offered", items: ["a", "d"], remainingThisWeek: 2 });
    expect(nextReviewSet(items, { ...base, reviewedThisWeek: 6 })).toMatchObject({ kind: "budget_used", items: [] });
    expect(nextReviewSet(items, { ...base, paused: true })).toMatchObject({ kind: "paused", items: [] });
    // 10 November 2026 is a Tuesday (ISO weekday 2).
    expect(nextReviewSet(items, { ...base, restWeekdays: [2] })).toMatchObject({ kind: "rest_day", items: [] });
  });

  it("states and follows its interval rule", () => {
    expect(nextInterval(2, "recalled")).toBe(4);
    expect(nextInterval(40, "recalled")).toBe(60);
    expect(nextInterval(8, "shaky")).toBe(8);
    expect(nextInterval(8, "forgot")).toBe(1);
    expect(startOfWeekUtc(day(12)).toISOString()).toBe("2026-11-09T00:00:00.000Z");
  });

  it("recognises statements about a person rather than a piece of work", () => {
    expect(isIdentityLabel("Leon is weak at analysis")).toBe(true);
    expect(isIdentityLabel("struggles with proofs")).toBe(true);
    expect(isIdentityLabel("This application of the theorem omitted an ambient completeness assumption.")).toBe(false);
  });
});

describe("next task in a progression", () => {
  const items = [
    { exerciseId: "e1", title: "Worked", stage: "worked_example" as const, state: "needs_review", submitted: true, openIssues: 0 },
    { exerciseId: "e2", title: "Independent", stage: "independent" as const, state: null, submitted: false, openIssues: 0 },
    { exerciseId: "e3", title: "Counterexample", stage: "counterexample" as const, state: null, submitted: false, openIssues: 0 },
  ];

  it("proposes the earliest stage not yet attempted, with its reason", () => {
    expect(proposeNextTask(items)).toEqual({ exerciseId: "e2", reason: 'Next in the progression: independent exercise ("Independent").' });
  });

  it("puts revising work with an open issue first, and never sends the learner back to the start", () => {
    const withIssue = items.map((i) => (i.exerciseId === "e1" ? { ...i, openIssues: 1 } : i));
    expect(proposeNextTask(withIssue)?.exerciseId).toBe("e1");
    expect(proposeNextTask(withIssue)?.reason).toMatch(/an open issue/);
  });
});
