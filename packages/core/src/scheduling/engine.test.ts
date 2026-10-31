import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { diffPlans, estimateWeeklyMinutes, missedSessions, schedule, sessionUid } from "./engine";
import { buildIcs, escapeIcsText, foldIcsLine } from "./ics";
import type { PlanActivity, SchedulerInput } from "./types";

const ZONE = "Europe/London";

function activities(enrolmentId: string, courseId: string, units: number, perUnitMinutes = [60, 75, 15]): PlanActivity[] {
  const out: PlanActivity[] = [];
  for (let u = 1; u <= units; u++) {
    const unitId = `${courseId}-u${String(u).padStart(2, "0")}`;
    const lecture = `${unitId}:a1`;
    const tutorial = `${unitId}:a2`;
    const oral = `${unitId}:a3`;
    const prevTutorial = u > 1 ? `${courseId}-u${String(u - 1).padStart(2, "0")}:a2` : null;
    out.push(
      { key: lecture, enrolmentId, courseId, unitId, unitSequence: u, activityId: "a1", title: `Unit ${u} lecture`, sessionKind: "lecture", estimatedMinutes: perUnitMinutes[0]!, dependsOn: prevTutorial ? [prevTutorial] : [], earliestWeek: u - 1 },
      { key: tutorial, enrolmentId, courseId, unitId, unitSequence: u, activityId: "a2", title: `Unit ${u} tutorial`, sessionKind: "tutorial", estimatedMinutes: perUnitMinutes[1]!, dependsOn: [lecture], earliestWeek: u - 1 },
      { key: oral, enrolmentId, courseId, unitId, unitSequence: u, activityId: "a3", title: `Unit ${u} explain-back`, sessionKind: "oral", estimatedMinutes: perUnitMinutes[2]!, dependsOn: [tutorial], earliestWeek: u - 1 },
    );
  }
  return out;
}

function baseInput(overrides: Partial<SchedulerInput> = {}): SchedulerInput {
  return {
    timezone: ZONE,
    term: { startDate: "2026-11-02", teachingWeeks: 10, readingWeek: true, synthesisWeek: true },
    // Weekday evenings 19:00–22:00, Saturday 10:00–13:00.
    availability: [
      { weekday: 1, startMinute: 19 * 60, endMinute: 22 * 60 },
      { weekday: 2, startMinute: 19 * 60, endMinute: 22 * 60 },
      { weekday: 3, startMinute: 19 * 60, endMinute: 22 * 60 },
      { weekday: 4, startMinute: 18 * 60, endMinute: 22 * 60 },
      { weekday: 6, startMinute: 10 * 60, endMinute: 13 * 60 },
    ],
    commitments: [{ id: "algo", title: "Algocourse", weekday: 4, startMinute: 18 * 60, endMinute: 20 * 60, protected: true }],
    daysOff: ["2026-11-10"],
    courses: [{ enrolmentId: "e1", courseId: "MAT-230", title: "Functional Analysis I", priority: 1, activities: activities("e1", "MAT-230", 4) }],
    weeklyCapMinutes: 8 * 60,
    preferredSessionMinutes: 60,
    minSessionMinutes: 30,
    breakMinutes: 10,
    ...overrides,
  };
}

function local(iso: string) {
  return DateTime.fromISO(iso, { zone: ZONE });
}

