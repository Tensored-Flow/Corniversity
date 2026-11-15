import { describe, expect, it } from "vitest";
import { acceptsPositionSave, clampPosition, effectiveAt, MAX_CHANGED_AGO_MS, PositionSaveSchema, ReadingPositionSchema } from "./position";

const now = new Date("2026-11-15T12:00:00.000Z");

describe("server-clock ordering of reading positions", () => {
  it("dates a save by the server clock minus how long ago the reader moved, clamped to ten minutes", () => {
    expect(effectiveAt(now, 5000).toISOString()).toBe("2026-11-15T11:59:55.000Z");
    expect(effectiveAt(now, -5000).getTime()).toBe(now.getTime());
    expect(effectiveAt(now, 3 * 60 * 60 * 1000).getTime()).toBe(now.getTime() - MAX_CHANGED_AGO_MS);
    expect(effectiveAt(now, Number.NaN).getTime()).toBe(now.getTime() - MAX_CHANGED_AGO_MS);
  });

  it("keeps a save only when it is strictly later than the stored one", () => {
    expect(acceptsPositionSave(null, now)).toBe(true);
    expect(acceptsPositionSave(new Date(now.getTime() - 1), now)).toBe(true);
    expect(acceptsPositionSave(now, new Date(now.getTime()))).toBe(false);
    expect(acceptsPositionSave(new Date(now.getTime() + 1), now)).toBe(false);
  });

  it("is immune to device clocks: a phone a year fast cannot freeze the laptop's later saves", () => {
    // The phone's wall clock never reaches the server; it only reports how long ago it moved.
    const phoneSave = effectiveAt(new Date("2026-11-15T12:00:00Z"), 2_000);
    let stored = phoneSave;
    const laptopSave = effectiveAt(new Date("2026-11-15T12:03:00Z"), 500);
    expect(acceptsPositionSave(stored, laptopSave)).toBe(true);
    stored = laptopSave;
    // A delayed request from the phone, sent at 12:03:30 about a move 40 seconds earlier, is older.
    expect(acceptsPositionSave(stored, effectiveAt(new Date("2026-11-15T12:03:30Z"), 40_000))).toBe(false);
  });
});

describe("position clamping and validation", () => {
  it("clamps page index, coordinates and zoom", () => {
    expect(clampPosition({ pageIndex: 40, top: 100, left: 20, zoom: 1.5 }, 12)).toEqual({ pageIndex: 11, top: 100, left: 20, zoom: 1.5 });
    expect(clampPosition({ pageIndex: -3, top: 1e9, left: -1e9, zoom: 50 }, 12)).toEqual({
      pageIndex: 0,
      top: 100_000,
      left: -100_000,
      zoom: 10,
    });
    expect(clampPosition({ pageIndex: 2, top: Number.NaN, left: 0, zoom: 0.01 }, null)).toEqual({
      pageIndex: 2,
      top: 0,
      left: 0,
      zoom: 0.1,
    });
    expect(clampPosition({ pageIndex: 2, top: 0, left: 0, zoom: Number.NaN })).toMatchObject({ zoom: 1 });
  });

  it("validates what the reader posts", () => {
    expect(ReadingPositionSchema.safeParse({ pageIndex: 0, top: 1, left: 2, zoom: 1 }).success).toBe(true);
    expect(ReadingPositionSchema.safeParse({ pageIndex: 0, top: 1, left: 2, zoom: 1, extra: 1 }).success).toBe(false);
    expect(ReadingPositionSchema.safeParse({ pageIndex: -1, top: 1, left: 2, zoom: 1 }).success).toBe(false);
    expect(ReadingPositionSchema.safeParse({ pageIndex: 0, top: 1, left: 2, zoom: 0 }).success).toBe(false);
    const save = (changedAgoMs: unknown) =>
      PositionSaveSchema.safeParse({ position: { pageIndex: 0, top: 0, left: 0, zoom: 1 }, changedAgoMs });
    expect(save(1200).data?.changedAgoMs).toBe(1200);
    // A performance.now() difference is fractional; ages are clamped into [0, 10 min], never refused.
    expect(save(1534.7000000476837).data?.changedAgoMs).toBe(1535);
    expect(save(2 * 24 * 60 * 60 * 1000).data?.changedAgoMs).toBe(MAX_CHANGED_AGO_MS);
    expect(save(-1).data?.changedAgoMs).toBe(0);
    expect(save(Number.NaN).success).toBe(false);
    expect(save(Number.POSITIVE_INFINITY).success).toBe(false);
    expect(save("5").success).toBe(false);
  });
});
