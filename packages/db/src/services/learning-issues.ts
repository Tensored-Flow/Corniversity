import { isIdentityLabel } from "@corniversity/core/review/review";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { DbOrTx } from "../client";
import { isUuid } from "../ids";
import { auditEvent, concept, misconceptionRecord, revisionItem } from "../schema/index";

/**
 * Learning issues: specific, evidence-linked statements about a piece of work ("this application
 * of the theorem omitted an ambient completeness assumption"), never labels about the learner.
 * The system only proposes; the learner confirms, disputes, corrects, resolves or deletes. Later
 * work can resolve an issue, and a resolved or dismissed issue no longer counts as current. Issues
 * are never given to the assessor, so a past mistake cannot bias a later judgement.
 */

export type IssueStatus = "proposed" | "confirmed" | "revisiting" | "resolved" | "dismissed";
export const CURRENT_STATUSES: IssueStatus[] = ["proposed", "confirmed", "revisiting"];
export type IssueRow = typeof misconceptionRecord.$inferSelect;

export class IssueError extends Error {}

const clean = (text: string, max = 600) => text.replace(/\s+/g, " ").trim().slice(0, max);

/**
 * Proposes an issue from an automatic check that failed on a submission: real evidence, with the
 * check named. An open issue for the same exercise and check is not duplicated.
 */
export async function proposeIssueFromCheck(
  db: DbOrTx,
  input: {
    ownerId: string;
    conceptId: string | null;
    exerciseId: string;
    submissionVersionId: string;
    assessmentRunId: string;
    checkId: string;
    statement: string;
    version: number;
  },
): Promise<IssueRow | null> {
  const [open] = await db
    .select()
    .from(misconceptionRecord)
    .where(
      and(
        eq(misconceptionRecord.ownerId, input.ownerId),
        eq(misconceptionRecord.exerciseId, input.exerciseId),
        eq(misconceptionRecord.checkId, input.checkId),
        inArray(misconceptionRecord.status, CURRENT_STATUSES),
      ),
    )
    .limit(1);
  if (open) return null;
  const statement = clean(input.statement);
  if (isIdentityLabel(statement)) return null;
  const [row] = await db
    .insert(misconceptionRecord)
    .values({
      ownerId: input.ownerId,
      conceptId: input.conceptId,
      claim: statement,
      status: "proposed",
      origin: "check",
      exerciseId: input.exerciseId,
      submissionVersionId: input.submissionVersionId,
      assessmentRunId: input.assessmentRunId,
      checkId: input.checkId,
      interpretation: `An automatic check on submission v${input.version} found this. It is a proposal about that piece of work: confirm it, correct it or dispute it.`,
    })
    .returning();
  return row ?? null;
}

/**
 * Proposes an issue from a live assessor's first gap, phrased about the work and the line. Never
 * from the scripted demo, which did not read the work.
 */
export async function proposeIssueFromGap(
  db: DbOrTx,
  input: {
    ownerId: string;
    conceptId: string | null;
    exerciseId: string;
    submissionVersionId: string;
    assessmentRunId: string;
    version: number;
    line: number;
    issue: string;
    model: string;
  },
): Promise<IssueRow | null> {
  const statement = clean(`Submission v${input.version}, line ${input.line}: ${input.issue}`);
  if (isIdentityLabel(statement)) return null;
  const [row] = await db
    .insert(misconceptionRecord)
    .values({
      ownerId: input.ownerId,
      conceptId: input.conceptId,
      claim: statement,
      status: "proposed",
      origin: "assessor",
      exerciseId: input.exerciseId,
      submissionVersionId: input.submissionVersionId,
      assessmentRunId: input.assessmentRunId,
      interpretation: `The AI assessor (${input.model}) proposed this reading of the first gap. It is provisional: confirm it only if you agree.`,
    })
    .returning();
  return row ?? null;
}

