import type { NotebookKind } from "@corniversity/db/services/notebook";
import { Badge } from "@/components/ui";

export const KIND_LABEL: Record<NotebookKind, { label: string; tone: "neutral" | "brass" | "moss" | "rust" | "slate" }> = {
  definition: { label: "definition", tone: "slate" },
  theorem: { label: "theorem", tone: "brass" },
  example: { label: "example", tone: "moss" },
  proof_attempt: { label: "proof attempt", tone: "brass" },
  calculation: { label: "calculation", tone: "neutral" },
  question: { label: "question", tone: "rust" },
  note: { label: "note", tone: "neutral" },
};

export function KindBadge({ kind }: { kind: NotebookKind }) {
  const meta = KIND_LABEL[kind] ?? KIND_LABEL.note;
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function excerpt(markdown: string, length = 220): string {
  const flat = markdown.replace(/\s+/g, " ").trim();
  return flat.length > length ? `${flat.slice(0, length)}…` : flat;
}

export const KIND_OPTIONS: { value: NotebookKind; label: string }[] = [
  { value: "note", label: "Note" },
  { value: "definition", label: "Definition" },
  { value: "theorem", label: "Theorem or result" },
  { value: "example", label: "Example or non-example" },
  { value: "proof_attempt", label: "Proof attempt" },
  { value: "calculation", label: "Calculation or model run" },
  { value: "question", label: "Unresolved question" },
];
