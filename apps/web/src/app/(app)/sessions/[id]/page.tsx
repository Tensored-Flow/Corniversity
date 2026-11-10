import { modelLabel, publicProviderState } from "@corniversity/ai";
import { pageOfLine } from "@corniversity/core/paper/transcription";
import { getEnv } from "@corniversity/db/env";
import { unitPrerequisiteView } from "@corniversity/db/services/bridges";
import { getCourseDetail, getUnitDetail } from "@corniversity/db/services/catalogue";
import { labRevealState } from "@corniversity/db/services/lab-predictions";
import { getAttemptHistory, getSession } from "@corniversity/db/services/learning";
import { listEntries } from "@corniversity/db/services/notebook";
import { latestTranscriptionJob, listTranscriptions, listWorkPages } from "@corniversity/db/services/paper-work";
import { resolveProviderState } from "@corniversity/db/services/provider-config";
import { resumeSession, sessionContinuity, sessionNotes } from "@corniversity/db/services/study-session";
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
  pauseSessionAction,
  requestHintAction,
  revealReferenceAction,
  saveDraftAction,
  startAttemptAction,
  submitAttemptAction,
} from "./actions";
import { ContextPanel } from "./ContextPanel";
import { ExternalProgress } from "./ExternalProgress";
import { FeedbackCard } from "./FeedbackCard";
import { LessonReader } from "./LessonReader";
import { LabInterpretation } from "./labs/LabInterpretation";
import { LabPanel } from "./labs/LabPanel";
import { NotesPanel } from "./NotesPanel";
import { PaperWork } from "./PaperWork";
import { TutorPanel } from "./TutorPanel";
import { Workbench } from "./Workbench";
import { WorkspaceProvider } from "./Workspace";

