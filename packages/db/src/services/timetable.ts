import { createHash, randomBytes } from "node:crypto";
import {
  diffPlans,
  missedSessions,
  type PlanActivity,
  type PlanCourse,
  type ScheduledSessionPlan,
  type ScheduleResult,
  type SchedulerInput,
  schedule,
  type Weekday,
} from "@corniversity/core/scheduling/index";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import type { DbOrTx } from "../client";
import {
  auditEvent,
  availabilityWindow,
  calendarToken,
  changeProposal,
  commitment,
  courseVersion,
  dayOff,
  enrolment,
  learnerProfile,
  planVersion,
  scheduledSession,
  teachingUnit,
  term,
} from "../schema/index";

export type TermRow = typeof term.$inferSelect;
export type PlanVersionRow = typeof planVersion.$inferSelect;
export type ScheduledSessionRow = typeof scheduledSession.$inferSelect;

const DEFAULTS = { preferredSessionMinutes: 60, minSessionMinutes: 30, breakMinutes: 10 };

/**
 * Builds the scheduler input from the database: the learner's availability, commitments and
 * days off, and for every active enrolment the activities of its *prepared* units. Outline
 * units are not scheduled; the summary says how many are waiting for preparation.
 */
export async function buildSchedulerInput(
  db: DbOrTx,
  ownerId: string,
  termRow: TermRow,
  options: { weeklyCapMinutes?: number; notBefore?: string; pinned?: SchedulerInput["pinned"]; enrolmentIds?: string[] } = {},
): Promise<{ input: SchedulerInput; unpreparedUnits: number }> {
  const [profile] = await db.select().from(learnerProfile).where(eq(learnerProfile.userId, ownerId)).limit(1);
  const availability = await db.select().from(availabilityWindow).where(eq(availabilityWindow.ownerId, ownerId));
  const commitments = await db.select().from(commitment).where(eq(commitment.ownerId, ownerId));
  const offDays = await db.select().from(dayOff).where(eq(dayOff.ownerId, ownerId));
  let enrolments = await db
    .select({ enrolment, version: courseVersion })
    .from(enrolment)
    .innerJoin(courseVersion, eq(enrolment.courseVersionId, courseVersion.id))
    .where(and(eq(enrolment.ownerId, ownerId), eq(enrolment.status, "active")));
  if (options.enrolmentIds) enrolments = enrolments.filter((e) => options.enrolmentIds!.includes(e.enrolment.id));

  const courses: PlanCourse[] = [];
  let unpreparedUnits = 0;
  for (const { enrolment: e, version } of enrolments) {
    // Always schedule against the current version of the course.
    const [current] = await db
      .select()
      .from(courseVersion)
      .where(and(eq(courseVersion.courseId, version.courseId), eq(courseVersion.isCurrent, true)))
      .limit(1);
    const units = await db
      .select()
      .from(teachingUnit)
      .where(eq(teachingUnit.courseVersionId, (current ?? version).id))
      .orderBy(asc(teachingUnit.sequence));
    const ready = units.filter((u) => u.status === "ready");
    unpreparedUnits += units.length - ready.length;
    const activities: PlanActivity[] = [];
    const weeks = Math.max(1, termRow.teachingWeeks);
    let previousTutorialKey: string | null = null;
    ready.forEach((unit, index) => {
      const earliestWeek = Math.min(weeks - 1, Math.floor((index * weeks) / Math.max(1, ready.length)));
      let previousKey: string | null = previousTutorialKey;
      let tutorialKey: string | null = null;
      for (const a of unit.activities) {
        // Audit and reading-seminar modes schedule only non-assessed activities.
        const assessed = ["tutorial", "problem_class", "oral", "project", "lab"].includes(a.sessionKind);
        if (e.mode !== "enrolled" && assessed) continue;
        const key = `${unit.id}:${a.id}`;
        activities.push({
          key,
          enrolmentId: e.id,
          courseId: version.courseId,
          unitId: unit.id,
          unitSequence: unit.sequence,
          activityId: a.id,
          title: `${unit.title}: ${a.title}`,
          sessionKind: a.sessionKind,
          estimatedMinutes: a.estimatedMinutes,
          dependsOn: previousKey ? [previousKey] : [],
          earliestWeek,
        });
        previousKey = key;
        if (a.sessionKind === "tutorial") tutorialKey = key;
      }
      previousTutorialKey = tutorialKey ?? previousKey;
    });
    courses.push({ enrolmentId: e.id, courseId: version.courseId, title: version.courseId, priority: e.priority, activities });
  }

  const input: SchedulerInput = {
    timezone: termRow.timezone,
    term: {
      startDate: termRow.startDate,
      teachingWeeks: termRow.teachingWeeks,
      readingWeek: termRow.readingWeek,
      synthesisWeek: termRow.synthesisWeek,
    },
    availability: availability.map((w) => ({ weekday: w.weekday as Weekday, startMinute: w.startMinute, endMinute: w.endMinute })),
    commitments: commitments.map((c) => ({
      id: c.id,
      title: c.title,
      weekday: (c.weekday ?? undefined) as Weekday | undefined,
      date: c.date ?? undefined,
      startMinute: c.startMinute,
      endMinute: c.endMinute,
      protected: c.protected,
    })),
    daysOff: offDays.map((d) => d.date),
    courses,
    weeklyCapMinutes: options.weeklyCapMinutes ?? (profile?.weeklyHoursCeiling ? profile.weeklyHoursCeiling * 60 : 8 * 60),
    ...DEFAULTS,
    notBefore: options.notBefore,
    pinned: options.pinned,
  };
  return { input, unpreparedUnits };
}

