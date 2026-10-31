import { eq } from "drizzle-orm";
import type { DbOrTx } from "../client";
import { user } from "../schema/auth";
import { learnerProfile, type OnboardingAnswers } from "../schema/learner";

export type LearnerProfileRow = typeof learnerProfile.$inferSelect;

/** Creates the profile row on first contact so that onboarding state always has a home. */
export async function ensureProfile(db: DbOrTx, userId: string): Promise<LearnerProfileRow> {
  const existing = await db.select().from(learnerProfile).where(eq(learnerProfile.userId, userId)).limit(1);
  if (existing[0]) return existing[0];
  const [account] = await db.select({ name: user.name }).from(user).where(eq(user.id, userId)).limit(1);
  const [created] = await db
    .insert(learnerProfile)
    .values({ userId, displayName: account?.name ?? "Learner" })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [row] = await db.select().from(learnerProfile).where(eq(learnerProfile.userId, userId)).limit(1);
  if (!row) throw new Error("profile could not be created");
  return row;
}

export async function getProfile(db: DbOrTx, userId: string): Promise<LearnerProfileRow | null> {
  const rows = await db.select().from(learnerProfile).where(eq(learnerProfile.userId, userId)).limit(1);
  return rows[0] ?? null;
}

export interface StepOneInput {
  displayName: string;
  timezone: string;
  immersion: "quiet" | "collegiate" | "full";
  reducedMotion: boolean;
  fontScale: number;
  highContrast: boolean;
  accessibilityNotes?: string;
}

/**
 * Saves a step's answers and advances the resume pointer. The pointer only moves forward;
 * revisiting an earlier step and saving it never sends the learner backwards.
 */
export async function saveOnboardingStep(
  db: DbOrTx,
  userId: string,
  step: number,
  patch: Partial<OnboardingAnswers>,
  profilePatch: Partial<typeof learnerProfile.$inferInsert> = {},
): Promise<LearnerProfileRow> {
  const profile = await ensureProfile(db, userId);
  const answers: OnboardingAnswers = { ...profile.onboardingAnswers, ...patch };
  const nextStep = Math.max(profile.onboardingStep, Math.min(step + 1, 12));
  const [updated] = await db
    .update(learnerProfile)
    .set({ ...profilePatch, onboardingAnswers: answers, onboardingStep: nextStep })
    .where(eq(learnerProfile.userId, userId))
    .returning();
  if (!updated) throw new Error("profile vanished during update");
  return updated;
}

export async function saveStepOne(db: DbOrTx, userId: string, input: StepOneInput): Promise<LearnerProfileRow> {
  return saveOnboardingStep(
    db,
    userId,
    1,
    {},
    {
      displayName: input.displayName,
      timezone: input.timezone,
      immersion: input.immersion,
      socialLayerEnabled: input.immersion !== "quiet",
      accessibility: {
        reducedMotion: input.reducedMotion,
        fontScale: input.fontScale,
        highContrast: input.highContrast,
        notes: input.accessibilityNotes,
      },
    },
  );
}

export async function completeOnboarding(db: DbOrTx, userId: string): Promise<void> {
  await db.update(learnerProfile).set({ onboardingCompletedAt: new Date(), onboardingStep: 12 }).where(eq(learnerProfile.userId, userId));
}