const EVIDENCE_TEXT = {
  supported_by_work: { label: "supported by your submitted work", tone: "moss" as const },
  self_reported: { label: "you reported knowing it (unverified)", tone: "slate" as const },
  not_shown: { label: "not yet shown in your work", tone: "neutral" as const },
};

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
  const ownerId = auth.user.id;
  let session = await getSession(db(), ownerId, id);
  if (!session) notFound();
  // Opening a paused session resumes it, where it was left.
  const wasPaused = Boolean(session.state.pausedAt);
  if (wasPaused) session = (await resumeSession(db(), ownerId, id)) ?? session;
  const unitDetail = await getUnitDetail(db(), session.unitId);
  if (!unitDetail) notFound();
  const activity = unitDetail.unit.activities.find((a) => a.id === session.activityId);
  if (!activity) notFound();
  const courseDetail = await getCourseDetail(db(), unitDetail.course.id);
  const tutor = courseDetail?.tutor ?? null;

  const exercises = unitDetail.exercises.filter((e) => activity.exerciseIds.includes(e.id));
  const selected = exercises.find((e) => e.id === exerciseParam) ?? exercises[0] ?? null;
  const history = selected ? await getAttemptHistory(db(), ownerId, selected.id) : [];
  const latestAttempt = history.at(-1)?.attempt ?? null;
  const submitted = history.some((h) => h.versions.length > 0);
  const reviewing = history.some((h) => h.versions.some((v) => v.run && (v.run.status === "queued" || v.run.status === "reviewing")));
  const locatorById = new Map(unitDetail.locators.map((l) => [l.id, l]));
  const sourceLocators = activity.sourceLocatorIds.map((lid) => locatorById.get(lid)).filter((l): l is NonNullable<typeof l> => Boolean(l));
  const videos = sourceLocators.filter((l) => l.payload.kind === "video").map((l) => ({ id: l.id, label: l.label }));
  const externalReading = sourceLocators.some(
    (l) => l.payload.kind === "book_reference" || l.payload.kind === "web" || l.payload.kind === "pdf",
  );

  const conversation = await getOrCreateConversation(db(), {
    ownerId,
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
  const lessonHtml = await renderMarkdown(unitDetail.unit.lessonMarkdown);
  const continuity = await sessionContinuity(db(), ownerId, session, activity.exerciseIds);
  const notes = await sessionNotes(db(), ownerId, session.id);
  const prerequisites = await unitPrerequisiteView(db(), ownerId, unitDetail.unit.id);
  const providerState = publicProviderState(await resolveProviderState(db(), ownerId, getEnv()));

  // Paper work for the selected exercise.
  const pages = latestAttempt ? await listWorkPages(db(), ownerId, latestAttempt.id) : [];
  const transcriptions = latestAttempt ? await listTranscriptions(db(), ownerId, latestAttempt.id) : [];
  const transcriptionJob = latestAttempt ? await latestTranscriptionJob(db(), ownerId, latestAttempt.id) : null;
  const transcriptionVersionById = new Map(transcriptions.map((t) => [t.id, t]));
  const latestTranscriptionVersion = transcriptions[0]?.version ?? 0;

  // A mathematics laboratory shows closed forms only after the unit's tutorial attempt has been
  // assessed or its reference revealed; until then it checks the learner's own numbers.
  const labId = activity.labId ?? null;
  const ASSESSED = new Set(["feedback_ready", "revision_requested", "needs_review", "accepted", "revised"]);
  let revealFormulas = false;
  let labNotes: { id: string; title: string; excerpt: string; when: string }[] = [];
  let predictionRecorded = false;
  if (labId) {
    for (const exercise of unitDetail.exercises) {
      const attempts = await getAttemptHistory(db(), ownerId, exercise.id);
      if (attempts.some((h) => Boolean(h.attempt.solutionRevealedAt) || ASSESSED.has(h.attempt.state))) revealFormulas = true;
    }
    predictionRecorded = (await labRevealState(db(), ownerId, unitDetail.unit.id, labId)).revealed;
    labNotes = (await listEntries(db(), ownerId, { unitId: unitDetail.unit.id, tag: labId, limit: 5 })).map((e) => ({
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
  const at = (d: Date) => d.toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" });
  const firstSource = sourceLocators[0];

  return (
    <WorkspaceProvider>
      <div className="mx-auto w-full max-w-7xl">
        <AutoRefresh
          active={reviewing || transcriptionJob?.status === "queued" || transcriptionJob?.status === "active"}
          intervalMs={4000}
        />
        <nav aria-label="Breadcrumb" className="mb-3 text-sm text-ink-3">
          <Link href={`/courses/${unitDetail.course.id}`} className="hover:text-ink">
            {unitDetail.course.id} {unitDetail.course.title}
          </Link>
          <span className="mx-2">/</span>
          <Link href={`/courses/${unitDetail.course.id}/units/${unitDetail.unit.id}`} className="hover:text-ink">
            Unit {unitDetail.unit.sequence}: {unitDetail.unit.title}
          </Link>
        </nav>

        <header className="mb-5 rounded-[var(--radius-panel)] border border-stone bg-paper-2 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brass">{activity.sessionKind.replace("_", " ")}</Badge>
            <h1 className="text-xl text-ink">{activity.title}</h1>
            {session.status === "completed" ? <Badge tone="moss">completed</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-ink-2">
            <span className="text-ink-3">Objective:</span> {unitDetail.unit.objectives[0]?.description}
          </p>
          <p className="mt-1 text-xs text-ink-3">
            Source:{" "}
            {firstSource ? <LocatorLink label={firstSource.label} locator={firstSource.payload} /> : "no source attached to this activity"}
            {sourceLocators.length > 1 ? ` and ${sourceLocators.length - 1} more (Sources tab)` : ""}
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-ink-3" data-testid="last-durable">
              {continuity.lastDurable
                ? `Last saved on the server: ${continuity.lastDurable.what}, ${at(continuity.lastDurable.at)}.`
                : "Nothing from this session is saved yet."}
            </p>
            {session.status !== "completed" ? (
              <div className="flex gap-2">
                <form action={pauseSessionAction}>
                  <input type="hidden" name="sessionId" value={session.id} />
                  <button
                    type="submit"
                    className="rounded-[var(--radius-control)] border border-stone-2 bg-paper px-3 py-1 text-sm hover:bg-paper-3"
                  >
                    Pause
                  </button>
                </form>
                <Link
                  href={`/sessions/${session.id}/close${selected ? `?exercise=${selected.id}` : ""}`}
                  className="rounded-[var(--radius-control)] border border-stone-2 bg-paper px-3 py-1 text-sm hover:bg-paper-3"
                >
                  Finish for now
                </Link>
              </div>
            ) : null}
          </div>
          {wasPaused ? (
            <p className="mt-2 text-xs text-ink-2" role="status">
              Resumed from where you paused{continuity.readerAnchor ? ", at your place in the lesson" : ""}. Your work is as you left it.
            </p>
          ) : null}
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
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
                <details className="rounded-[var(--radius-panel)] border border-stone bg-paper-2 p-4">
                  <summary className="cursor-pointer text-sm text-ink">
                    The unit's lesson, for reference (select a line to ask about it)
                  </summary>
                  <div className="mt-4">
                    <LessonReader sessionId={session.id} html={lessonHtml} initialAnchor={null} />
                  </div>
                </details>
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
                  key={`${selected.id}-${latestAttempt?.id ?? "new"}`}
                  sessionId={id}
                  exerciseId={selected.id}
                  attemptState={latestAttempt?.state ?? "draft"}
                  attemptMode={latestAttempt?.mode ?? "practice"}
                  submitted={submitted}
                  initialDraft={latestAttempt?.draftMarkdown ?? ""}
                  initialRevision={latestAttempt?.draftRevision ?? 0}
                  initialSavedAt={latestAttempt?.draftSavedAt?.toISOString() ?? null}
                  hints={revealedHints}
                  hintsTotal={selected.hintLadder.length}
                  solutionRevealed={Boolean(latestAttempt?.solutionRevealedAt)}
                  saveDraft={saveDraftAction}
                  requestHint={requestHintAction}
                  submit={submitAttemptAction}
                  reveal={revealReferenceAction}
                  startAttempt={startAttemptAction}
                  fresh={
                    !latestAttempt ||
                    (latestAttempt.state === "draft" &&
                      !latestAttempt.draftMarkdown?.trim() &&
                      latestAttempt.hintsUsed === 0 &&
                      !latestAttempt.solutionRevealedAt &&
                      !(history.at(-1)?.versions.length ?? 0))
                  }
                />
                <details
                  className="rounded-[var(--radius-panel)] border border-stone bg-paper-2"
                  open={pages.length > 0 || transcriptions.length > 0}
                >
                  <summary className="cursor-pointer px-5 py-3 text-sm text-ink">
                    Working on paper? Attach photographs or a PDF of your pages
                  </summary>
                  <PaperWork
                    sessionId={id}
                    exerciseId={selected.id}
                    pages={pages.map((p) => ({
                      id: p.id,
                      position: p.position,
                      mime: p.mime,
                      rotation: p.rotation,
                      metadataStripped: p.metadataStripped,
                    }))}
                    transcriptions={transcriptions.map((t) => ({
                      version: t.version,
                      text: t.text,
                      source: t.source,
                      confirmed: Boolean(t.confirmedAt),
                    }))}
                    provider={{
                      mode: providerState.mode,
                      label: providerState.mode === "live" ? `Anthropic (${modelLabel(providerState.model)})` : "",
                      reason: providerState.mode === "blocked" ? providerState.reason : undefined,
                    }}
                    transcriptionJob={transcriptionJob ? { status: transcriptionJob.status, error: transcriptionJob.error } : null}
                    closed={latestAttempt?.state === "accepted" || latestAttempt?.state === "reviewing"}
                  />
                </details>
                {/* The current attempt's feedback first, newest version first; earlier attempts below. */}
                {[...history].reverse().map((h) =>
                  h.versions
                    .slice()
                    .reverse()
                    .map((v) => {
                      const tv = v.transcriptionVersionId ? transcriptionVersionById.get(v.transcriptionVersionId) : undefined;
                      const lines = v.contentMarkdown.split("\n").length;
                      return (
                        <FeedbackCard
                          key={v.id}
                          version={v.version}
                          submittedAt={v.submittedAt}
                          contentMarkdown={v.contentMarkdown}
                          run={v.run}
                          currentRubricVersion={selected.rubricVersion}
                          reviews={v.reviews}
                          fileReview={fileReviewAction}
                          paper={
                            tv
                              ? {
                                  transcriptionVersion: tv.version,
                                  latestTranscriptionVersion,
                                  pageOfLine: Object.fromEntries(
                                    Array.from({ length: lines }, (_, i) => [i + 1, pageOfLine(v.contentMarkdown, i + 1)]),
                                  ),
                                }
                              : undefined
                          }
                        />
                      );
                    }),
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
                  <LessonReader sessionId={session.id} html={lessonHtml} initialAnchor={session.state.readerAnchor ?? null} />
                </div>
              </Card>
            )}
          </div>

          <aside className="flex flex-col gap-6 lg:sticky lg:top-6 lg:self-start">
            <ContextPanel
              counts={{ notes: notes.length, prerequisites: prerequisites.filter((p) => p.evidence === "not_shown").length }}
              panels={{
                tutor: (
                  <>
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
                  </>
                ),
                notes: (
                  <NotesPanel
                    sessionId={session.id}
                    videos={videos}
                    notes={notes.map((n) => ({
                      id: n.id,
                      title: n.title,
                      excerpt: n.bodyMarkdown.replace(/\s+/g, " ").slice(0, 160),
                      kind: n.kind,
                      resolved: n.resolved,
                      when: n.createdAt.toISOString().slice(0, 10),
                    }))}
                  />
                ),
                prerequisites:
                  prerequisites.length === 0 ? (
                    <p className="text-sm text-ink-2">This unit lists no prerequisite concepts.</p>
                  ) : (
                    <ul className="flex flex-col gap-3">
                      {prerequisites.map((p) => (
                        <li key={p.conceptId} className="rounded-[var(--radius-control)] border border-stone bg-paper px-3 py-2 text-sm">
                          <p className="font-medium text-ink">{p.title}</p>
                          <p className="mt-1 text-xs">
                            <Badge tone={EVIDENCE_TEXT[p.evidence].tone}>{EVIDENCE_TEXT[p.evidence].label}</Badge>
                          </p>
                          {p.bridge === "prepared" ? (
                            <Link
                              className="mt-2 inline-block text-sm text-brass underline underline-offset-4"
                              href={`/bridges/open?concept=${p.conceptId}&from=${session.id}${selected ? `&exercise=${selected.id}` : ""}`}
                            >
                              Explain this prerequisite
                            </Link>
                          ) : (
                            <p className="mt-2 text-xs text-ink-3">
                              No bridge is prepared for this concept yet. It is still a prerequisite: ask the tutor about it, or the
                              director for a short study route.
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  ),
                sources: (
                  <div className="flex flex-col gap-4">
                    {sourceLocators.length === 0 ? (
                      <p className="text-sm text-ink-2">No sources attached to this activity.</p>
                    ) : (
                      <ul className="flex flex-col gap-2 text-sm">
                        {sourceLocators.map((l) => (
                          <li key={l.id} id={`loc-${l.id}`}>
                            <LocatorLink label={l.label} locator={l.payload} />
                          </li>
                        ))}
                      </ul>
                    )}
                    {videos.length ? (
                      <p className="text-xs text-ink-3">
                        Lectures open on their own site; the site's player is not controlled from here. Note a moment with its time (mm:ss)
                        in the Notes tab.
                      </p>
                    ) : null}
                    {externalReading ? <ExternalProgress sessionId={session.id} current={session.state.externalProgress} /> : null}
                  </div>
                ),
              }}
            />
          </aside>
        </div>
      </div>
    </WorkspaceProvider>
  );
}
