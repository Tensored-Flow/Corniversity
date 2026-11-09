import {
  CONDITIONS,
  type Condition,
  compareModels,
  DEFAULT_SETTINGS,
  generateBimodalTrials,
  generateTrials,
  type InformationContract,
  ORIENTATIONS,
  runTransfer,
  splitByOrientation,
  splitTrials,
  TUNING_SPLIT_CONTRACT,
  TUNING_SPLITS,
  type TuningSplitKind,
} from "@corniversity/core/labs/index";
import { describe, expect, it } from "vitest";
import { defaultContentRoot, loadContent } from "./load";

/**
 * Regression cases for repaired academic content. Each pins a corrected statement to the text
 * that now carries it and, where the statement is about a laboratory, to that laboratory's own
 * output, so the error cannot return through either the words or the code.
 */
const bundle = loadContent(defaultContentRoot());

function unit(courseId: string, unitId: string) {
  const found = bundle.courses.find((c) => c.spec.id === courseId)?.units.find((u) => u.spec.id === unitId);
  if (!found) throw new Error(`${unitId} is missing from the catalogue`);
  return found;
}
function exercise(courseId: string, unitId: string, exerciseId: string) {
  const found = unit(courseId, unitId).exercises.find((e) => e.id === exerciseId);
  if (!found) throw new Error(`${exerciseId} is missing from the catalogue`);
  return found;
}
function instructorNote(courseId: string, unitId: string, file: string): string {
  const found = unit(courseId, unitId).instructor.find((a) => a.file === file);
  if (!found) throw new Error(`${file} is missing from ${unitId}`);
  return found.markdown;
}
const rubricText = (e: ReturnType<typeof exercise>) =>
  e.rubric.criteria.map((c) => [c.criterion, ...c.levels.map((l) => l.description)].join(" ")).join("\n");

describe("COG-260: what biased responding predicts about repeats", () => {
  // The simulation's side of this claim is pinned in core's choice-models tests.
  const lesson = unit("COG-260", "COG-260-u01").lessonMarkdown;

  it("no longer says the repeat probability is the same after a reward as after none", () => {
    expect(lesson).not.toMatch(/same repeat probability after a reward as after no reward/i);
    expect(lesson).not.toMatch(/biased responding predicts the same repeat/i);
  });

  it("holds the previous choice fixed, and reads the split by reward together with the split by arm", () => {
    const claim = lesson.split("\n").find((line) => line.startsWith("- **Biased responding**"));
    expect(claim).toMatch(/makes no difference once the previous choice is held fixed/);
    expect(claim).toMatch(/Split by reward alone, the repeat probabilities still differ whenever/);
    expect(claim).toMatch(/together with the split by arm/);
  });
});

describe("COG-250: the transfer exercise asks only for what the laboratory reports", () => {
  const prompt = exercise("COG-250", "COG-250-u01", "COG-250-u01-ex2").promptMarkdown;

  it("asks for windows and episodes that the default run contains, in every condition", () => {
    const asked = /mean gap \(cached minus planner\) over the first ([\d, and]+) episodes/.exec(prompt)?.[1] ?? "";
    const windows = asked
      .split(/,|\band\b/)
      .map((w) => Number(w.trim()))
      .filter((w) => w > 0);
    expect(windows).toEqual([1, 2, 3, 12]);
    expect(prompt).toContain("its moves and bumps in the first three test episodes");
    for (const condition of Object.keys(CONDITIONS) as Condition[]) {
      const run = runTransfer(condition, DEFAULT_SETTINGS, 1);
      expect(run.shortestBefore).toBeGreaterThan(0);
      expect(run.shortestAfter).toBeGreaterThan(0);
      for (const k of windows) expect(Number.isFinite(run.gapByWindow[k - 1])).toBe(true);
      for (const episodes of [run.planner, run.cached]) {
        expect(episodes.length).toBeGreaterThanOrEqual(3);
        expect(episodes[0]?.firstAction).not.toBeNull();
      }
    }
  });

  it("states the laboratory's own settings and seed in its contract", () => {
    expect(prompt).toContain("at its default settings and seed 1");
    expect(prompt).toContain(`${DEFAULT_SETTINGS.trainingEpisodes} training episodes in the world before the change`);
    expect(prompt).toContain(`an episode stops at ${DEFAULT_SETTINGS.stepCap} moves`);
  });
});

describe("COG-250: the critique rubric reads its own invented study correctly", () => {
  const ex3 = exercise("COG-250", "COG-250-u01", "COG-250-u01-ex3");

  it("the study fits its model to the training data, and the rubric says so", () => {
    expect(ex3.promptMarkdown).toContain("a Q-learning model fitted to their training data");
    expect(rubricText(ex3)).toContain("fitted to the training episodes");
  });

  it("never calls that comparison in-sample; the instructor notes name that reading as a misreading", () => {
    expect(rubricText(ex3)).not.toMatch(/in[- ]sample/i);
    expect(instructorNote("COG-250", "COG-250-u01", "COG-250-u01-ex3.grading-notes.md")).toMatch(/held out in time/);
    for (const note of unit("COG-250", "COG-250-u01").instructor) {
      for (const line of note.markdown.split("\n").filter((l) => /in[- ]sample/i.test(l))) expect(line, note.file).toMatch(/misread/);
    }
  });
});

