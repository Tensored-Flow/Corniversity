import { randomUUID } from "node:crypto";
import type { Database } from "@corniversity/db/client";
import { account, learnerProfile, user } from "@corniversity/db/schema/index";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";

export const DEMO_EMAIL = "demo@corniversity.invalid";
export const DEMO_PASSWORD = "demo-learner-not-a-real-person";

/**
 * A clearly labelled demo learner, separate from the owner's account. It never touches the
 * owner's records. Its name and email say what it is wherever they appear. It is only ever
 * seeded on request (`pnpm db:seed:demo`), never in production bootstrap.
 */
export async function seedDemoLearner(db: Database): Promise<{ created: boolean; email: string }> {
  const existing = await db.select({ id: user.id }).from(user).where(eq(user.email, DEMO_EMAIL)).limit(1);
  if (existing[0]) return { created: false, email: DEMO_EMAIL };
  const id = randomUUID();
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.insert(user).values({
      id,
      name: "Demo Learner (demo data)",
      email: DEMO_EMAIL,
      emailVerified: true,
      role: "demo",
      createdAt: now,
      updatedAt: now,
    });
    await tx.insert(account).values({
      id: randomUUID(),
      accountId: id,
      providerId: "credential",
      userId: id,
      password: await hashPassword(DEMO_PASSWORD),
      createdAt: now,
      updatedAt: now,
    });
    await tx.insert(learnerProfile).values({
      userId: id,
      displayName: "Demo Learner (demo data)",
      timezone: "Europe/London",
      immersion: "collegiate",
      onboardingStep: 12,
      onboardingCompletedAt: now,
      goalsText: "Demo account used to show the institution. Everything here is illustrative.",
    });
  });
  return { created: true, email: DEMO_EMAIL };
}
