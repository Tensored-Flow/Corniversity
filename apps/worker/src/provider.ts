import { createProvider, type ModelProvider } from "@corniversity/ai";
import { resolveProviderConfig } from "@corniversity/db/services/provider-config";
import type { HandlerContext } from "./handlers/index";

/** Resolves the learner's provider through the shared configuration service. */
export async function providerFor(
  ctx: HandlerContext,
  ownerId: string,
): Promise<{ provider: ModelProvider; live: boolean; reason?: string }> {
  const config = await resolveProviderConfig(ctx.db, ownerId, ctx.env);
  return createProvider({
    provider: config.provider,
    anthropicApiKey: config.anthropicApiKey,
    defaultModel: config.defaultModel,
    modelMap: config.modelMap,
  });
}
