import { and, count, desc, eq, gte, inArray, isNull } from "drizzle-orm";
import type { DbOrTx } from "../client";
import { courseVersion, teachingUnit } from "../schema/academic";
import { consentRecord } from "../schema/learner";
import { processingPermission, resourceRequest } from "../schema/library";
import { jobRecord, providerRun } from "../schema/operations";
import { preparationRequest, preparationStage } from "../schema/preparation";
import { conceptBridge } from "../schema/study";
import { visualExplanation } from "../schema/visuals";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Academic operations at a glance: what is prepared, what sources are still wanted, what the
 * worker has queued or failed, which permissions stand, recent model-run errors, and the
 * preparation tasks by role and state. Read-only; every figure comes from a record.
 */
export async function operationsOverview(db: DbOrTx, ownerId: string, now = new Date()) {
  const since = new Date(now.getTime() - WEEK_MS);
  const [readiness, units, visuals, bridges, requests, jobs, failedJobs, consents, permissions, runErrors, tasks] = await Promise.all([
    db
      .select({ readiness: courseVersion.readiness, n: count() })
      .from(courseVersion)
      .where(eq(courseVersion.isCurrent, true))
      .groupBy(courseVersion.readiness),
    db
      .select({ status: teachingUnit.status, n: count() })
      .from(teachingUnit)
      .innerJoin(courseVersion, eq(teachingUnit.courseVersionId, courseVersion.id))
      .where(eq(courseVersion.isCurrent, true))
      .groupBy(teachingUnit.status),
    db
      .select({
        slug: visualExplanation.slug,
        title: visualExplanation.title,
        status: visualExplanation.status,
        film: visualExplanation.filmBlobKey,
        stale: visualExplanation.filmStale,
      })
      .from(visualExplanation)
      .orderBy(visualExplanation.title),
    db.select({ status: conceptBridge.status, n: count() }).from(conceptBridge).groupBy(conceptBridge.status),
    db
      .select({ id: resourceRequest.id, title: resourceRequest.title, courseId: resourceRequest.courseId, why: resourceRequest.why })
      .from(resourceRequest)
      .where(and(eq(resourceRequest.ownerId, ownerId), eq(resourceRequest.status, "open")))
      .orderBy(desc(resourceRequest.createdAt))
      .limit(8),
    db
      .select({ status: jobRecord.status, n: count() })
      .from(jobRecord)
      .where(and(eq(jobRecord.ownerId, ownerId), gte(jobRecord.createdAt, since)))
      .groupBy(jobRecord.status),
    db
      .select({ id: jobRecord.id, kind: jobRecord.kind, error: jobRecord.error, at: jobRecord.updatedAt })
      .from(jobRecord)
      .where(and(eq(jobRecord.ownerId, ownerId), eq(jobRecord.status, "failed")))
      .orderBy(desc(jobRecord.updatedAt))
      .limit(5),
    db
      .select({ kind: consentRecord.kind, basis: consentRecord.basis, at: consentRecord.recordedAt })
      .from(consentRecord)
      .where(and(eq(consentRecord.userId, ownerId), eq(consentRecord.granted, true), isNull(consentRecord.revokedAt)))
      .orderBy(desc(consentRecord.recordedAt))
      .limit(12),
    db
      .select({ action: processingPermission.action, n: count() })
      .from(processingPermission)
      .where(and(eq(processingPermission.ownerId, ownerId), isNull(processingPermission.revokedAt)))
      .groupBy(processingPermission.action),
    db
      .select({
        id: providerRun.id,
        role: providerRun.role,
        status: providerRun.status,
        error: providerRun.error,
        at: providerRun.startedAt,
      })
      .from(providerRun)
      .where(
        and(eq(providerRun.ownerId, ownerId), inArray(providerRun.status, ["error", "refused", "unsettled", "budget_blocked", "blocked"])),
      )
      .orderBy(desc(providerRun.startedAt))
      .limit(6),
    db
      .select({
        requestId: preparationRequest.id,
        courseId: preparationRequest.courseId,
        stageKey: preparationStage.stageKey,
        unitKey: preparationStage.unitKey,
        role: preparationStage.role,
        status: preparationStage.status,
        error: preparationStage.error,
      })
      .from(preparationStage)
      .innerJoin(preparationRequest, eq(preparationStage.requestId, preparationRequest.id))
      .where(
        and(
          eq(preparationRequest.ownerId, ownerId),
          inArray(preparationRequest.status, ["running", "blocked", "awaiting_review", "failed"]),
        ),
      )
      .orderBy(preparationRequest.createdAt),
  ]);
  return { readiness, units, visuals, bridges, requests, jobs, failedJobs, consents, permissions, runErrors, tasks };
}
