import "server-only";
import { modelLabel } from "@corniversity/ai";
import { COMPANION_REFUSALS } from "@corniversity/core/scholarly/companion";
import type { DbOrTx } from "@corniversity/db/client";
import { companionDocument, latestCompanionExchange } from "@corniversity/db/services/companion";
import type { AskPanelData, CompanionAnswerView } from "@/components/reader/ask";
import { renderMarkdown } from "@/lib/markdown";
import { producerLabels } from "@/lib/producers";
import { currentProviderMode } from "@/lib/provider-mode";

/**
 * What the reading room hands its Ask panel, read on the server for the owner's own Document: its
 * kind and state, the owner's external-AI decision, the licence line, who answers now, and the last
 * stored request and answer, rendered by the Markdown and KaTeX sanitiser.
 */

/** The last request and answer about the Document, rendered; null when there is none. */
export async function companionAnswerView(database: DbOrTx, ownerId: string, assetId: string): Promise<CompanionAnswerView | null> {
  const exchange = await latestCompanionExchange(database, ownerId, assetId);
  if (!exchange) return null;
  const producedBy = await producerLabels(database, [exchange.answer?.providerRunId ?? null]);
  return {
    request: exchange.request ? { html: await renderMarkdown(exchange.request.contentMarkdown) } : null,
    answer: exchange.answer
      ? {
          html: await renderMarkdown(exchange.answer.contentMarkdown),
          labels: exchange.answer.labels,
          citations: exchange.answer.citations.map((c) => ({ tag: c.tag, label: c.label })),
          uncited: exchange.answer.uncitedClaims.length,
          producedBy: producedBy(exchange.answer.providerRunId),
        }
      : null,
    action: exchange.action,
    evidence: exchange.sent,
  };
}

async function aiLabel(): Promise<AskPanelData["aiLabel"]> {
  const state = await currentProviderMode();
  if (state.mode === "live")
    return {
      text: `AI reading companion · ${modelLabel(state.model)}`,
      title: `An AI persona, not a person. Its replies come from ${modelLabel(state.model)}.`,
    };
  if (state.mode === "plan")
    return {
      text: `AI reading companion · ${state.model} via your ChatGPT plan`,
      title: `An AI persona, not a person. Its replies come from ${state.model} through your own ChatGPT plan.`,
    };
  if (state.mode === "blocked")
    return {
      text: "AI reading companion · model blocked",
      title: `An AI persona, not a person. The live model is blocked: ${state.reason}`,
    };
  return {
    text: "AI reading companion · scripted demo",
    title: "An AI persona, not a person. No model is configured, so its replies are scripted and do not read your selection.",
  };
}

export async function askPanelData(database: DbOrTx, ownerId: string, assetId: string): Promise<AskPanelData | null> {
  const [document, lastAnswer, label] = await Promise.all([
    companionDocument(database, ownerId, assetId),
    companionAnswerView(database, ownerId, assetId),
    aiLabel(),
  ]);
  if (!document) return null;
  return {
    assetId: document.assetId,
    kind: document.kind,
    stateRefusal:
      document.kind === "local"
        ? COMPANION_REFUSALS.localOnly
        : document.kind === "stored" && !document.extracted
          ? COMPANION_REFUSALS.notExtracted
          : null,
    permission: document.externalAi,
    licence: document.licence,
    personaName: document.persona.name,
    aiLabel: label,
    lastAnswer,
  };
}