/** An issue the learner records themselves. */
export async function createLearnerIssue(
  db: DbOrTx,
  ownerId: string,
  input: { statement: string; conceptId?: string | null; exerciseId?: string | null; followUp?: string | null },
): Promise<IssueRow> {
  const statement = clean(input.statement);
  if (statement.length < 10) throw new IssueError("Describe the issue in a sentence: what went wrong in which piece of work.");
  if (input.conceptId) {
    const [c] = await db.select({ id: concept.id }).from(concept).where(eq(concept.id, input.conceptId)).limit(1);
    if (!c) throw new IssueError("Unknown concept.");
  }
  const [row] = await db
    .insert(misconceptionRecord)
    .values({
      ownerId,
      conceptId: input.conceptId ?? null,
      claim: statement,
      status: "confirmed",
      origin: "learner",
      exerciseId: input.exerciseId ?? null,
      followUp: input.followUp ? clean(input.followUp) : null,
    })
    .returning();
  return row!;
}

export async function listIssues(db: DbOrTx, ownerId: string, filter: { current?: boolean; exerciseId?: string } = {}) {
  const conditions = [eq(misconceptionRecord.ownerId, ownerId)];
  if (filter.current) conditions.push(inArray(misconceptionRecord.status, CURRENT_STATUSES));
  if (filter.exerciseId) conditions.push(eq(misconceptionRecord.exerciseId, filter.exerciseId));
  return db
    .select({ issue: misconceptionRecord, conceptTitle: concept.title })
    .from(misconceptionRecord)
    .leftJoin(concept, eq(concept.id, misconceptionRecord.conceptId))
    .where(and(...conditions))
    .orderBy(desc(misconceptionRecord.updatedAt));
}

async function owned(db: DbOrTx, ownerId: string, id: string): Promise<IssueRow> {
  if (!isUuid(id)) throw new IssueError("Issue not found.");
  const [row] = await db
    .select()
    .from(misconceptionRecord)
    .where(and(eq(misconceptionRecord.id, id), eq(misconceptionRecord.ownerId, ownerId)))
    .limit(1);
  if (!row) throw new IssueError("Issue not found.");
  return row;
}

async function audit(db: DbOrTx, ownerId: string, action: string, id: string, details: Record<string, unknown> = {}) {
  await db
    .insert(auditEvent)
    .values({ ownerId, actor: "learner", action: `issue:${action}`, entity: "misconception_record", entityId: id, details });
}

/**
 * The learner's response to an issue. Confirming (optionally with a corrected statement) schedules
 * one review item to revisit it; disputing dismisses it with the learner's reason; resolving needs
 * a note or later work; reopening returns it to confirmed.
 */
export async function respondToIssue(
  db: DbOrTx,
  ownerId: string,
  id: string,
  action:
    | { kind: "confirm"; statement?: string }
    | { kind: "dispute"; note: string }
    | { kind: "revisit" }
    | { kind: "resolve"; note: string; submissionVersionId?: string | null }
    | { kind: "reopen" }
    | { kind: "follow_up"; text: string },
  now = new Date(),
): Promise<IssueRow> {
  const issue = await owned(db, ownerId, id);
  let patch: Partial<typeof misconceptionRecord.$inferInsert> = {};
  switch (action.kind) {
    case "confirm": {
      const statement = action.statement ? clean(action.statement) : issue.claim;
      if (statement.length < 10) throw new IssueError("The statement needs at least a sentence.");
      patch = { status: "confirmed", claim: statement };
      if (issue.conceptId) {
        const [existing] = await db.select({ id: revisionItem.id }).from(revisionItem).where(eq(revisionItem.issueId, issue.id)).limit(1);
        if (!existing) {
          await db.insert(revisionItem).values({
            ownerId,
            conceptId: issue.conceptId,
            kind: "issue",
            issueId: issue.id,
            exerciseId: issue.exerciseId,
            prompt: `Revisit: ${statement} Write the step correctly and say which hypothesis or idea it needs.`,
            dueAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
            intervalDays: 2,
          });
        }
      }
      break;
    }
    case "dispute":
      if (clean(action.note).length < 5) throw new IssueError("Say briefly why you disagree.");
      patch = { status: "dismissed", learnerNote: clean(action.note), clearedAt: now };
      break;
    case "revisit":
      patch = { status: "revisiting" };
      break;
    case "resolve":
      if (clean(action.note).length < 5 && !action.submissionVersionId)
        throw new IssueError("Say what resolved it, or link the work that did.");
      patch = {
        status: "resolved",
        clearedAt: now,
        resolvedBy: { note: clean(action.note), submissionVersionId: action.submissionVersionId ?? null, at: now.toISOString() },
      };
      break;
    case "reopen":
      patch = { status: "confirmed", clearedAt: null, resolvedBy: null };
      break;
    case "follow_up":
      patch = { followUp: clean(action.text) };
      break;
  }
  const [row] = await db
    .update(misconceptionRecord)
    .set({ ...patch, updatedAt: now })
    .where(eq(misconceptionRecord.id, issue.id))
    .returning();
  // A resolved or dismissed issue no longer asks for review.
  if (action.kind === "resolve" || action.kind === "dispute") {
    await db.update(revisionItem).set({ status: "archived" }).where(eq(revisionItem.issueId, issue.id));
  }
  await audit(db, ownerId, action.kind, issue.id);
  return row!;
}