export async function getActiveTerm(db: DbOrTx, ownerId: string): Promise<TermRow | null> {
  const rows = await db
    .select()
    .from(term)
    .where(and(eq(term.ownerId, ownerId), inArray(term.status, ["planned", "active"])))
    .orderBy(desc(term.startDate))
    .limit(1);
  return rows[0] ?? null;
}

export async function getCurrentPlan(db: DbOrTx, ownerId: string, termId: string): Promise<PlanVersionRow | null> {
  const rows = await db
    .select()
    .from(planVersion)
    .where(and(eq(planVersion.ownerId, ownerId), eq(planVersion.termId, termId), eq(planVersion.status, "confirmed")))
    .orderBy(desc(planVersion.version))
    .limit(1);
  return rows[0] ?? null;
}

export async function listSessions(db: DbOrTx, ownerId: string, planVersionId: string): Promise<ScheduledSessionRow[]> {
  return db
    .select()
    .from(scheduledSession)
    .where(and(eq(scheduledSession.ownerId, ownerId), eq(scheduledSession.planVersionId, planVersionId)))
    .orderBy(asc(scheduledSession.startsAt));
}

function summarise(result: ScheduleResult, unpreparedUnits: number) {
  return {
    plannedMinutes: result.totals.plannedMinutes,
    availableMinutes: result.totals.availableMinutes,
    feasible: result.feasible,
    shortfallMinutes: result.shortfallMinutes,
    unplaced: result.unplaced.map((u) => ({ activityId: u.key, title: u.title, reason: u.reason })),
    weekly: result.weekly.map((w) => ({ weekStart: w.weekStart, plannedMinutes: w.plannedMinutes, capMinutes: w.capMinutes })),
    explanations: [
      ...result.explanations,
      ...(unpreparedUnits > 0 ? [`${unpreparedUnits} outlined unit(s) are not scheduled until they are prepared.`] : []),
      ...result.suggestions.map((s) => `Suggestion: ${s}`),
    ],
  };
}

/**
 * Creates a *proposed* plan version with its sessions. Nothing becomes the learner's timetable
 * until `confirmPlan` runs; proposed and confirmed plans are distinct rows.
 */
