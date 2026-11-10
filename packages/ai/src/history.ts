import { utf8Bytes } from "./pricing";
import type { ChatMessage } from "./provider";

/** How much replayed conversation a persona turn carries by default (about 24 KB of text). */
export const DEFAULT_HISTORY_BYTES = 24_000;

/**
 * Bounded context for a persona turn: the most recent messages whose text fits in `maxBytes`,
 * oldest first, always including the newest message. When earlier messages are left out, the
 * window starts with a user note saying how many, so the model is not led to think the
 * conversation began there. The conversation itself is never shortened; only what is sent.
 */
export function boundedHistory(messages: readonly ChatMessage[], maxBytes = DEFAULT_HISTORY_BYTES): ChatMessage[] {
  if (messages.length === 0) return [];
  const kept: ChatMessage[] = [];
  let used = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!;
    const size = utf8Bytes(m.content);
    if (kept.length > 0 && used + size > maxBytes) break;
    kept.unshift(m);
    used += size;
  }
  // The API expects the first message to come from the user.
  while (kept.length > 1 && kept[0]!.role !== "user") kept.shift();
  const omitted = messages.length - kept.length;
  if (omitted === 0) return kept;
  const note: ChatMessage = {
    role: "user",
    content: `(${omitted} earlier message${omitted === 1 ? " was" : "s were"} left out to keep this turn bounded; they remain in the learner's record.)`,
  };
  // Two user messages in a row are combined by the API into one turn.
  return [note, ...kept];
}
