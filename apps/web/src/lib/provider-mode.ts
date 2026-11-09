import "server-only";
import { type PublicProviderState, publicProviderState } from "@corniversity/ai";
import { getEnv } from "@corniversity/db/env";
import { resolveProviderState } from "@corniversity/db/services/provider-config";
import { cache } from "react";
import { db } from "./db";
import { getOptionalSession } from "./session";

/** The signed-in learner's provider state, resolved once per request; never carries the key. */
export const currentProviderMode = cache(async (): Promise<PublicProviderState> => {
  const session = await getOptionalSession();
  if (!session) return { mode: "scripted", reason: "not_configured" };
  return publicProviderState(await resolveProviderState(db(), session.user.id, getEnv()));
});