describe("schedule", () => {
  it("places every activity when there is room, with no overlaps and inside availability", () => {
    const result = schedule(baseInput());
    expect(result.feasible).toBe(true);
    expect(result.unplaced).toEqual([]);
    const sessions = result.sessions;
    expect(sessions.length).toBeGreaterThan(0);
    for (let i = 0; i < sessions.length; i++) {
      const a = sessions[i]!;
      const start = local(a.startsAt);
      const end = local(a.endsAt);
      // inside an availability window on that weekday
      const windows = baseInput().availability.filter((w) => w.weekday === start.weekday);
      const minuteStart = start.hour * 60 + start.minute;
      const minuteEnd = end.hour * 60 + end.minute;
      expect(windows.some((w) => minuteStart >= w.startMinute && minuteEnd <= w.endMinute)).toBe(true);
      // never on the day off
      expect(start.toISODate()).not.toBe("2026-11-10");
      // never inside the protected commitment (Thursday 18:00–20:00 plus 10-minute buffer)
      if (start.weekday === 4) expect(minuteStart).toBeGreaterThanOrEqual(20 * 60 + 10);
      for (let j = i + 1; j < sessions.length; j++) {
        const b = sessions[j]!;
        expect(a.startsAt < b.endsAt && b.startsAt < a.endsAt).toBe(false);
      }
    }
  });

  it("respects dependencies: lecture before tutorial before explain-back, units in order", () => {
    const result = schedule(baseInput());
    const end = (key: string) => Math.max(...result.sessions.filter((s) => s.key === key).map((s) => Date.parse(s.endsAt)));
    const start = (key: string) => Math.min(...result.sessions.filter((s) => s.key === key).map((s) => Date.parse(s.startsAt)));
    for (let u = 1; u <= 4; u++) {
      const unit = `MAT-230-u0${u}`;
      expect(start(`${unit}:a2`)).toBeGreaterThanOrEqual(end(`${unit}:a1`));
      expect(start(`${unit}:a3`)).toBeGreaterThanOrEqual(end(`${unit}:a2`));
      if (u > 1) expect(start(`${unit}:a1`)).toBeGreaterThanOrEqual(end(`MAT-230-u0${u - 1}:a2`));
    }
  });

  it("spreads a unit over different days: a tutorial never follows its lecture on the same evening", () => {
    const result = schedule(baseInput());
    const byKey = (key: string) => result.sessions.find((s) => s.key === key)!;
    const lecture = local(byKey("MAT-230-u01:a1").startsAt);
    const tutorial = local(byKey("MAT-230-u01:a2").startsAt);
    expect(tutorial.diff(lecture, "hours").hours).toBeGreaterThanOrEqual(18);
    for (const day of new Set(result.sessions.map((s) => local(s.startsAt).toISODate()))) {
      const minutes = result.sessions.filter((s) => local(s.startsAt).toISODate() === day).reduce((a, s) => a + s.minutes, 0);
      expect(minutes).toBeLessThanOrEqual(180);
    }
  });

  it("never exceeds the weekly cap and splits long activities into parts", () => {
    const input = baseInput({
      weeklyCapMinutes: 3 * 60,
      courses: [{ enrolmentId: "e1", courseId: "MAT-230", title: "FA", priority: 1, activities: activities("e1", "MAT-230", 2, [150, 60, 15]) }],
    });
    const result = schedule(input);
    for (const w of result.weekly) expect(w.plannedMinutes).toBeLessThanOrEqual(w.capMinutes);
    const lectureParts = result.sessions.filter((s) => s.key === "MAT-230-u01:a1");
    expect(lectureParts.map((p) => p.minutes)).toEqual([60, 60, 30]);
    expect(lectureParts[0]?.title).toContain("part 1 of 3");
  });

  it("is deterministic", () => {
    const a = JSON.stringify(schedule(baseInput()));
    const b = JSON.stringify(schedule(baseInput()));
    expect(a).toBe(b);
  });

  it("reports infeasibility with a shortfall and concrete suggestions instead of violating constraints", () => {
    const input = baseInput({
      courses: [
        { enrolmentId: "e1", courseId: "MAT-230", title: "FA", priority: 1, activities: activities("e1", "MAT-230", 12, [180, 180, 60]) },
        { enrolmentId: "e2", courseId: "MAT-261", title: "Manifolds", priority: 2, activities: activities("e2", "MAT-261", 12, [180, 180, 60]) },
      ],
      weeklyCapMinutes: 5 * 60,
    });
    const result = schedule(input);
    expect(result.feasible).toBe(false);
    expect(result.unplaced.length).toBeGreaterThan(0);
    expect(result.shortfallMinutes).toBeGreaterThan(0);
    expect(result.suggestions.length).toBeGreaterThanOrEqual(3);
    for (const w of result.weekly) expect(w.plannedMinutes).toBeLessThanOrEqual(w.capMinutes);
    // Higher-priority course gets placed first.
    expect(result.sessions.some((s) => s.courseId === "MAT-230")).toBe(true);
  });

  it("keeps local wall-clock times across the autumn daylight-saving change", () => {
    // Term starting before the clocks go back on 25 October 2026 in Europe/London.
    const input = baseInput({
      term: { startDate: "2026-10-19", teachingWeeks: 2, readingWeek: false, synthesisWeek: false },
      daysOff: [],
      availability: [{ weekday: 1, startMinute: 19 * 60, endMinute: 20 * 60 }],
      commitments: [],
      courses: [
        {
          enrolmentId: "e1",
          courseId: "MAT-230",
          title: "FA",
          priority: 1,
          activities: [
            { key: "u1:a", enrolmentId: "e1", courseId: "MAT-230", unitId: "u1", unitSequence: 1, activityId: "a", title: "A", sessionKind: "lecture", estimatedMinutes: 60, dependsOn: [], earliestWeek: 0 },
            { key: "u2:a", enrolmentId: "e1", courseId: "MAT-230", unitId: "u2", unitSequence: 2, activityId: "a", title: "B", sessionKind: "lecture", estimatedMinutes: 60, dependsOn: ["u1:a"], earliestWeek: 1 },
          ],
        },
      ],
    });
    const result = schedule(input);
    expect(result.sessions).toHaveLength(2);
    const [first, second] = result.sessions;
    expect(local(first!.startsAt).toFormat("HH:mm")).toBe("19:00");
    expect(local(second!.startsAt).toFormat("HH:mm")).toBe("19:00");
    // UTC offsets differ (BST then GMT), so the UTC hours differ by one.
    expect(DateTime.fromISO(first!.startsAt, { zone: "utc" }).hour).toBe(18);
    expect(DateTime.fromISO(second!.startsAt, { zone: "utc" }).hour).toBe(19);
  });

  it("gives stable uids and a readable diff when re-planning moves a session", () => {
    const first = schedule(baseInput());
    const second = schedule(baseInput({ daysOff: ["2026-11-10", "2026-11-02"] })); // Monday of week 1 removed
    expect(first.sessions[0]?.uid).toBe(sessionUid("e1", "MAT-230-u01:a1", 1));
    const diff = diffPlans(first.sessions, second.sessions);
    expect(diff.added.length + diff.moved.length + diff.unchanged + diff.removed.length).toBeGreaterThan(0);
    expect(diff.moved.length).toBeGreaterThan(0);
    expect(new Set(second.sessions.map((s) => s.uid)).size).toBe(second.sessions.length);
  });

  it("keeps pinned future sessions in place when they still fit", () => {
    const first = schedule(baseInput());
    const pinned = first.sessions.map((s) => ({ uid: s.uid, startsAt: s.startsAt, endsAt: s.endsAt }));
    const replanned = schedule(baseInput({ pinned }));
    const diff = diffPlans(first.sessions, replanned.sessions);
    expect(diff.moved).toEqual([]);
    expect(diff.unchanged).toBe(first.sessions.length);
  });

  it("identifies missed sessions and estimates weekly minutes", () => {
    const result = schedule(baseInput());
    const withStatus = result.sessions.map((s) => ({ ...s, status: "planned" }));
    const missed = missedSessions(withStatus, "2026-11-09T00:00:00Z");
    expect(missed.length).toBeGreaterThan(0);
    expect(missed.every((m) => m.endsAt < "2026-11-09T00:00:00Z")).toBe(true);
    const minutes = estimateWeeklyMinutes(baseInput().availability, baseInput().commitments, 10);
    // 3h Mon–Wed (540) + Thu 18–22 minus Algocourse 18–20 with 10-min buffer (110) + Sat 180 = 830
    expect(minutes).toBe(830);
  });
});

