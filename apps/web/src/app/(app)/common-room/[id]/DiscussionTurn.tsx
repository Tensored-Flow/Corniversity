"use client";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui";

/** The learner's turn. Each submission is one round: every participant replies once, then the page reloads with the stored turns. */
export function DiscussionTurn({ discussionId, roundsLeft }: { discussionId: string; roundsLeft: number }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!text.trim()) return;
    setPending(true);
    setError(null);
    const response = await fetch("/api/discussions/turn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ discussionId, message: text.trim() }),
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
    if (!response.ok) {
      setError(body.message ?? body.error ?? `The round could not run (${response.status}).`);
      setPending(false);
      return;
    }
    setText("");
    setPending(false);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label htmlFor="discussion-turn" className="text-sm font-medium text-ink">
        Your turn ({roundsLeft} round{roundsLeft === 1 ? "" : "s"} left)
      </label>
      <textarea
        id="discussion-turn"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        disabled={pending}
        placeholder="Say what you think, or ask. Each turn you write is one round."
        className="w-full rounded-[var(--radius-control)] border border-stone-2 bg-paper px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-focus"
      />
      {error ? (
        <p role="alert" className="text-sm text-rust">
          {error}
        </p>
      ) : null}
      <div>
        <Button type="submit" variant="secondary" disabled={pending || !text.trim()}>
          {pending ? "The room is replying…" : "Send"}
        </Button>
      </div>
    </form>
  );
}
