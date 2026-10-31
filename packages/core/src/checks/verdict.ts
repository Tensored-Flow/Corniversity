/**
 * Reconciliation of an assessor's verdict with what the system actually knows. Every rule can
 * only lower confidence or route to review; none upgrades a verdict. The rules are pure so the
 * academic evaluation set can exercise them directly.
 */
export type Verdict = "accepted" | "revision_requested" | "needs_review";

export interface VerdictInput {
  verdict: Verdict;
  confidence: number;
  /** Whether a live model produced the verdict; fixtures demonstrate the shape of feedback only. */
  live: boolean;
  deterministic: { passed: boolean; detail: string }[];
}

export interface VerdictOutcome {
  verdict: Verdict;
  confidence: number;
  notes: string[];
}

export const FIXTURE_WITHHELD_NOTE =
  "No model has read this submission (fixture provider). The automatic checks ran; the verdict is withheld until a live assessor is configured in Settings.";

export function reconcileVerdict(input: VerdictInput): VerdictOutcome {
  let { verdict, confidence } = input;
  const notes: string[] = [];
  if (!input.live) {
    // No model has read the submission: a verdict that rewarded work nobody assessed would be a
    // false claim, so it is withheld and the evidence stays provisional.
    verdict = "needs_review";
    confidence = Math.min(confidence, 0.5);
    notes.push(FIXTURE_WITHHELD_NOTE);
  }
  const forbiddenFailed = input.deterministic.some((d) => !d.passed && /forbidden|not true in general/i.test(d.detail));
  if (verdict === "accepted" && forbiddenFailed) {
    verdict = "needs_review";
    confidence = Math.min(confidence, 0.4);
    notes.push("An automatic check flagged a claim that is not true in general; the acceptance is held for review.");
  }
  if (confidence < 0.6 && verdict !== "needs_review") {
    verdict = "needs_review";
    notes.push("The assessor's confidence is below the threshold, so this judgement is provisional.");
  }
  return { verdict, confidence, notes };
}
