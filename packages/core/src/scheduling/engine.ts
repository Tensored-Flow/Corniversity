import { DateTime } from "luxon";
import type {
  AvailabilityWindow,
  Commitment,
  PlanActivity,
  PlanDiff,
  ScheduledSessionPlan,
  ScheduleResult,
  SchedulerInput,
  UnplacedActivity,
  WeekSummary,
} from "./types";

interface Slot {
  start: DateTime; // zoned
  end: DateTime;
  weekIndex: number;
}

interface Week {
  index: number;
  start: DateTime; // zoned, start of day
  label: string;
  schedulable: boolean;
}

/** Stable identifier for one part of one activity; survives re-planning. */
export function sessionUid(enrolmentId: string, activityKey: string, part: number): string {
  return `${enrolmentId}:${activityKey}:${part}@corniversity`;
}

function buildWeeks(input: SchedulerInput): Week[] {
  const start = DateTime.fromISO(input.term.startDate, { zone: input.timezone }).startOf("day");
  const weeks: Week[] = [];
  let index = 0;
  for (let i = 0; i < input.term.teachingWeeks; i++) {
    weeks.push({ index, start: start.plus({ weeks: i }), label: `Teaching week ${i + 1}`, schedulable: true });
    index++;
  }
  if (input.term.readingWeek) {
    weeks.push({ index, start: start.plus({ weeks: index }), label: "Reading week", schedulable: true });
    index++;
  }
  if (input.term.synthesisWeek) {
    weeks.push({ index, start: start.plus({ weeks: index }), label: "Synthesis week", schedulable: true });
    index++;
  }
  return weeks;
}

/** Subtracts [bStart, bEnd) from a list of [start, end) minute intervals. */
function subtract(intervals: [number, number][], bStart: number, bEnd: number): [number, number][] {
  const out: [number, number][] = [];
  for (const [s, e] of intervals) {
    if (bEnd <= s || bStart >= e) {
      out.push([s, e]);
      continue;
    }
    if (bStart > s) out.push([s, bStart]);
    if (bEnd < e) out.push([bEnd, e]);
  }
  return out;
}

/**
 * Free slots for one local day: availability windows for that weekday minus commitments
 * (recurring or dated) minus a break buffer around each commitment; days off have none.
 */
