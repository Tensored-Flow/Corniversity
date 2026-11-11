import "server-only";
import { ASSESSOR_PROMPT_VERSION, providerNameOf, ROLE_CONTRACTS } from "@corniversity/ai";
import { getEnv } from "@corniversity/db/env";
import type { GraderConfig } from "@corniversity/db/services/exams";
import { resolveProviderState } from "@corniversity/db/services/provider-config";
import { db } from "./db";

/** What will mark an exam: the teacher configured now, recorded as an ordinary submission records it. */
export async function examGrader(ownerId: string): Promise<GraderConfig> {
  const state = await resolveProviderState(db(), ownerId, getEnv());
  return {
    provider: providerNameOf(state),
    model: state.mode === "scripted" ? "fixture" : state.model,
    promptVersion: ASSESSOR_PROMPT_VERSION,
    roleVersion: ROLE_CONTRACTS.assessor.version,
  };
}
