import { getDiscussion, getPersonas, listTurns } from "@corniversity/db/services/community";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AiLabel } from "@/components/AiLabel";
import { Markdown } from "@/components/Markdown";
import { Badge, Button, Card, Notice } from "@/components/ui";
import { db } from "@/lib/db";
import { producerLabels } from "@/lib/producers";
import { requireSession } from "@/lib/session";
import { setDiscussionStatusAction } from "../actions";
import { DiscussionTurn } from "./DiscussionTurn";

export const metadata = { title: "Discussion" };

export default async function DiscussionPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession("/common-room");
  const { id } = await params;
  const database = db();
  const discussion = await getDiscussion(database, session.user.id, id);
  if (!discussion) notFound();
  const [turns, personas] = await Promise.all([
    listTurns(database, discussion.id),
    getPersonas(database, discussion.participantPersonaIds),
  ]);
  const producedBy = await producerLabels(
    database,
    turns.map((t) => t.providerRunId),
  );
  const nameOf = (speaker: string) =>
    speaker === "learner" ? "You" : speaker === "system" ? "Common room" : (personas.find((p) => p.id === speaker)?.name ?? speaker);
  const roundsLeft = Math.max(0, discussion.maxRounds - discussion.roundsUsed);

  return (
    <div className="mx-auto w-full max-w-4xl">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-ink-3">
        <Link href="/common-room" className="hover:text-ink">
          Common Room
        </Link>
        <span className="mx-2">/</span>
        <span>{discussion.title}</span>
      </nav>
      <header className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="brass">{discussion.kind.replace("_", " ")}</Badge>
          <Badge tone={discussion.status === "open" ? "moss" : "neutral"}>{discussion.status}</Badge>
          <span className="text-xs text-ink-3">
            round {Math.min(discussion.roundsUsed, discussion.maxRounds)} of {discussion.maxRounds} · released material:{" "}
            {discussion.releasedMaterial.unitIds.length} unit{discussion.releasedMaterial.unitIds.length === 1 ? "" : "s"}
          </span>
        </div>
        <h1 className="mt-2 text-2xl text-ink">{discussion.title}</h1>
        <ul className="mt-2 flex flex-wrap gap-3 text-sm text-ink">
          {personas.map((p) => (
            <li key={p.id} className="flex items-center gap-1">
              {p.name} <AiLabel kind={p.isPeer ? "classmate" : p.title} />
            </li>
          ))}
        </ul>
      </header>

      <Card as="section" aria-label="Turns">
        {turns.length === 0 ? <p className="text-sm text-ink-2">Nobody has spoken yet. The room replies only after you do.</p> : null}
        <ol className="flex flex-col gap-3">
          {turns.map((t) => (
            <li
              key={t.id}
              className={[
                "rounded-[var(--radius-panel)] px-3 py-2 text-sm",
                t.speaker === "learner"
                  ? "ml-6 border border-stone bg-paper"
                  : t.speaker === "system"
                    ? "border border-dashed border-stone text-ink-3"
                    : "border border-stone bg-paper-3/60",
              ].join(" ")}
            >
              <p className="mb-1 text-[0.65rem] uppercase tracking-wide text-ink-3">
                {nameOf(t.speaker)}
                {producedBy(t.providerRunId) ? ` · ${producedBy(t.providerRunId)}` : ""}
              </p>
              <Markdown source={t.contentMarkdown} className="text-sm" />
              {t.labels.length ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  {t.labels.map((l) => (
                    <Badge key={l} tone={l === "needs_checking" ? "rust" : "neutral"}>
                      {l.replace("_", " ")}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ol>
        <div className="mt-4 border-t border-stone pt-4">
          {discussion.status === "open" && roundsLeft > 0 ? (
            <DiscussionTurn discussionId={discussion.id} roundsLeft={roundsLeft} />
          ) : (
            <Notice tone="neutral">
              {discussion.status === "muted"
                ? "You muted this discussion; nobody here will speak again."
                : `Closed after ${discussion.roundsUsed} round${discussion.roundsUsed === 1 ? "" : "s"}. Open a new discussion from the common room if you want to continue.`}
            </Notice>
          )}
        </div>
      </Card>
      {discussion.status === "open" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <form action={setDiscussionStatusAction}>
            <input type="hidden" name="id" value={discussion.id} />
            <input type="hidden" name="status" value="closed" />
            <Button type="submit" variant="secondary">
              Close now
            </Button>
          </form>
          <form action={setDiscussionStatusAction}>
            <input type="hidden" name="id" value={discussion.id} />
            <input type="hidden" name="status" value="muted" />
            <Button type="submit" variant="quiet">
              Mute
            </Button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