export async function proposePlan(
  db: DbOrTx,
  ownerId: string,
  termRow: TermRow,
  options: { weeklyCapMinutes?: number; notBefore?: string; keepExisting?: boolean } = {},
): Promise<{ plan: PlanVersionRow; result: ScheduleResult; sessions: ScheduledSessionRow[]; unpreparedUnits: number }> {
  const current = await getCurrentPlan(db, ownerId, termRow.id);
  const existing = current ? await listSessions(db, ownerId, current.id) : [];
  const now = options.notBefore ?? new Date().toISOString();
  const pinned = options.keepExisting
    ? existing
        .filter((s) => s.status === "planned" && s.startsAt.toISOString() >= now)
        .map((s) => ({ uid: s.uid, startsAt: s.startsAt.toISOString(), endsAt: s.endsAt.toISOString() }))
    : undefined;
  const { input, unpreparedUnits } = await buildSchedulerInput(db, ownerId, termRow, {
    weeklyCapMinutes: options.weeklyCapMinutes,
    notBefore: options.notBefore,
    pinned,
  });

  // Completed sessions are history: their activities are removed from the plan input and their
  // rows are copied into the new version unchanged.
  const completedKeys = new Set(
    existing.filter((s) => s.status === "completed" || s.status === "attempted").map((s) => `${s.unitId}:${s.activityId}`),
  );
  for (const course of input.courses) {
    course.activities = course.activities.filter((a) => !completedKeys.has(a.key));
    for (const a of course.activities) a.dependsOn = a.dependsOn.filter((d) => !completedKeys.has(d));
  }
  const result = schedule(input);

  const [latest] = await db
    .select({ version: planVersion.version })
    .from(planVersion)
    .where(eq(planVersion.termId, termRow.id))
    .orderBy(desc(planVersion.version))
    .limit(1);
  const [plan] = await db
    .insert(planVersion)
    .values({
      ownerId,
      termId: termRow.id,
      version: (latest?.version ?? 0) + 1,
      status: "proposed",
      inputsSnapshot: input,
      summary: summarise(result, unpreparedUnits),
    })
    .returning();
  if (!plan) throw new Error("plan insert returned nothing");

  const rows: (typeof scheduledSession.$inferInsert)[] = result.sessions.map((s) => ({
    planVersionId: plan.id,
    ownerId,
    enrolmentId: s.enrolmentId,
    unitId: s.unitId,
    activityId: s.activityId,
    sessionKind: s.sessionKind,
    title: s.title,
    startsAt: new Date(s.startsAt),
    endsAt: new Date(s.endsAt),
    uid: s.uid,
    status: "planned",
  }));
  for (const s of existing.filter((s) => s.status === "completed" || s.status === "attempted")) {
    rows.push({ ...s, id: undefined, planVersionId: plan.id, createdAt: undefined, updatedAt: undefined });
  }
  const sessions = rows.length ? await db.insert(scheduledSession).values(rows).returning() : [];
  return { plan, result, sessions, unpreparedUnits };
}

/** Confirms a proposed plan and supersedes the previous confirmed one. */
export async function confirmPlan(db: DbOrTx, ownerId: string, planId: string): Promise<PlanVersionRow> {
  const [plan] = await db
    .select()
    .from(planVersion)
    .where(and(eq(planVersion.id, planId), eq(planVersion.ownerId, ownerId)))
    .limit(1);
  if (!plan) throw new Error("plan not found");
  await db
    .update(planVersion)
    .set({ status: "superseded" })
    .where(and(eq(planVersion.termId, plan.termId), eq(planVersion.status, "confirmed")));
  const [confirmed] = await db
    .update(planVersion)
    .set({ status: "confirmed", confirmedAt: new Date() })
    .where(eq(planVersion.id, planId))
    .returning();
  await db.update(term).set({ status: "active" }).where(eq(term.id, plan.termId));
  await db.insert(auditEvent).values({
    ownerId,
    actor: "learner",
    action: "plan:confirm",
    entity: "plan_version",
    entityId: planId,
    details: { version: plan.version },
  });
  return confirmed!;
}

export async function discardProposedPlans(db: DbOrTx, ownerId: string, termId: string): Promise<void> {
  const proposed = await db
    .select({ id: planVersion.id })
    .from(planVersion)
    .where(and(eq(planVersion.ownerId, ownerId), eq(planVersion.termId, termId), eq(planVersion.status, "proposed")));
  if (proposed.length)
    await db.delete(planVersion).where(
      inArray(
        planVersion.id,
        proposed.map((p) => p.id),
      ),
    );
}

export async function setSessionStatus(
  db: DbOrTx,
  ownerId: string,
  sessionId: string,
  status: "planned" | "completed" | "attempted" | "cancelled",
  learningSessionId?: string,
): Promise<ScheduledSessionRow | null> {
  const [updated] = await db
    .update(scheduledSession)
    .set({ status, learningSessionId: learningSessionId ?? undefined })
    .where(and(eq(scheduledSession.id, sessionId), eq(scheduledSession.ownerId, ownerId)))
    .returning();
  return updated ?? null;
}

