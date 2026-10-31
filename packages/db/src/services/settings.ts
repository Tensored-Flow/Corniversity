import { eq } from "drizzle-orm";
import type { DbOrTx } from "../client";
import { learnerProfile } from "../schema/index";

export type ProfileRow = typeof learnerProfile.$inferSelect;

export interface ProfilePatch {
  displayName?: string;
  timezone?: string;
  immersion?: ProfileRow["immersion"];
  socialLayerEnabled?: boolean;
  notifications?: ProfileRow["notifications"];
  theme?: ProfileRow["theme"];
  accessibility?: ProfileRow["accessibility"];
  weeklyHoursCeiling?: number | null;
  studyRhythm?: ProfileRow["studyRhythm"];
  goalsText?: string | null;
}

/** Settings edit the same baseline onboarding wrote; nothing is locked after orientation. */
export async function updateProfileSettings(db: DbOrTx, userId: string, patch: ProfilePatch): Promise<ProfileRow> {
  const values: Partial<typeof learnerProfile.$inferInsert> = {};
  if (patch.displayName !== undefined) values.displayName = patch.displayName.trim().slice(0, 80) || "Learner";
  if (patch.timezone !== undefined) values.timezone = patch.timezone;
  if (patch.immersion !== undefined) values.immersion = patch.immersion;
  if (patch.socialLayerEnabled !== undefined) values.socialLayerEnabled = patch.socialLayerEnabled;
  if (patch.notifications !== undefined) values.notifications = patch.notifications;
  if (patch.theme !== undefined) values.theme = patch.theme;
  if (patch.accessibility !== undefined) values.accessibility = patch.accessibility;
  if (patch.weeklyHoursCeiling !== undefined) values.weeklyHoursCeiling = patch.weeklyHoursCeiling;
  if (patch.studyRhythm !== undefined) values.studyRhythm = patch.studyRhythm;
  if (patch.goalsText !== undefined) values.goalsText = patch.goalsText;
  const [row] = await db.update(learnerProfile).set(values).where(eq(learnerProfile.userId, userId)).returning();
  if (!row) throw new Error("profile not found");
  return row;
}
