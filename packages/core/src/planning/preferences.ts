/**
 * Study preferences. Defaults describe a new, unconfigured learner: rolling self-paced study,
 * one main course and at most one lighter exploratory course or reading seminar, weekly study
 * appointments, and no hard deadlines or examinations. They are defaults, never limits: every
 * key can be chosen explicitly, and an explicit choice always wins over a default.
 */
export type StudyRhythm = "rolling" | "term" | "reading_course";

export interface StudyPreferences {
  rhythm: StudyRhythm;
  /** Weekly study appointments on the timetable (reading, tutorials, problem sessions). */
  weeklyAppointments: boolean;
  /** Binding submission deadlines for assessed work, set by the learner. */
  hardDeadlines: boolean;
  /** Examinations as part of assessment. */
  examinations: boolean;
  /** Courses taken in full at once. */
  mainCourseLimit: number;
  /** Lighter courses (reading seminar or audit) alongside the main ones. */
  exploratoryLimit: number;
  /** When the learner looked at the workload preview for a load above the defaults (ISO instant). */
  heavierLoadPreviewedAt?: string;
}

export const DEFAULT_STUDY_PREFERENCES: Readonly<StudyPreferences> = Object.freeze({
  rhythm: "rolling",
  weeklyAppointments: true,
  hardDeadlines: false,
  examinations: false,
  mainCourseLimit: 1,
  exploratoryLimit: 1,
});

export const MAX_MAIN_COURSES = 4;
export const MAX_EXPLORATORY_COURSES = 3;

/** Only the keys the learner has actually chosen; nothing here is a default. */
export type ExplicitStudyPreferences = Partial<StudyPreferences>;

/** A stored value that is missing, undefined or null is unset; false and 0 are choices. */
const isChosen = (value: unknown) => value !== undefined && value !== null;

/**
 * The effective preferences: explicit choices first, then a rhythm chosen in the older single
 * field (it was always an explicit choice), then the defaults, which fill only what is unset.
 */
export function resolveStudyPreferences(
  explicit: ExplicitStudyPreferences | null | undefined,
  legacyRhythm?: StudyRhythm | null,
): StudyPreferences {
  const chosen = explicit ?? {};
  return {
    ...DEFAULT_STUDY_PREFERENCES,
    ...(legacyRhythm ? { rhythm: legacyRhythm } : {}),
    ...Object.fromEntries(Object.entries(chosen).filter(([, v]) => isChosen(v))),
  } as StudyPreferences;
}

/** Which keys are explicit (chosen) rather than defaults, for display. */
export function explicitKeys(
  explicit: ExplicitStudyPreferences | null | undefined,
  legacyRhythm?: StudyRhythm | null,
): (keyof StudyPreferences)[] {
  const keys = new Set(
    Object.entries(explicit ?? {})
      .filter(([, v]) => isChosen(v))
      .map(([k]) => k as keyof StudyPreferences),
  );
  if (legacyRhythm) keys.add("rhythm");
  return [...keys];
}

export class PreferenceError extends Error {}

/**
 * Applies a learner's change. Changing the rhythm changes only the rhythm: choosing term mode
 * never switches on examinations or deadlines, and choosing a timetable never creates deadlines.
 */
export function applyPreferenceChange(explicit: ExplicitStudyPreferences, change: ExplicitStudyPreferences): ExplicitStudyPreferences {
  const next: ExplicitStudyPreferences = { ...explicit };
  for (const [key, value] of Object.entries(change) as [keyof StudyPreferences, unknown][]) {
    if (value === undefined) continue;
    switch (key) {
      case "rhythm":
        if (value !== "rolling" && value !== "term" && value !== "reading_course") throw new PreferenceError("Unknown study rhythm.");
        next.rhythm = value;
        break;
      case "weeklyAppointments":
      case "hardDeadlines":
      case "examinations":
        if (typeof value !== "boolean") throw new PreferenceError(`${key} must be on or off.`);
        next[key] = value;
        break;
      case "mainCourseLimit":
        if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > MAX_MAIN_COURSES)
          throw new PreferenceError(`Main courses must be between 1 and ${MAX_MAIN_COURSES}.`);
        next.mainCourseLimit = value as number;
        break;
      case "exploratoryLimit":
        if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > MAX_EXPLORATORY_COURSES)
          throw new PreferenceError(`Exploratory courses must be between 0 and ${MAX_EXPLORATORY_COURSES}.`);
        next.exploratoryLimit = value as number;
        break;
      case "heavierLoadPreviewedAt":
        if (typeof value !== "string") throw new PreferenceError("Invalid preview time.");
        next.heavierLoadPreviewedAt = value;
        break;
    }
  }
  const raisesLoad =
    (change.mainCourseLimit ?? 0) > DEFAULT_STUDY_PREFERENCES.mainCourseLimit ||
    (change.exploratoryLimit ?? 0) > DEFAULT_STUDY_PREFERENCES.exploratoryLimit;
  if (raisesLoad && !next.heavierLoadPreviewedAt) {
    throw new PreferenceError("A heavier course load needs the workload preview first; open it, read it, then confirm.");
  }
  return next;
}

export interface LoadCheck {
  allowed: boolean;
  reason?: string;
}

/**
 * Whether one more active course fits the learner's chosen load. Enrolment itself is always an
 * explicit act; this only says whether it is within what the learner chose.
 */
export function checkCourseLoad(
  prefs: StudyPreferences,
  active: { main: number; exploratory: number },
  adding: "main" | "exploratory",
): LoadCheck {
  if (adding === "main" && active.main >= prefs.mainCourseLimit) {
    return {
      allowed: false,
      reason: `You chose ${prefs.mainCourseLimit} main course${prefs.mainCourseLimit === 1 ? "" : "s"} at a time and already take ${active.main}. Raise the limit in Settings after the workload preview, or pause a course first.`,
    };
  }
  if (adding === "exploratory" && active.exploratory >= prefs.exploratoryLimit) {
    return {
      allowed: false,
      reason: `You chose ${prefs.exploratoryLimit} lighter course${prefs.exploratoryLimit === 1 ? "" : "s"} alongside and already take ${active.exploratory}. Raise the limit in Settings, or pause one first.`,
    };
  }
  return { allowed: true };
}