export async function setSessionLock(db: DbOrTx, ownerId: string, sessionId: string, locked: boolean): Promise<void> {
  await db
    .update(scheduledSession)
    .set({ locked })
    .where(and(eq(scheduledSession.id, sessionId), eq(scheduledSession.ownerId, ownerId)));
}

/**
 * Moves one planned session to a new start, keeping its length, after checking the new time lies
 * inside availability and clashes with nothing. Returns a reason instead of moving when it does not.
 */
export async function moveSession(
  db: DbOrTx,
  ownerId: string,
  sessionId: string,
  newStartIso: string,
): Promise<{ ok: true; session: ScheduledSessionRow } | { ok: false; reason: string }> {
  const [s] = await db
    .select()
    .from(scheduledSession)
    .where(and(eq(scheduledSession.id, sessionId), eq(scheduledSession.ownerId, ownerId)))
    .limit(1);
  if (!s) return { ok: false, reason: "Session not found." };
  if (s.status !== "planned") return { ok: false, reason: "Only planned sessions can be moved." };
  const [plan] = await db.select().from(planVersion).where(eq(planVersion.id, s.planVersionId)).limit(1);
  const termRow = plan ? (await db.select().from(term).where(eq(term.id, plan.termId)).limit(1))[0] : undefined;
  if (!termRow) return { ok: false, reason: "Term not found." };
  const { input } = await buildSchedulerInput(db, ownerId, termRow);
  const minutes = Math.round((s.endsAt.getTime() - s.startsAt.getTime()) / 60_000);
  const { DateTime } = await import("luxon");
  const start = DateTime.fromISO(newStartIso, { zone: termRow.timezone });
  const end = start.plus({ minutes });
  const { freeSlotsForDay } = await import("@corniversity/core/scheduling/engine");
  const slots = freeSlotsForDay(start.startOf("day"), input, 0);
  if (!slots.some((slot) => start >= slot.start && end <= slot.end)) {
    return { ok: false, reason: "That time is outside your availability or clashes with a protected commitment." };
  }
  const others = await db
    .select()
    .from(scheduledSession)
    .where(and(eq(scheduledSession.planVersionId, s.planVersionId), eq(scheduledSession.status, "planned")));
  const clash = others.find((o) => o.id !== s.id && start.toJSDate() < o.endsAt && end.toJSDate() > o.startsAt);
  if (clash) return { ok: false, reason: `Clashes with “${clash.title}”.` };
  const [moved] = await db
    .update(scheduledSession)
    .set({ startsAt: start.toJSDate(), endsAt: end.toJSDate() })
    .where(eq(scheduledSession.id, s.id))
    .returning();
  await db.insert(auditEvent).values({
    ownerId,
    actor: "learner",
    action: "session:move",
    entity: "scheduled_session",
    entityId: s.id,
    details: { from: s.startsAt.toISOString(), to: start.toUTC().toISO() },
  });
  return { ok: true, session: moved! };
}

/**
 * Catch-up: re-plans everything not yet completed from now, keeping future sessions in place
 * where they still fit, and returns a proposal with the diff for the learner to confirm.
 */
export async function proposeCatchUp(db: DbOrTx, ownerId: string, now = new Date().toISOString()) {
  const termRow = await getActiveTerm(db, ownerId);
  if (!termRow) return null;
  const current = await getCurrentPlan(db, ownerId, termRow.id);
  if (!current) return null;
  const existing = await listSessions(db, ownerId, current.id);
  const missed = missedSessions(
    existing.map((s) => ({ ...s, endsAt: s.endsAt.toISOString() })),
    now,
  );
  const proposed = await proposePlan(db, ownerId, termRow, { notBefore: now, keepExisting: true });
  const previous: ScheduledSessionPlan[] = existing
    .filter((s) => s.status === "planned")
    .map((s) => ({
      uid: s.uid,
      key: `${s.unitId}:${s.activityId}`,
      enrolmentId: s.enrolmentId,
      courseId: "",
      unitId: s.unitId ?? "",
      activityId: s.activityId,
      title: s.title,
      sessionKind: s.sessionKind as ScheduledSessionPlan["sessionKind"],
      startsAt: s.startsAt.toISOString(),
      endsAt: s.endsAt.toISOString(),
      weekIndex: 0,
      part: 1,
      parts: 1,
      minutes: 0,
    }));
  const diff = diffPlans(previous, proposed.result.sessions);
  const [proposal] = await db
    .insert(changeProposal)
    .values({
      ownerId,
      kind: "recovery",
      proposedBy: "system",
      title: `Catch-up plan: ${missed.length} missed session(s) rescheduled`,
      rationale: `${missed.length} planned session(s) passed without being marked attempted or completed. The plan below moves ${diff.moved.length} session(s), adds ${diff.added.length} and leaves ${diff.unchanged} unchanged. Nothing changes until you confirm.`,
      diff: {
        planVersionId: proposed.plan.id,
        moved: diff.moved.length,
        added: diff.added.length,
        removed: diff.removed.length,
        unchanged: diff.unchanged,
        unplaced: proposed.result.unplaced.length,
      },
    })
    .returning();
  return { proposal: proposal!, plan: proposed.plan, diff, result: proposed.result, missed };
}

