import { boundedHistory, type ChatMessage } from "@corniversity/ai";
import { citedHistory, type EvidenceRef } from "@corniversity/core/grounding/citations";

/** Replay only the bounded conversation window and omit replies tied to unavailable library
 * passages. The saved conversation is untouched. Uncited legacy text cannot be attributed to
 * a source retrospectively; this check uses the source identities actually recorded. */
export async function tutorHistory(
  messages: readonly { sender: string; contentMarkdown: string; citations: EvidenceRef[] }[],
  question: string,
  permitted: (ref: EvidenceRef) => Promise<boolean>,
): Promise<{ chat: ChatMessage[]; sourceRefs: EvidenceRef[]; omitted: number }> {
  const refs = new Map<ChatMessage, EvidenceRef[]>();
  const formatted = messages.map((message): ChatMessage => {
    const reply: ChatMessage = {
      role: message.sender === "learner" ? "user" : "assistant",
      content: message.sender === "learner" ? message.contentMarkdown : citedHistory(message.contentMarkdown, message.citations),
    };
    if (reply.role === "assistant")
      refs.set(
        reply,
        message.citations.filter((ref) => ref.assetId || ref.passageId),
      );
    return reply;
  });
  const window = boundedHistory([...formatted, { role: "user", content: question }]);
  const decisions = new Map<string, Promise<boolean>>();
  const allowed = (ref: EvidenceRef) => {
    const key = `${ref.assetId ?? ""}:${ref.passageId ?? ""}`;
    let decision = decisions.get(key);
    if (!decision) {
      decision = permitted(ref).catch(() => false);
      decisions.set(key, decision);
    }
    return decision;
  };
  const checks = await Promise.all(
    window.map(async (message) => {
      const citations = refs.get(message) ?? [];
      return { message, citations, keep: (await Promise.all(citations.map(allowed))).every(Boolean) };
    }),
  );
  const kept = checks.filter((item) => item.keep);
  const omitted = checks.length - kept.length;
  const chat = kept.map((item) => item.message);
  if (omitted)
    chat.unshift({
      role: "user",
      content: `(${omitted} earlier tutor replies were omitted because their cited library passages are no longer available for AI processing. The saved conversation is unchanged; do not reconstruct the omitted text.)`,
    });
  return { chat, sourceRefs: kept.flatMap((item) => item.citations), omitted };
}