describe("ics", () => {
  it("escapes text and folds long lines", () => {
    expect(escapeIcsText("a,b;c\\d\nx")).toBe("a\\,b\\;c\\\\d\\nx");
    const folded = foldIcsLine(`SUMMARY:${"x".repeat(100)}`);
    const lines = folded.split("\r\n");
    expect(lines.length).toBe(2);
    expect(Buffer.byteLength(lines[0]!, "utf8")).toBeLessThanOrEqual(75);
    expect(lines[1]!.startsWith(" ")).toBe(true);
  });

  it("emits a valid calendar with UTC times and stable uids", () => {
    const result = schedule(baseInput());
    const ics = buildIcs(result.sessions.slice(0, 2), { calendarName: "Corniversity", detail: "full", baseUrl: "https://example.test", dtstamp: "2026-10-30T12:00:00Z" });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBe(2);
    expect(ics).toContain(`UID:${escapeIcsText(result.sessions[0]!.uid)}`);
    expect(ics).toMatch(/DTSTART:\d{8}T\d{6}Z/);
    expect(ics).toContain("URL:https://example.test/courses/MAT-230/units/MAT-230-u01");
    const minimal = buildIcs(result.sessions.slice(0, 1), { calendarName: "C", detail: "minimal", dtstamp: "2026-10-30T12:00:00Z" });
    expect(minimal).toContain("SUMMARY:Corniversity study session");
    expect(minimal).not.toContain("DESCRIPTION");
  });
});