export async function deleteIssue(db: DbOrTx, ownerId: string, id: string): Promise<void> {
  const issue = await owned(db, ownerId, id);
  await db.delete(revisionItem).where(eq(revisionItem.issueId, issue.id));
  await db.delete(misconceptionRecord).where(eq(misconceptionRecord.id, issue.id));
  await audit(db, ownerId, "delete", issue.id);
}

/**
 * Later work resolves an issue raised by an automatic check when the same check passes on a later
 * submission of the same exercise. The resolution names that submission and can be reopened.
 */
export async function resolveIssuesFromSubmission(
  db: DbOrTx,
  input: { ownerId: string; exerciseId: string; submissionVersionId: string; version: number; passedCheckIds: string[] },
  now = new Date(),
): Promise<number> {
  if (input.passedCheckIds.length === 0) return 0;
  const open = await db
    .select()
    .from(misconceptionRecord)
    .where(
      and(
        eq(misconceptionRecord.ownerId, input.ownerId),
        eq(misconceptionRecord.exerciseId, input.exerciseId),
        inArray(misconceptionRecord.status, CURRENT_STATUSES),
        inArray(misconceptionRecord.checkId, input.passedCheckIds),
      ),
    );
  for (const issue of open) {
    if (issue.submissionVersionId === input.submissionVersionId) continue;
    await db
      .update(misconceptionRecord)
      .set({
        status: "resolved",
        clearedAt: now,
        updatedAt: now,
        resolvedBy: {
          note: `The same automatic check passed on submission v${input.version}.`,
          submissionVersionId: input.submissionVersionId,
          at: now.toISOString(),
        },
      })
      .where(eq(misconceptionRecord.id, issue.id));
    await db.update(revisionItem).set({ status: "archived" }).where(eq(revisionItem.issueId, issue.id));
  }
  return open.filter((i) => i.submissionVersionId !== input.submissionVersionId).length;
}

/** Open issues per exercise, for the progression's next-task proposal. */
export async function openIssueCounts(db: DbOrTx, ownerId: string, exerciseIds: string[]): Promise<Map<string, number>> {
  if (exerciseIds.length === 0) return new Map();
  const rows = await db
    .select({ exerciseId: misconceptionRecord.exerciseId })
    .from(misconceptionRecord)
    .where(
      and(
        eq(misconceptionRecord.ownerId, ownerId),
        inArray(misconceptionRecord.exerciseId, exerciseIds),
        inArray(misconceptionRecord.status, CURRENT_STATUSES),
      ),
    );
  const counts = new Map<string, number>();
  for (const r of rows) if (r.exerciseId) counts.set(r.exerciseId, (counts.get(r.exerciseId) ?? 0) + 1);
  return counts;
}
