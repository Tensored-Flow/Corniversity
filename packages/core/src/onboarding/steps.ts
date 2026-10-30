/**
 * The twelve onboarding steps (brief §4.2). Progress is persisted after every step so the flow
 * is resumable; any step can be revisited and edited later from Settings.
 */
export interface OnboardingStepDef {
  number: number;
  slug: string;
  title: string;
  purpose: string;
}

export const ONBOARDING_STEPS: readonly OnboardingStepDef[] = [
  { number: 1, slug: "about-you", title: "About you", purpose: "Name, timezone, accessibility needs and how much campus life you want." },
  { number: 2, slug: "interests", title: "Departments and interests", purpose: "Choose departments and courses that interest you, and say what you want in your own words." },
  { number: 3, slug: "knowledge", title: "What you already know", purpose: "Describe existing knowledge; attach permitted evidence or prior syllabi if you like." },
  { number: 4, slug: "style", title: "How you like to learn", purpose: "Proof-led, conceptual, computational, experimental or mixed, chosen per subject." },
  { number: 5, slug: "time", title: "Time and workload", purpose: "Weekly availability and a workload ceiling, with a preview of what that buys." },
  { number: 6, slug: "rhythm", title: "Study rhythm", purpose: "Term-based, rolling self-paced, or a focused reading course." },
  { number: 7, slug: "placement", title: "Readiness checks", purpose: "Optional short checks; skip any and readiness is simply marked unverified." },
  { number: 8, slug: "plans", title: "First-term plans", purpose: "A few candidate plans with prerequisite explanations and workload estimates." },
  { number: 9, slug: "modes", title: "Enrol, audit or reading club", purpose: "Choose a mode for each course in the plan." },
  { number: 10, slug: "timetable", title: "Timetable and resources", purpose: "Review the proposed timetable, required resources and unresolved access needs." },
  { number: 11, slug: "confirm", title: "Confirm", purpose: "Confirm the plan and receive your welcome letter, handbook and first week." },
  { number: 12, slug: "meet", title: "Meet the college", purpose: "Your director, your teachers and, if you want them, two or three classmates." },
] as const;

export const ONBOARDING_STEP_COUNT = ONBOARDING_STEPS.length;

export function getOnboardingStep(number: number): OnboardingStepDef | undefined {
  return ONBOARDING_STEPS.find((s) => s.number === number);
}

export const TIMEZONE_SUGGESTIONS = [
  "Europe/London",
  "Europe/Dublin",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Zurich",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "UTC",
] as const;