export function freeSlotsForDay(day: DateTime, input: SchedulerInput, weekIndex: number): Slot[] {
  const iso = day.toISODate();
  if (!iso || input.daysOff.includes(iso)) return [];
  const weekday = day.weekday as AvailabilityWindow["weekday"];
  let intervals: [number, number][] = input.availability
    .filter((w) => w.weekday === weekday && w.endMinute > w.startMinute)
    .map((w) => [w.startMinute, w.endMinute] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  const applies = (c: Commitment) => (c.date ? c.date === iso : c.weekday === weekday);
  for (const c of input.commitments.filter(applies)) {
    intervals = subtract(intervals, c.startMinute - input.breakMinutes, c.endMinute + input.breakMinutes);
  }
  return intervals
    .filter(([s, e]) => e - s >= input.minSessionMinutes)
    .map(([s, e]) => ({
      start: day.startOf("day").plus({ minutes: s }),
      end: day.startOf("day").plus({ minutes: e }),
      weekIndex,
    }));
}

function orderActivities(input: SchedulerInput): PlanActivity[] {
  // Deterministic interleave: by earliest week, then course priority, then unit sequence, then
  // declared order within the unit. Dependencies are enforced at placement time.
  const all: { a: PlanActivity; priority: number; order: number }[] = [];
  const courses = [...input.courses].sort((x, y) => x.priority - y.priority || x.courseId.localeCompare(y.courseId));
  courses.forEach((c, ci) => {
    c.activities.forEach((a, ai) => {
      all.push({ a, priority: ci, order: ai });
    });
  });
  all.sort(
    (x, y) =>
      x.a.earliestWeek - y.a.earliestWeek ||
      x.a.unitSequence - y.a.unitSequence ||
      x.priority - y.priority ||
      x.order - y.order ||
      x.a.key.localeCompare(y.a.key),
  );
  return all.map((x) => x.a);
}

function splitMinutes(total: number, preferred: number, minimum: number): number[] {
  if (total <= preferred) return [total];
  const parts: number[] = [];
  let remaining = total;
  while (remaining > 0) {
    if (remaining <= preferred) {
      parts.push(remaining);
      break;
    }
    parts.push(preferred);
    remaining -= preferred;
    if (remaining > 0 && remaining < minimum) {
      // fold a too-short tail into the previous part
      parts[parts.length - 1] = (parts[parts.length - 1] ?? 0) + remaining;
      remaining = 0;
    }
  }
  return parts;
}

/**
 * Greedy, deterministic placement. For each activity in order, each part is placed in the
 * earliest free slot that (a) starts at or after the activity's earliest week and after every
 * dependency's last part, (b) leaves the week under its cap, and (c) does not overlap a
 * previously placed session. A pinned future session for the same uid is kept when it still
 * satisfies those conditions, which limits churn when re-planning.
 */
export function schedule(input: SchedulerInput): ScheduleResult {
  const zone = input.timezone;
  const weeks = buildWeeks(input);
  const notBefore: DateTime = input.notBefore
    ? DateTime.fromISO(input.notBefore, { zone })
    : DateTime.fromISO(input.term.startDate, { zone }).startOf("day");

  // Precompute free slots for every day of the term.
  const slotsByWeek = new Map<number, Slot[]>();
  for (const week of weeks) {
    const slots: Slot[] = [];
    for (let d = 0; d < 7; d++) {
      slots.push(...freeSlotsForDay(week.start.plus({ days: d }), input, week.index));
    }
    slotsByWeek.set(week.index, slots);
  }

  const placed: ScheduledSessionPlan[] = [];
  const unplaced: UnplacedActivity[] = [];
  const weekPlanned = new Map<number, number>(weeks.map((w) => [w.index, 0]));
  const dayPlanned = new Map<string, number>();
  const dailyCap = input.dailyCapMinutes ?? 180;
  const dayKey = (dt: DateTime) => dt.toISODate() ?? "";
  const finishedAt = new Map<string, DateTime>(); // activity key → end of its last part
  const occupied: { start: DateTime; end: DateTime }[] = [];
  const pinned = new Map((input.pinned ?? []).map((p) => [p.uid, p]));

  const overlaps = (s: DateTime, e: DateTime) => occupied.some((o) => s < o.end && e > o.start);

  const activities = orderActivities(input);
  const byKey = new Map(activities.map((a) => [a.key, a]));

  for (const activity of activities) {
    const parts = splitMinutes(activity.estimatedMinutes, input.preferredSessionMinutes, input.minSessionMinutes);
    let earliest: DateTime = notBefore;
    const earliestWeekStart: DateTime = weeks[activity.earliestWeek]?.start ?? weeks[weeks.length - 1]?.start ?? notBefore;
    if (earliestWeekStart > earliest) earliest = earliestWeekStart;
    let blocked: string | null = null;
    const gap = input.minDependencyGapMinutes ?? 18 * 60;
    for (const dep of activity.dependsOn) {
      const end = finishedAt.get(dep);
      if (!end) {
        if (byKey.has(dep)) blocked = dep; // dependency exists but could not be placed (or comes later in order)
        continue;
      }
      const afterGap = end.plus({ minutes: gap });
      if (afterGap > earliest) earliest = afterGap;
    }
    if (blocked) {
      unplaced.push({
        key: activity.key,
        title: activity.title,
        minutes: activity.estimatedMinutes,
        reason: `waits for ${blocked}, which could not be scheduled`,
      });
      continue;
    }

    let allPlaced = true;
    const partsPlaced: ScheduledSessionPlan[] = [];
    for (let p = 0; p < parts.length; p++) {
      const minutes = parts[p]!;
      const uid = sessionUid(activity.enrolmentId, activity.key, p + 1);

      // Keep a pinned session when it still fits.
      const pin = pinned.get(uid);
      if (pin) {
        const ps = DateTime.fromISO(pin.startsAt, { zone });
        const pe = DateTime.fromISO(pin.endsAt, { zone });
        const weekIndex = weeks.find((w) => ps >= w.start && ps < w.start.plus({ weeks: 1 }))?.index;
        const fitsCap =
          weekIndex !== undefined &&
          (weekPlanned.get(weekIndex) ?? 0) + minutes <= input.weeklyCapMinutes &&
          (dayPlanned.get(dayKey(ps)) ?? 0) + minutes <= dailyCap;
        const inFreeSlot = weekIndex !== undefined && (slotsByWeek.get(weekIndex) ?? []).some((s) => ps >= s.start && pe <= s.end);
        if (ps >= earliest && fitsCap && inFreeSlot && !overlaps(ps, pe) && pe.diff(ps, "minutes").minutes === minutes) {
          const session = toSession(activity, uid, ps, pe, weekIndex, p + 1, parts.length, minutes);
          partsPlaced.push(session);
          occupied.push({ start: ps, end: pe });
          weekPlanned.set(weekIndex, (weekPlanned.get(weekIndex) ?? 0) + minutes);
          dayPlanned.set(dayKey(ps), (dayPlanned.get(dayKey(ps)) ?? 0) + minutes);
          earliest = pe.plus({ minutes: input.breakMinutes });
          continue;
        }
      }

      let found: { start: DateTime; end: DateTime; weekIndex: number } | null = null;
      for (const week of weeks) {
        if ((weekPlanned.get(week.index) ?? 0) + minutes > input.weeklyCapMinutes) continue;
        for (const slot of slotsByWeek.get(week.index) ?? []) {
          if (slot.end <= earliest) continue;
          if ((dayPlanned.get(dayKey(slot.start)) ?? 0) + minutes > dailyCap) continue;
          // Walk the slot in 15-minute steps so a partially used slot can still host a session.
          let cursor = slot.start > earliest ? slot.start : roundUp(earliest, 15);
          while (cursor.plus({ minutes }) <= slot.end) {
            const end = cursor.plus({ minutes });
            if (!overlaps(cursor, end)) {
              found = { start: cursor, end, weekIndex: week.index };
              break;
            }
            cursor = cursor.plus({ minutes: 15 });
          }
          if (found) break;
        }
        if (found) break;
      }
      if (!found) {
        allPlaced = false;
        break;
      }
      const session = toSession(activity, uid, found.start, found.end, found.weekIndex, p + 1, parts.length, minutes);
      partsPlaced.push(session);
      occupied.push({ start: found.start, end: found.end });
      weekPlanned.set(found.weekIndex, (weekPlanned.get(found.weekIndex) ?? 0) + minutes);
      dayPlanned.set(dayKey(found.start), (dayPlanned.get(dayKey(found.start)) ?? 0) + minutes);
      earliest = found.end.plus({ minutes: input.breakMinutes });
    }

    if (!allPlaced) {
      // Roll back any parts of this activity so a half-scheduled activity never appears.
      for (const s of partsPlaced) {
        const idx = occupied.findIndex((o) => o.start.toISO() === DateTime.fromISO(s.startsAt).setZone(zone).toISO());
        if (idx >= 0) occupied.splice(idx, 1);
        weekPlanned.set(s.weekIndex, (weekPlanned.get(s.weekIndex) ?? 0) - s.minutes);
        const dk = DateTime.fromISO(s.startsAt, { zone }).toISODate() ?? "";
        dayPlanned.set(dk, (dayPlanned.get(dk) ?? 0) - s.minutes);
      }
      unplaced.push({
        key: activity.key,
        title: activity.title,
        minutes: activity.estimatedMinutes,
        reason: "no free time within the term, the weekly cap and the activity's dependencies",
      });
      continue;
    }
    placed.push(...partsPlaced);
    const last = partsPlaced[partsPlaced.length - 1];
    if (last) finishedAt.set(activity.key, DateTime.fromISO(last.endsAt, { zone }));
  }

  placed.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.uid.localeCompare(b.uid));

  const weekly: WeekSummary[] = weeks.map((w) => {
    const available = (slotsByWeek.get(w.index) ?? []).reduce((acc, s) => acc + s.end.diff(s.start, "minutes").minutes, 0);
    return {
      weekIndex: w.index,
      weekStart: w.start.toISODate() ?? "",
      label: w.label,
      availableMinutes: Math.round(available),
      capMinutes: input.weeklyCapMinutes,
      plannedMinutes: weekPlanned.get(w.index) ?? 0,
    };
  });
  const requiredMinutes = activities.reduce((acc, a) => acc + a.estimatedMinutes, 0);
  const plannedMinutes = placed.reduce((acc, s) => acc + s.minutes, 0);
  const availableMinutes = weekly.reduce((acc, w) => acc + Math.min(w.availableMinutes, w.capMinutes), 0);
  const shortfallMinutes = Math.max(0, requiredMinutes - plannedMinutes);
  const feasible = unplaced.length === 0;

  const explanations: string[] = [];
  const suggestions: string[] = [];
  explanations.push(
    `${activities.length} activities, ${Math.round(requiredMinutes / 60)} hours of work, against about ${Math.round(availableMinutes / 60)} usable hours in ${weeks.length} weeks (availability capped at ${Math.round(input.weeklyCapMinutes / 60)} hours a week).`,
  );
  if (!feasible) {
    explanations.push(
      `${unplaced.length} activities could not be placed; the shortfall is about ${Math.ceil(shortfallMinutes / 60)} hours.`,
    );
    const perWeek = shortfallMinutes / Math.max(1, weeks.length);
    suggestions.push(`Raise the weekly cap by about ${Math.ceil(perWeek / 60)} hour(s), or add availability on another day.`);
    suggestions.push("Switch one course to audit or reading-seminar mode (fewer assessed sessions).");
    suggestions.push(
      `Extend the term by ${Math.ceil(shortfallMinutes / Math.max(60, availableMinutes / Math.max(1, weeks.length)))} week(s).`,
    );
    suggestions.push("Take one course fewer this term.");
  }
  return {
    sessions: placed,
    unplaced,
    weekly,
    totals: { requiredMinutes, plannedMinutes, availableMinutes },
    feasible,
    shortfallMinutes,
    explanations,
    suggestions,
  };
}

