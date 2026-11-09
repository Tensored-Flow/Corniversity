import { getCourseDetail, getUnitDetail } from "@corniversity/db/services/catalogue";
import { labRevealState } from "@corniversity/db/services/lab-predictions";
import { getAttemptHistory, getSession } from "@corniversity/db/services/learning";
import { listEntries } from "@corniversity/db/services/notebook";
import { getOrCreateConversation, listMessages } from "@corniversity/db/services/tutoring";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AiLabel } from "@/components/AiLabel";
import { LocatorLink } from "@/components/LocatorLink";
import { Markdown } from "@/components/Markdown";
import { Badge, Card } from "@/components/ui";
import { db } from "@/lib/db";
import { renderMarkdown } from "@/lib/markdown";
import { producerLabels } from "@/lib/producers";
import { requireSession } from "@/lib/session";
import { AutoRefresh } from "./AutoRefresh";
import {
  completeSessionAction,
  fileReviewAction,
  requestHintAction,
  revealReferenceAction,
  saveDraftAction,
  submitAttemptAction,
} from "./actions";
import { FeedbackCard } from "./FeedbackCard";
import { LabInterpretation } from "./labs/LabInterpretation";
import { LabPanel } from "./labs/LabPanel";
import { TutorPanel } from "./TutorPanel";
import { Workbench } from "./Workbench";

