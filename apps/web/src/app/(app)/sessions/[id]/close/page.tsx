import { getUnitDetail } from "@corniversity/db/services/catalogue";
import { getSession } from "@corniversity/db/services/learning";
import { sessionCloseFacts } from "@corniversity/db/services/study-session";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { closeSessionAction } from "../actions";

/**
 * The restrained close of a study session: what is saved, what is still open, one possible next
 * step, and the learner's own summary. Every fact is read from records; nothing here marks a
 * concept understood.
 */
export default async function CloseSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireSession(`/sessions/${id}/close`);
  const session = await getSession(db(), auth.user.id, id);
  if (!session) notFound();
  const unitDetail = await getUnitDetail(db(), session.unitId);
  if (!unitDetail) notFound();
  const activities = unitDetail.unit.activities;
  const index = activities.findIndex((a) => a.id === session.activityId);
  const activity = activities[index];
  const next = activities[index + 1] ?? null;
  const facts = await sessionCloseFacts(db(), auth.user.id, session, activity?.exerciseIds ?? [], next ? { title: next.title } : null);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <p className="text-sm uppercase tracking-[0.18em] text-brass">Finishing for now</p>
      <h1 className="mt-1 text-2xl text-ink">{activity?.title ?? "Study session"}</h1>
      <p className="mt-1 text-sm text-ink-2">
        {unitDetail.course.id} · Unit {unitDetail.unit.sequence}: {unitDetail.unit.title}
      </p>
      <Card className="mt-5">
        <h2 className="text-lg text-ink">Saved</h2>
        {facts.saved.length ? (
          <ul className="mt-2 list-disc pl-5 text-sm text-ink-2">
            {facts.saved.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-ink-2">Nothing from this session has been saved yet.</p>
        )}
        <h2 className="mt-5 text-lg text-ink">Still open</h2>
        {facts.unresolved.length ? (
          <ul className="mt-2 list-disc pl-5 text-sm text-ink-2">
            {facts.unresolved.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-ink-2">Nothing is left open from this session.</p>
        )}
        {facts.nextStep ? (
          <>
            <h2 className="mt-5 text-lg text-ink">One possible next step</h2>
            <p className="mt-2 text-sm text-ink-2">{facts.nextStep}</p>
          </>
        ) : null}
        <form action={closeSessionAction} className="mt-6 flex flex-col gap-3">
          <input type="hidden" name="sessionId" value={session.id} />
          <label htmlFor="summary" className="text-sm text-ink">
            Your own summary (optional; kept as you write it)
          </label>
          <textarea
            id="summary"
            name="summary"
            rows={4}
            defaultValue={session.state.summary ?? ""}
            placeholder="Where you got to, in your words"
            className="w-full rounded-[var(--radius-control)] border border-stone-2 bg-paper px-3 py-2 text-sm text-ink"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" name="finished" value="0">
              Save and pause (resume any time)
            </Button>
            {session.status !== "completed" ? (
              <Button type="submit" name="finished" value="1" variant="secondary">
                Save and mark this activity finished
              </Button>
            ) : null}
            <Link href={`/sessions/${session.id}`} className="self-center text-sm text-ink-2 underline underline-offset-4">
              Back to the session
            </Link>
          </div>
          <p className="text-xs text-ink-3">Marking an activity finished records that you did it, not that you understood it.</p>
        </form>
      </Card>
    </div>
  );
}