export async function decideProposal(db: DbOrTx, ownerId: string, proposalId: string, decision: "confirmed" | "rejected"): Promise<void> {
  const [p] = await db
    .select()
    .from(changeProposal)
    .where(and(eq(changeProposal.id, proposalId), eq(changeProposal.ownerId, ownerId)))
    .limit(1);
  if (p?.status !== "draft") return;
  const diff = p.diff as { planVersionId?: string };
  if (decision === "confirmed" && diff.planVersionId) {
    await confirmPlan(db, ownerId, diff.planVersionId);
  } else if (diff.planVersionId) {
    await db.delete(planVersion).where(and(eq(planVersion.id, diff.planVersionId), eq(planVersion.status, "proposed")));
  }
  await db.update(changeProposal).set({ status: decision, decidedAt: new Date() }).where(eq(changeProposal.id, proposalId));
}

export async function listOpenProposals(db: DbOrTx, ownerId: string) {
  return db
    .select()
    .from(changeProposal)
    .where(and(eq(changeProposal.ownerId, ownerId), eq(changeProposal.status, "draft")))
    .orderBy(desc(changeProposal.createdAt));
}

/** Calendar subscription tokens: random, stored hashed, revocable, minimal detail by default. */
export async function createCalendarToken(db: DbOrTx, ownerId: string, detail: "minimal" | "full" = "minimal"): Promise<string> {
  const token = randomBytes(24).toString("base64url");
  await db.insert(calendarToken).values({ ownerId, tokenHash: hashToken(token), detailLevel: detail });
  return token;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function resolveCalendarToken(db: DbOrTx, token: string) {
  const rows = await db
    .select()
    .from(calendarToken)
    .where(and(eq(calendarToken.tokenHash, hashToken(token)), isNull(calendarToken.revokedAt)))
    .limit(1);
  const row = rows[0];
  if (row) await db.update(calendarToken).set({ lastUsedAt: new Date() }).where(eq(calendarToken.id, row.id));
  return row ?? null;
}

export async function revokeCalendarTokens(db: DbOrTx, ownerId: string): Promise<void> {
  await db
    .update(calendarToken)
    .set({ revokedAt: new Date() })
    .where(and(eq(calendarToken.ownerId, ownerId), isNull(calendarToken.revokedAt)));
}

export async function listCalendarTokens(db: DbOrTx, ownerId: string) {
  return db.select().from(calendarToken).where(eq(calendarToken.ownerId, ownerId)).orderBy(desc(calendarToken.createdAt));
}

/** Everything the timetable and campus pages need for the current confirmed plan. */
export async function getTimetable(db: DbOrTx, ownerId: string) {
  const termRow = await getActiveTerm(db, ownerId);
  if (!termRow) return null;
  const plan = await getCurrentPlan(db, ownerId, termRow.id);
  if (!plan) return { term: termRow, plan: null, sessions: [] as ScheduledSessionRow[] };
  const sessions = await listSessions(db, ownerId, plan.id);
  return { term: termRow, plan, sessions };
}

export async function nextSession(db: DbOrTx, ownerId: string, now = new Date()): Promise<ScheduledSessionRow | null> {
  const tt = await getTimetable(db, ownerId);
  if (!tt?.plan) return null;
  return tt.sessions.find((s) => s.status === "planned" && s.endsAt > now) ?? null;
}