export default async function SessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ exercise?: string }>;
}) {
  const { id } = await params;
  const { exercise: exerciseParam } = await searchParams;
  const auth = await requireSession(`/sessions/${id}`);
  const session = await getSession(db(), auth.user.id, id);
  if (!session) notFound();
  const unitDetail = await getUnitDetail(db(), session.unitId);
  if (!unitDetail) notFound();
  const activity = unitDetail.unit.activities.find((a) => a.id === session.activityId);
  if (!activity) notFound();
  const courseDetail = await getCourseDetail(db(), unitDetail.course.id);
  const tutor = courseDetail?.tutor ?? null;

  const exercises = unitDetail.exercises.filter((e) => activity.exerciseIds.includes(e.id));
  const selected = exercises.find((e) => e.id === exerciseParam) ?? exercises[0] ?? null;
  const history = selected ? await getAttemptHistory(db(), auth.user.id, selected.id) : [];
  const latestAttempt = history.at(-1)?.attempt ?? null;
  const reviewing = history.some((h) => h.versions.some((v) => v.run && (v.run.status === "queued" || v.run.status === "reviewing")));
  const locatorById = new Map(unitDetail.locators.map((l) => [l.id, l]));
  const sourceLocators = activity.sourceLocatorIds.map((lid) => locatorById.get(lid)).filter((l): l is NonNullable<typeof l> => Boolean(l));

  const conversation = await getOrCreateConversation(db(), {
    ownerId: auth.user.id,
    learningSessionId: session.id,
    role: "tutor",
    personaId: tutor?.id,
    purpose: "tutorial",
    unitId: unitDetail.unit.id,
    exerciseId: selected?.id,
    allowedLocatorIds: [...new Set([...unitDetail.unit.preparation.map((p) => p.locatorId), ...activity.sourceLocatorIds])],
  });
  const messages = await listMessages(db(), conversation.id);
  const producedBy = await producerLabels(
    db(),
    messages.map((m) => m.providerRunId),
  );
  const renderedMessages = await Promise.all(
    messages.map(async (m) => ({
      id: m.id,
      sender: m.sender,
      producedBy: producedBy(m.providerRunId),
      html: await renderMarkdown(
        m.contentMarkdown.replace(/\[(E\d+(?:,\s*E\d+)*)\]/g, (_s, g: string) =>
          g
            .split(/,\s*/)
            .map((t) => `[${t}](#cite-${t})`)
            .join(" "),
        ),
      ),
      citations: m.citations,
      labels: m.labels,
      uncited: m.uncitedClaims.length,
    })),
  );

  const isWorkbench = exercises.length > 0;
  const revealedHints = selected && latestAttempt ? selected.hintLadder.slice(0, latestAttempt.hintsUsed) : [];

  // A mathematics laboratory shows closed forms only after the unit's tutorial attempt has been
  // assessed or its reference revealed; until then it checks the learner's own numbers.
  const labId = activity.labId ?? null;
  const ASSESSED = new Set(["feedback_ready", "revision_requested", "needs_review", "accepted", "revised"]);
  let revealFormulas = false;
  let labNotes: { id: string; title: string; excerpt: string; when: string }[] = [];
  let predictionRecorded = false;
  if (labId) {
    for (const exercise of unitDetail.exercises) {
      const attempts = await getAttemptHistory(db(), auth.user.id, exercise.id);
      if (attempts.some((h) => Boolean(h.attempt.solutionRevealedAt) || ASSESSED.has(h.attempt.state))) revealFormulas = true;
    }
    predictionRecorded = (await labRevealState(db(), auth.user.id, unitDetail.unit.id, labId)).revealed;
    labNotes = (await listEntries(db(), auth.user.id, { unitId: unitDetail.unit.id, tag: labId, limit: 5 })).map((e) => ({
      id: e.id,
      title: e.title,
      excerpt: e.bodyMarkdown.replace(/\s+/g, " ").slice(0, 160),
      when: e.createdAt.toISOString().slice(0, 10),
    }));
  }
  const LAB_PROMPTS = [
    "What did the model do, and which equation or assumption explains that behaviour?",
    "Which setting changed the outcome most, and what stayed invariant when you changed it?",
    "What would you check next: an out-of-sample case, a limit, or a counterexample?",
  ];

  return (
    <div className="mx-auto w-full max-w-7xl">
      <AutoRefresh active={reviewing} intervalMs={4000} />
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-ink-3">
        <Link href={`/courses/${unitDetail.course.id}`} className="hover:text-ink">
          {unitDetail.course.id}
        </Link>
        <span className="mx-2">/</span>
        <Link href={`/courses/${unitDetail.course.id}/units/${unitDetail.unit.id}`} className="hover:text-ink">
          Unit {unitDetail.unit.sequence}: {unitDetail.unit.title}
        </Link>
        <span className="mx-2">/</span>
        <span>{activity.title}</span>
      </nav>

      <header className="mb-6 flex flex-wrap items-center gap-3">
        <Badge tone="brass">{activity.sessionKind.replace("_", " ")}</Badge>
        <h1 className="text-2xl text-ink">{activity.title}</h1>
        {session.status === "completed" ? <Badge tone="moss">completed</Badge> : null}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          {labId ? (
            <>
              <LabPanel labId={labId} revealFormulas={revealFormulas} sessionId={id} predictionRecorded={predictionRecorded} />
              <Card>
                <p className="text-sm text-ink-2">{activity.instructions}</p>
                <div className="mt-4">
                  <LabInterpretation sessionId={id} prompts={LAB_PROMPTS} previous={labNotes} />
                </div>
                {!isWorkbench && session.status !== "completed" ? (
                  <form action={completeSessionAction} className="mt-4">
                    <input type="hidden" name="sessionId" value={id} />
                    <button
                      type="submit"
                      className="rounded-[var(--radius-control)] border border-stone-2 bg-paper-2 px-3 py-1.5 text-sm hover:bg-paper-3"
                    >
                      Finish this laboratory
                    </button>
                  </form>
                ) : null}
              </Card>
            </>
          ) : null}
          {isWorkbench && selected ? (
            <>
              {exercises.length > 1 ? (
                <nav aria-label="Exercises" className="flex flex-wrap gap-2 text-sm">
                  {exercises.map((e) => (
                    <Link
                      key={e.id}
                      href={`/sessions/${id}?exercise=${e.id}`}
                      aria-current={e.id === selected.id ? "page" : undefined}
                      className={[
                        "rounded-[var(--radius-control)] border px-3 py-1.5",
                        e.id === selected.id
                          ? "border-brass bg-brass-soft text-brass-strong"
                          : "border-stone bg-paper-2 text-ink-2 hover:text-ink",
                      ].join(" ")}
                    >
                      {e.sequence}. {e.title}
                    </Link>
                  ))}
                </nav>
              ) : null}
              <Card>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{selected.kind.replace(/_/g, " ")}</Badge>
                  <span className="text-xs text-ink-3">about {selected.estimatedMinutes} min</span>
                  <span className="text-xs text-ink-3">· rubric v{selected.rubricVersion}</span>
                </div>
                <h2 className="mt-2 text-xl text-ink">{selected.title}</h2>
                <div className="mt-3">
                  <Markdown source={selected.promptMarkdown} />
                </div>
              </Card>
              <Workbench
                key={selected.id}
                sessionId={id}
                exerciseId={selected.id}
                attemptState={latestAttempt?.state ?? "draft"}
                attemptMode={latestAttempt?.mode ?? "practice"}
                initialDraft={latestAttempt?.draftMarkdown ?? ""}
                hints={revealedHints}
                hintsTotal={selected.hintLadder.length}
                solutionRevealed={Boolean(latestAttempt?.solutionRevealedAt)}
                saveDraft={saveDraftAction}
                requestHint={requestHintAction}
                submit={submitAttemptAction}
                reveal={revealReferenceAction}
              />
              {history.map((h) =>
                h.versions
                  .slice()
                  .reverse()
                  .map((v) => (
                    <FeedbackCard
                      key={v.id}
                      version={v.version}
                      submittedAt={v.submittedAt}
                      contentMarkdown={v.contentMarkdown}
                      run={v.run}
                      reviews={v.reviews}
                      fileReview={fileReviewAction}
                    />
                  )),
              )}
            </>
          ) : labId ? null : (
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-ink-2">{activity.instructions}</p>
                {session.status !== "completed" ? (
                  <form action={completeSessionAction}>
                    <input type="hidden" name="sessionId" value={id} />
                    <button
                      type="submit"
                      className="rounded-[var(--radius-control)] border border-stone-2 bg-paper-2 px-3 py-1.5 text-sm hover:bg-paper-3"
                    >
                      Mark as read
                    </button>
                  </form>
                ) : null}
              </div>
              <div className="mt-6">
                <Markdown source={unitDetail.unit.lessonMarkdown} />
              </div>
            </Card>
          )}
        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-6 lg:self-start">
          <Card as="aside">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg text-ink">{tutor?.name ?? "Tutor"}</h2>
              <AiLabel kind={tutor?.title ?? "tutor"} />
            </div>
            <TutorPanel
              sessionId={id}
              exerciseId={selected?.id ?? null}
              personaName={tutor?.name ?? "Tutor"}
              initialMessages={renderedMessages}
              locators={unitDetail.locators.map((l) => ({ id: l.id, label: l.label }))}
            />
          </Card>
          <Card as="aside">
            <h2 className="text-lg text-ink">Sources for this activity</h2>
            {sourceLocators.length === 0 ? (
              <p className="mt-2 text-sm text-ink-2">No sources attached to this activity.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2 text-sm">
                {sourceLocators.map((l) => (
                  <li key={l.id} id={`loc-${l.id}`}>
                    <LocatorLink label={l.label} locator={l.payload} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
