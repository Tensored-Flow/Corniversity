import { describe, expect, it } from "vitest";
import {
  countsAsMove,
  LAST_SENT_MAX_AGE_MS,
  lastSentEntry,
  lastSentPosition,
  MOVE_INTENT_MS,
  openingTarget,
  PositionSender,
  positionFromLocation,
} from "./position";

describe("what counts as the owner's move", () => {
  it("only a change of view soon after the owner's own input; arriving and resizing are not moves", () => {
    expect(countsAsMove(null, 5_000)).toBe(false);
    expect(countsAsMove(1_000, 1_000 + MOVE_INTENT_MS)).toBe(true);
    expect(countsAsMove(1_000, 1_001 + MOVE_INTENT_MS)).toBe(false);
    expect(countsAsMove(2_000, 1_000)).toBe(false);
  });

  it("turns PDF.js's location into the saved position (0-based page, PDF user space, rounded zoom)", () => {
    expect(positionFromLocation({ pageNumber: 3, top: 640, left: 12 }, 1.23456)).toEqual({ pageIndex: 2, top: 640, left: 12, zoom: 1.235 });
    expect(positionFromLocation({ pageNumber: 1, top: Number.NaN, left: 0 }, 0)).toEqual({ pageIndex: 0, top: 0, left: 0, zoom: 1 });
  });
});

describe("where the reader opens", () => {
  it("restores the place inside the remembered page, at the reader's own zoom", () => {
    expect(openingTarget(3, { pageIndex: 2, top: 500, left: 20, zoom: 2 })).toEqual({
      pageNumber: 3,
      destArray: [null, { name: "XYZ" }, 20, 500, null],
    });
  });

  it("opens at the top of a page that ?page=N chose elsewhere, or when nothing is remembered", () => {
    expect(openingTarget(5, { pageIndex: 2, top: 500, left: 20, zoom: 2 })).toEqual({ pageNumber: 5, destArray: null });
    expect(openingTarget(1, null)).toEqual({ pageNumber: 1, destArray: null });
  });

  it("opens at the top of the page for a position that names only its page (the Text view's saves)", () => {
    // In PDF user space y grows upwards: the point (0, 0) is the bottom of the page, not its top.
    expect(openingTarget(2, { pageIndex: 1, top: 0, left: 0, zoom: 1 })).toEqual({ pageNumber: 2, destArray: null });
    expect(openingTarget(2, { pageIndex: 1, top: 0, left: 12, zoom: 1 }).destArray).not.toBeNull();
  });
});

describe("the position this tab last sent (for a reload right after a move)", () => {
  const ID = "00000000-0000-4000-8000-000000000001";
  const position = { pageIndex: 4, top: 612.5, left: 3, zoom: 1.2 };

  it("is used for the same Document while recent", () => {
    const entry = lastSentEntry(ID, position, 1_000);
    expect(lastSentPosition(entry, ID, 1_000 + LAST_SENT_MAX_AGE_MS)).toEqual(position);
  });

  it("is ignored for another Document, when old, from the future or malformed", () => {
    const entry = lastSentEntry(ID, position, 1_000);
    expect(lastSentPosition(entry, "00000000-0000-4000-8000-000000000002", 1_500)).toBeNull();
    expect(lastSentPosition(entry, ID, 1_001 + LAST_SENT_MAX_AGE_MS)).toBeNull();
    expect(lastSentPosition(entry, ID, 999)).toBeNull();
    expect(lastSentPosition(null, ID, 1_000)).toBeNull();
    expect(lastSentPosition("{not json", ID, 1_000)).toBeNull();
    expect(lastSentPosition(JSON.stringify({ assetId: ID, at: 1_000, position: { ...position, pageIndex: -1 } }), ID, 1_000)).toBeNull();
    expect(lastSentPosition(JSON.stringify({ assetId: ID, at: 1_000, position: { ...position, top: "1" } }), ID, 1_000)).toBeNull();
  });
});

describe("sending positions", () => {
  function harness() {
    let clock = 0;
    const sent: { body: Record<string, unknown>; keepalive: boolean; resolve: () => void }[] = [];
    const told: number[] = [];
    const sender = new PositionSender({
      assetId: "00000000-0000-4000-8000-000000000001",
      tab: "tab-12345678",
      now: () => clock,
      post: (body, keepalive) =>
        new Promise<void>((resolve) => {
          sent.push({ body: JSON.parse(body), keepalive, resolve });
        }),
      sent: (position) => told.push(position.pageIndex),
    });
    return { sender, sent, told, tick: (ms: number) => (clock += ms) };
  }

  it("sends how long ago the owner moved, numbered per tab, and nothing when there was no move", async () => {
    const { sender, sent, tick } = harness();
    sender.flush();
    expect(sent).toHaveLength(0);
    sender.moved({ pageIndex: 1, top: 700, left: 0, zoom: 1 });
    tick(1_250.6);
    sender.flush();
    expect(sent[0]!.body).toEqual({
      assetId: "00000000-0000-4000-8000-000000000001",
      position: { pageIndex: 1, top: 700, left: 0, zoom: 1 },
      changedAgoMs: 1_251,
      tab: "tab-12345678",
      seq: 1,
    });
    expect(sent[0]!.keepalive).toBe(false);
  });

  it("sends one request at a time: a move made meanwhile follows when the first ends, with the next number", async () => {
    const { sender, sent } = harness();
    sender.moved({ pageIndex: 1, top: 0, left: 0, zoom: 1 });
    sender.flush();
    sender.moved({ pageIndex: 2, top: 0, left: 0, zoom: 1 });
    sender.flush();
    expect(sent).toHaveLength(1);
    sent[0]!.resolve();
    await new Promise((r) => setTimeout(r, 0));
    expect(sent).toHaveLength(2);
    expect(sent[1]!.body.seq).toBe(2);
    expect((sent[1]!.body.position as { pageIndex: number }).pageIndex).toBe(2);
  });

  it("on page hide sends at once with keepalive, even while another save is in flight", () => {
    const { sender, sent, told } = harness();
    sender.moved({ pageIndex: 1, top: 0, left: 0, zoom: 1 });
    sender.flush();
    sender.moved({ pageIndex: 4, top: 0, left: 0, zoom: 1 });
    sender.flush(true);
    expect(sent.map((s) => [s.body.seq, s.keepalive])).toEqual([
      [1, false],
      [2, true],
    ]);
    expect(sender.hasPending()).toBe(false);
    // Every position sent is reported, so the reader can keep the latest for a reload.
    expect(told).toEqual([1, 4]);
  });
});