describe("NEU-220: the tuning laboratory's evaluation questions", () => {
  const u = unit("NEU-220", "NEU-220-u02");
  const ex3 = exercise("NEU-220", "NEU-220-u02", "NEU-220-u02-ex3");

  /** The numbered items that follow a contract heading in the prompt, by number. */
  function contractAfter(heading: string): Map<number, string> {
    const lines = ex3.promptMarkdown.split("\n");
    const start = lines.indexOf(heading);
    expect(start, heading).toBeGreaterThanOrEqual(0);
    const items = new Map<number, string>();
    for (const line of lines.slice(start + 1)) {
      if (!line.trim()) continue;
      const item = /^(\d+)\. \*\*[^*]+:\*\* (.*)$/.exec(line);
      if (!item) break;
      items.set(Number(item[1]), item[2]!);
    }
    return items;
  }
  const asWritten = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
  function expectAgreement(items: Map<number, string>, c: InformationContract) {
    expect(items.size).toBe(10);
    expect(items.get(1)).toBe(asWritten(c.observed));
    expect(items.get(2)).toBe(asWritten(c.target));
    expect(items.get(3)).toBe(asWritten(c.historyInTraining));
    expect(items.get(4)).toBe(asWritten(c.historyAtInference));
    expect(items.get(5)?.startsWith(c.person === "not_applicable" ? "not applicable" : c.person)).toBe(true);
    expect(items.get(6)?.startsWith(`${c.task};`)).toBe(true);
    expect(items.get(7)?.startsWith(c.laterPeriods ? "yes;" : "no;")).toBe(true);
    expect(items.get(8)).toBe(asWritten(c.unavailableInRealUse));
    expect(items.get(9)).toBe(asWritten(c.baseline));
    expect(items.get(10)).toBe(asWritten(c.untestedClaims));
  }

  it("asks each of the laboratory's two questions, word for word", () => {
    for (const kind of Object.keys(TUNING_SPLITS) as TuningSplitKind[]) {
      expect(ex3.promptMarkdown).toContain(TUNING_SPLITS[kind].question);
    }
  });

  it("states each split's information contract exactly as the laboratory shows it", () => {
    expectAgreement(
      contractAfter("**The information contract for the held-out-trials comparison in section 2.**"),
      TUNING_SPLIT_CONTRACT.held_out_trials,
    );
    expectAgreement(
      contractAfter("**The information contract for the held-out-orientation comparison in section 2.**"),
      TUNING_SPLIT_CONTRACT.held_out_orientation,
    );
  });

  it("builds the splits those contracts describe", () => {
    const trials = generateTrials({ b: 2, A: 10, kappa: 2, thetaPref: 65 }, 32, 1, 42);
    const byTrial = splitTrials(trials);
    for (const theta of ORIENTATIONS) {
      // Three of every four repetitions train; every orientation is in both sets.
      expect(byTrial.train.filter((t) => t.thetaDegrees === theta)).toHaveLength(24);
      expect(byTrial.test.filter((t) => t.thetaDegrees === theta)).toHaveLength(8);
      const byOrientation = splitByOrientation(trials, theta);
      expect(byOrientation.train.some((t) => t.thetaDegrees === theta)).toBe(false);
      expect(byOrientation.test.every((t) => t.thetaDegrees === theta)).toBe(true);
    }
  });

  it("grades the two splits as different questions, in a new rubric version", () => {
    expect(ex3.rubric.version).toBe(2);
    const comparison = ex3.rubric.criteria.find((c) => c.id === "comparison");
    expect(comparison?.criterion).toMatch(/a held-out-orientation result reported and kept distinct/);
    expect(comparison?.levels.find((l) => l.label === "partially met")?.description).toMatch(
      /a win on held-out trials presented as generalisation to unseen orientations/,
    );
  });

  it("says in the lesson and the laboratory instructions what each split asks", () => {
    expect(u.lessonMarkdown).toMatch(/holds out every fourth repetition of each orientation/);
    expect(u.lessonMarkdown).toMatch(/holds out every trial of one orientation/);
    expect(u.lessonMarkdown).toMatch(/they are not interchangeable/);
    const lab = u.spec.activities.find((a) => a.type === "lab");
    expect(lab?.instructions).toMatch(/hold out one whole orientation and compare them again, keeping the two results apart/);
  });

  it("tells instructors what the laboratory does: the failure case is ahead on one split and behind on the other", () => {
    const failure = generateBimodalTrials(30, 1, 42);
    const trialsSplit = splitTrials(failure);
    expect(compareModels(trialsSplit.train, trialsSplit.test, 1).heldOutAdvantagePerTrial).toBeGreaterThan(0);
    for (const theta of ORIENTATIONS) {
      const s = splitByOrientation(failure, theta);
      expect(compareModels(s.train, s.test, 1).heldOutAdvantagePerTrial).toBeLessThan(0);
    }
    expect(instructorNote("NEU-220", "NEU-220-u02", "NEU-220-u02-ex3.grading-notes.md")).toMatch(
      /narrowly ahead on held-out trials and behind the baseline at every held-out orientation/,
    );
  });
});
