import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "../client";
import { user } from "../schema/auth";
import { conversation } from "../schema/index";
import { getOrCreateConversation } from "./tutoring";

/**
 * A conversation that belongs to no learning session (the director's programme talk) must be
 * the same conversation every time the page opens; otherwise every reply vanishes into a fresh
 * empty thread.
 */
const OWNER = `tutoring-test-owner-${randomUUID()}`;
let handle: ReturnType<typeof createDb>;

beforeAll(async () => {
  handle = createDb(process.env.DATABASE_URL!, { max: 2 });
  await handle.db
    .insert(user)
    .values({ id: OWNER, name: "Tutoring Test", email: `${OWNER}@example.test` })
    .onConflictDoNothing();
});

afterAll(async () => {
  await handle.db.delete(conversation).where(eq(conversation.ownerId, OWNER));
  await handle.db.delete(user).where(eq(user.id, OWNER));
  await handle.close();
});

describe("getOrCreateConversation without a learning session", () => {
  it("continues the same director conversation on every visit", async () => {
    const first = await getOrCreateConversation(handle.db, {
      ownerId: OWNER,
      role: "director",
      purpose: "programme",
      allowedLocatorIds: [],
    });
    const second = await getOrCreateConversation(handle.db, {
      ownerId: OWNER,
      role: "director",
      purpose: "programme",
      allowedLocatorIds: [],
    });
    expect(second.id).toBe(first.id);
  });

  it("keeps conversations about different library items apart", async () => {
    const a = await getOrCreateConversation(handle.db, {
      ownerId: OWNER,
      role: "lecturer",
      purpose: "reading-room",
      allowedLocatorIds: [],
      allowedAssetIds: [randomUUID()],
    });
    const b = await getOrCreateConversation(handle.db, {
      ownerId: OWNER,
      role: "lecturer",
      purpose: "reading-room",
      allowedLocatorIds: [],
      allowedAssetIds: [randomUUID()],
    });
    expect(b.id).not.toBe(a.id);
  });
});