function roundUp(dt: DateTime, minutes: number): DateTime {
  const m = dt.minute % minutes;
  const base = dt.set({ second: 0, millisecond: 0 });
  return m === 0 ? base : base.plus({ minutes: minutes - m });
}

function toSession(
  a: PlanActivity,
  uid: string,
  start: DateTime,
  end: DateTime,
  weekIndex: number,
  part: number,
  parts: number,
  minutes: number,
): ScheduledSessionPlan {
  return {
    uid,
    key: a.key,
    enrolmentId: a.enrolmentId,
    courseId: a.courseId,
    unitId: a.unitId,
    activityId: a.activityId,
    title: parts > 1 ? `${a.title} (part ${part} of ${parts})` : a.title,
    sessionKind: a.sessionKind,
    startsAt: start.toUTC().toISO() ?? "",
    endsAt: end.toUTC().toISO() ?? "",
    weekIndex,
    part,
    parts,
    minutes,
  };
}

/** Difference between two plans by stable uid, for the learner to confirm before anything moves. */
export function diffPlans(previous: ScheduledSessionPlan[], next: ScheduledSessionPlan[]): PlanDiff {
  const prevByUid = new Map(previous.map((s) => [s.uid, s]));
  const nextByUid = new Map(next.map((s) => [s.uid, s]));
  const added: ScheduledSessionPlan[] = [];
  const removed: ScheduledSessionPlan[] = [];
  const moved: PlanDiff["moved"] = [];
  let unchanged = 0;
  for (const s of next) {
    const p = prevByUid.get(s.uid);
    if (!p) added.push(s);
    else if (p.startsAt !== s.startsAt || p.endsAt !== s.endsAt) moved.push({ from: p, to: s });
    else unchanged++;
  }
  for (const p of previous) if (!nextByUid.has(p.uid)) removed.push(p);
  return { added, removed, moved, unchanged };
}

/** Sessions whose end has passed and that were never marked complete or attempted. */
export function missedSessions<T extends { endsAt: string; status: string }>(sessions: T[], now: string): T[] {
  const n = DateTime.fromISO(now);
  return sessions.filter((s) => s.status === "planned" && DateTime.fromISO(s.endsAt) < n);
}

/** Simple workload estimate shown during onboarding before any plan exists. */
export function estimateWeeklyMinutes(availability: AvailabilityWindow[], commitments: Commitment[], breakMinutes: number): number {
  let total = 0;
  for (let d = 1 as AvailabilityWindow["weekday"]; d <= 7; d = (d + 1) as AvailabilityWindow["weekday"]) {
    let intervals: [number, number][] = availability.filter((w) => w.weekday === d).map((w) => [w.startMinute, w.endMinute]);
    for (const c of commitments.filter((c) => c.weekday === d))
      intervals = subtract(intervals, c.startMinute - breakMinutes, c.endMinute + breakMinutes);
    total += intervals.reduce((acc, [s, e]) => acc + Math.max(0, e - s), 0);
  }
  return total;
}
