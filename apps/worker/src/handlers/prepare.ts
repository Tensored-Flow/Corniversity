import { PrepareCoursePayload } from "@corniversity/db/jobs";
import { runPreparation } from "@corniversity/db/services/preparation";
import type { HandlerContext } from "./index";

/**
 * One run of a course-preparation request. The service claims each stage under a lease, skips
 * finished ones, stops once the request is cancelled and records why it stopped; this handler
 * only validates the payload and reports what ran.
 */
export async function prepareHandler(ctx: HandlerContext, raw: unknown): Promise<Record<string, unknown>> {
  const payload = PrepareCoursePayload.parse(raw);
  return runPreparation(ctx.db, ctx.env, payload);
}
