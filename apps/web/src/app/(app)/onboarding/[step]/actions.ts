"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { saveStepOne } from "@corniversity/db/services/onboarding";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";

export interface StepState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

const StepOneInput = z.object({
  displayName: z.string().trim().min(1, "Please tell us what to call you.").max(80),
  timezone: z
    .string()
    .trim()
    .min(1)
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat("en-GB", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "That is not a recognised timezone."),
  immersion: z.enum(["quiet", "collegiate", "full"]),
  reducedMotion: z.boolean(),
  fontScale: z.coerce.number().min(0.875).max(1.5),
  highContrast: z.boolean(),
  accessibilityNotes: z.string().trim().max(1000).optional(),
});

export async function saveStepOneAction(_prev: StepState, formData: FormData): Promise<StepState> {
  const session = await requireSession("/onboarding/1");
  const parsed = StepOneInput.safeParse({
    displayName: formData.get("displayName"),
    timezone: formData.get("timezone"),
    immersion: formData.get("immersion"),
    reducedMotion: formData.get("reducedMotion") === "on",
    fontScale: formData.get("fontScale") ?? "1",
    highContrast: formData.get("highContrast") === "on",
    accessibilityNotes: formData.get("accessibilityNotes") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { fieldErrors };
  }
  await saveStepOne(db(), session.user.id, parsed.data);
  redirect("/onboarding/2");
}
