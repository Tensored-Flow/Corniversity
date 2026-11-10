import { randomUUID } from "node:crypto";
import { defaultContentRoot, loadContent } from "@corniversity/content/load";
import { seedContent } from "@corniversity/content/seed";
import { createDb } from "@corniversity/db/client";
import { user } from "@corniversity/db/schema/auth";
import { discussion, learnerProfile, peerMembership } from "@corniversity/db/schema/index";
import { CommunityError, openDiscussion, setPeerMembership } from "@corniversity/db/services/community";
import { ensureProfile } from "@corniversity/db/services/onboarding";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Discussion bounds with the seeded faculty and classmates: one chair and at most two peers,
 * muted peers never join, and with the social layer off classmates are refused while office hours
 * with faculty stay open.
 */
let handle: ReturnType<typeof createDb>;
const ownerId = `discussion-owner-${randomUUID().slice(0, 8)}`;
const chair = "halvard-brekke";
const [priya, rafael, wen] = ["peer-priya", "peer-rafael", "peer-wen"];

beforeAll(async () => {
  handle = createDb(process.env.DATABASE_URL!, { max: 2 });
  await seedContent(handle.db, loadContent(defaultContentRoot()));
  await handle.db.insert(user).values({ id: ownerId, name: "Discussion Owner", email: `${ownerId}@example.test` });
  await ensureProfile(handle.db, ownerId);
}, 120_000);

afterAll(async () => {
  await handle.db.delete(discussion).where(eq(discussion.ownerId, ownerId));
  await handle.db.delete(peerMembership).where(eq(peerMembership.ownerId, ownerId));
  await handle.db.delete(learnerProfile).where(eq(learnerProfile.userId, ownerId));
  await handle.db.delete(user).where(eq(user.id, ownerId));
  await handle.close();
});

describe("discussion bounds", () => {
  it("refuses a third classmate and admits two", async () => {
    await expect(
      openDiscussion(handle.db, ownerId, {
        kind: "seminar",
        title: "Charts",
        chairPersonaId: chair,
        peerPersonaIds: [priya!, rafael!, wen!],
      }),
    ).rejects.toThrow(CommunityError);
    const row = await openDiscussion(handle.db, ownerId, {
      kind: "seminar",
      title: "Charts",
      chairPersonaId: chair,
      peerPersonaIds: [priya!, rafael!],
    });
    expect(row.participantPersonaIds).toEqual([chair, priya, rafael]);
    expect(row.maxRounds).toBeLessThanOrEqual(6);
  });

  it("never adds a muted classmate", async () => {
    await setPeerMembership(handle.db, ownerId, wen!, { muted: true });
    const row = await openDiscussion(handle.db, ownerId, {
      kind: "seminar",
      title: "Metrics",
      chairPersonaId: chair,
      peerPersonaIds: [priya!, wen!],
    });
    expect(row.participantPersonaIds).toEqual([chair, priya]);
  });

  it("with the social layer off, refuses classmates but keeps office hours open", async () => {
    await handle.db.update(learnerProfile).set({ socialLayerEnabled: false }).where(eq(learnerProfile.userId, ownerId));
    await expect(
      openDiscussion(handle.db, ownerId, { kind: "seminar", title: "Geodesics", chairPersonaId: chair, peerPersonaIds: [priya!] }),
    ).rejects.toThrow(/social layer is off/);
    const office = await openDiscussion(handle.db, ownerId, { kind: "office_hours", title: "Office hours", chairPersonaId: chair });
    expect(office.participantPersonaIds).toEqual([chair]);
  });
});
