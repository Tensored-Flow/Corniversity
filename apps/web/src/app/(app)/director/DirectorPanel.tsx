"use client";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { RenderedHtml } from "@/components/RenderedHtml";
import { Button } from "@/components/ui";

interface Rendered {
  id: string;
  sender: "learner" | "persona" | "system";
  html: string;
}

export function DirectorPanel({
  conversationId,
  initialMessages,
  personaName,
}: {
  conversationId: string;
  initialMessages: Rendered[];
  personaName: string;
}) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = input.trim();
    if (!message) return;
    setInput("");
    setError(null);
    setPending("");
    const response = await fetch("/api/director/turn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId, message }),
    });
    if (!response.ok || !response.body) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? `The director could not reply (${response.status}).`);
      setPending(null);
      return;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let acc = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      acc += decoder.decode(value, { stream: true });
      setPending(acc);
    }
    setPending(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex max-h-[32rem] flex-col gap-3 overflow-y-auto" aria-live="polite">
        {initialMessages.length === 0 && pending === null ? (
          <p className="text-sm text-ink-2">
            Ask about the shape of your programme, workload, what to take next, or whether a course is really prepared. Replies are in
            writing.
          </p>
        ) : null}
        {initialMessages.map((m) => (
          <div
            key={m.id}
            className={[
              "rounded-[var(--radius-panel)] px-3 py-2 text-sm",
              m.sender === "learner" ? "ml-8 border border-stone bg-paper" : "border border-stone bg-paper-3/60",
            ].join(" ")}
          >
            <p className="mb-1 text-[0.65rem] uppercase tracking-wide text-ink-3">{m.sender === "learner" ? "You" : personaName}</p>
            <RenderedHtml html={m.html} className="text-sm" />
          </div>
        ))}
        {pending !== null ? (
          <div className="rounded-[var(--radius-panel)] border border-stone bg-paper-3/60 px-3 py-2 text-sm">
            <p className="mb-1 text-[0.65rem] uppercase tracking-wide text-ink-3">{personaName} · writing</p>
            <p className="whitespace-pre-wrap text-ink-2">{pending || "…"}</p>
          </div>
        ) : null}
      </div>
      {error ? <p className="text-sm text-rust">{error}</p> : null}
      <form onSubmit={send} className="flex flex-col gap-2">
        <label htmlFor="director-input" className="sr-only">
          Message to the director
        </label>
        <textarea
          id="director-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={3}
          placeholder="For example: is one course plus a seminar too little? Should I add measure theory now or next term?"
          className="w-full rounded-[var(--radius-control)] border border-stone-2 bg-paper px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-focus"
          disabled={pending !== null}
        />
        <div className="flex justify-end">
          <Button type="submit" variant="secondary" disabled={pending !== null || input.trim().length === 0}>
            Send
          </Button>
        </div>
      </form>
    </div>
  );
}
