import { BLOCK_READINESS_LABEL, type BlockReadiness, programmeNextStep } from "@corniversity/core";
import { listDepartments } from "@corniversity/db/services/catalogue";
import {
  courseSourceLeads,
  learnerProgrammeMap,
  learnerProgress,
  listParticipation,
  programmeDetail,
  sourceTitles,
} from "@corniversity/db/services/programmes";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReadinessBadge, UnitStatusBadge } from "@/components/Readiness";
import { Badge, Button, Card, LinkButton, Notice } from "@/components/ui";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { askDirectorAction, followProgrammeAction, setProgrammeStatusAction, startPaperReportAction } from "../actions";

const READINESS_TONE: Record<BlockReadiness, "moss" | "brass" | "slate" | "neutral"> = {
  teaching_available: "moss",
  partly_prepared: "brass",
  sources_only: "slate",
  proposed: "neutral",
};

const SHORT: Record<BlockReadiness, string> = {
  teaching_available: "prepared",
  partly_prepared: "partly prepared",
  sources_only: "sources only",
  proposed: "proposed",
};

const STATE_TONE: Record<string, "moss" | "brass" | "slate" | "neutral" | "rust"> = {
  demonstrated: "moss",
  practised: "brass",
  introduced: "slate",
  unassessed: "neutral",
  revisit: "rust",
};

export default async function ProgrammePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const session = await requireSession(`/programmes/${id}`);
  const detail = await programmeDetail(db(), id);
  if (!detail) notFound();
  const { programme: p, courses } = detail;
  const [participation, departments, map, progress] = await Promise.all([
    listParticipation(db(), session.user.id),
    listDepartments(db()),
    learnerProgrammeMap(db(), session.user.id),
    learnerProgress(db(), session.user.id),
  ]);
  const mine = participation.find((x) => x.programmeId === p.id);
  const mineMap = map.find((m) => m.programme.id === p.id);
  const shelfIds = [
    ...p.blocks.flatMap((b) => b.sourceShelf.map((s) => s.sourceId).filter((x): x is string => Boolean(x))),
    ...(p.paperSeminar?.papers.map((x) => x.sourceId).filter((x): x is string => Boolean(x)) ?? []),
  ];
  const sources = await sourceTitles(db(), shelfIds);
  const deptTitle = new Map(departments.map((d) => [d.id, d.title]));
  const unitTitle = (courseId: string, unitId: string) => courses.get(courseId)?.units.find((u) => u.id === unitId);
  const shared = detail.workItems.filter((w) => w.blockIds.length > 1);
  const courseLeads = await courseSourceLeads(db(), [...new Set(p.blocks.flatMap((b) => b.courseMappings.map((m) => m.courseId)))]);
  const leadsOf = (block: (typeof p.blocks)[number]) =>
    block.sourceShelf.filter((s) => !s.sourceId).length +
    courseLeads.filter((l) => block.courseMappings.some((m) => m.courseId === l.courseId)).length;
  const next = programmeNextStep(
    mine ?? null,
    detail.blocks.map((b) => ({ ...b, leads: leadsOf(b.block) })),
    progress,
  );
  const bridges = detail.blocks.flatMap(({ block }) => block.bridges.map((b) => ({ ...b, blockId: block.id })));

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="mb-6">
        <p className="text-sm uppercase tracking-[0.18em] text-brass">
          Programme{p.referenceId ? <span className="ml-2 font-mono normal-case tracking-normal text-ink-3">{p.referenceId}</span> : null}
        </p>
        <h1 className="mt-1 text-3xl text-ink">{p.title}</h1>
        <p className="mt-1 text-xs text-ink-3">{p.departmentIds.map((d) => deptTitle.get(d) ?? d).join(" · ")}</p>
        <p className="mt-3 max-w-prose text-sm text-ink-2">{p.description}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {mine?.status === "following" ? (
            <>
              <Badge tone="moss">You follow this programme</Badge>
              <form action={setProgrammeStatusAction}>
                <input type="hidden" name="programmeId" value={p.id} />
                <input type="hidden" name="status" value="paused" />
                <Button type="submit" variant="quiet">
                  Pause
                </Button>
              </form>
              <form action={setProgrammeStatusAction}>
                <input type="hidden" name="programmeId" value={p.id} />
                <input type="hidden" name="status" value="left" />
                <Button type="submit" variant="quiet">
                  Stop following
                </Button>
              </form>
            </>
          ) : (
            <form action={followProgrammeAction}>
              <input type="hidden" name="programmeId" value={p.id} />
              <Button type="submit">{mine?.status === "paused" ? "Resume following" : "Follow this programme"}</Button>
            </form>
          )}
          {p.blocks.length ? (
            <form action={askDirectorAction}>
              <input type="hidden" name="programmeId" value={p.id} />
              <Button type="submit" variant="secondary">
                Ask the director for a route
              </Button>
            </form>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-ink-3">
          Following enrols you in nothing; you choose each course on its own page. The director's route is a draft for you to confirm or
          reject.
        </p>
        {query.saved ? (
          <div className="mt-3">
            <Notice tone="moss">{query.saved === "following" ? "You now follow this programme." : `Saved: ${query.saved}.`}</Notice>
          </div>
        ) : null}
        {query.error ? (
          <div className="mt-3">
            <Notice tone="rust">{query.error}</Notice>
          </div>
        ) : null}
      </header>

      {p.blocks.length === 0 ? (
        <Card as="section" aria-labelledby="stages-heading">
          <h2 id="stages-heading" className="text-lg text-ink">
            Stages
          </h2>
          <ol className="mt-3 flex flex-col gap-3">
            {p.stages.map((s) => (
              <li key={s.title}>
                <p className="text-sm font-medium text-ink">{s.title}</p>
                <ul className="mt-1 flex flex-col gap-1 text-sm">
                  {s.courses.map((c) => (
                    <li key={c.courseId} className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-ink-3">{c.courseId}</span>
                      <Link href={`/courses/${c.courseId}`} className="text-ink hover:underline">
                        {courses.get(c.courseId)?.title ?? c.courseId}
                      </Link>
                      <Badge>{c.role}</Badge>
                      {courses.get(c.courseId) ? <ReadinessBadge readiness={courses.get(c.courseId)!.readiness} /> : null}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </Card>
      ) : (
        <div className="flex flex-col gap-8">
          <section aria-labelledby="how-heading">
            <h2 id="how-heading" className="sr-only">
              How the programme works
            </h2>
            <Notice tone="neutral" title="Blocks, not courses">
              Each block is served by chosen units of one or more courses, and a unit can serve several blocks: it is still studied once and
              assessed once. The numbering is an order of ideas, not a chain of prerequisites; each block says what it needs and what can
              run alongside it. A block's status is worked out from its units, so it never claims more than the catalogue holds.
            </Notice>
          </section>

          <section aria-labelledby="begin-heading" className="grid gap-4 lg:grid-cols-[1fr_2fr]">
            <Card>
              <h2 id="begin-heading" className="text-lg text-ink">
                Where to begin
              </h2>
              <p className="mt-1 text-sm text-ink-2">{next.text}</p>
              <div className="mt-3">
                {next.kind === "open_unit" ? (
                  <LinkButton href={`/courses/${next.courseId}/units/${next.unitId}`}>Open {next.unitId}</LinkButton>
                ) : next.kind === "preview_course" ? (
                  <LinkButton href={`/courses/${next.courseId}#workload`}>Workload preview of {next.courseId}</LinkButton>
                ) : next.kind === "obtain_sources" ? (
                  <LinkButton href="/library/requests" variant="secondary">
                    Books to obtain
                  </LinkButton>
                ) : next.kind === "reflect" || next.kind === "open_studio" ? (
                  <LinkButton href="/studio" variant="secondary">
                    Research studio
                  </LinkButton>
                ) : null}
              </div>
              <p className="mt-3 text-xs text-ink-3">
                Each course page shows its workload, including the independent work, before you choose to enrol, audit or read it.
              </p>
            </Card>
            <Card as="div">
              <h3 className="text-lg text-ink">The route, by stage</h3>
              <p className="mt-1 text-xs text-ink-3">
                A suggested order of courses, not a chain of prerequisites: each block says what it needs and what can run alongside it.
              </p>
              <ol className="mt-3 flex flex-col gap-3">
                {p.stages.map((stage) => (
                  <li key={stage.title}>
                    <p className="text-sm font-medium text-ink">{stage.title}</p>
                    <ul className="mt-1 flex flex-col gap-1 text-sm">
                      {stage.courses.map((c) => {
                        const course = courses.get(c.courseId);
                        return (
                          <li key={c.courseId} className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs text-ink-3">{c.courseId}</span>
                            <Link href={`/courses/${c.courseId}`} className="text-ink hover:underline">
                              {course?.title ?? c.courseId}
                            </Link>
                            <Badge>{c.role}</Badge>
                            {course ? <ReadinessBadge readiness={course.readiness} /> : null}
                            {progress.activeCourseIds.has(c.courseId) ? <Badge tone="moss">you take it</Badge> : null}
                            {c.note ? <span className="basis-full text-xs text-ink-3">{c.note}</span> : null}
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ol>
              {bridges.length ? (
                <div className="mt-4 border-t border-stone pt-3">
                  <p className="text-sm font-medium text-ink">Bridges into the blocks</p>
                  <ul className="mt-1 list-disc pl-5 text-xs text-ink-2">
                    {bridges.map((b) => (
                      <li key={`${b.blockId}-${b.title}`}>
                        {b.blockId}: {b.title}
                        {b.courseId ? ` (${b.courseId}${b.unitIds.length ? `: ${b.unitIds.join(", ")}` : ""})` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </Card>
          </section>

          <section aria-labelledby="blocks-heading">
            <h2 id="blocks-heading" className="text-xl text-ink">
              The twelve blocks
            </h2>
            <ol className="mt-3 flex flex-col gap-3">
              {detail.blocks.map(({ block, report }) => {
                const learner = mineMap?.blocks.find((b) => b.blockId === block.id);
                return (
                  <Card key={block.id} as="li" id={block.id}>
                    <details>
                      <summary className="cursor-pointer list-none">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-ink-3">{block.id}</span>
                          <span className="text-base font-medium text-ink">{block.title}</span>
                          <Badge tone={READINESS_TONE[report.readiness]} title={BLOCK_READINESS_LABEL[report.readiness]}>
                            {SHORT[report.readiness]}
                          </Badge>
                          {learner?.focus ? <Badge tone="brass">your focus</Badge> : null}
                        </div>
                        <p className="mt-1 text-sm text-ink-2">{block.centralQuestion}</p>
                      </summary>
                      <p className="mt-2 text-sm">
                        <Link href={`/programmes/${p.id}/blocks/${block.id}`} className="text-brass underline underline-offset-4">
                          Open the {block.id} page: prerequisites for you, missing resources and a next step
                        </Link>
                      </p>
                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        <div className="flex flex-col gap-3 text-sm">
                          <p className="text-ink-2">
                            <span className="font-medium text-ink">Entry level. </span>
                            {block.entryLevel}
                          </p>
                          <p className="text-ink-2">
                            <span className="font-medium text-ink">Why it sits here. </span>
                            {block.prerequisiteReasoning}
                          </p>
                          {block.canStudyAlongside.length ? (
                            <p className="text-xs text-ink-3">Can run alongside: {block.canStudyAlongside.join(", ")}</p>
                          ) : null}
                          <div>
                            <p className="font-medium text-ink">Coverage</p>
                            <ul className="mt-1 list-disc pl-5 text-ink-2">
                              {block.requiredCoverage.map((c) => (
                                <li key={c}>{c}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                        <div className="flex flex-col gap-3 text-sm">
                          <div>
                            <p className="font-medium text-ink">Served by</p>
                            <ul className="mt-1 flex flex-col gap-2">
                              {block.courseMappings.map((m) => {
                                const c = courses.get(m.courseId);
                                return (
                                  <li key={m.courseId} className="rounded-[var(--radius-panel)] border border-stone bg-paper p-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-mono text-xs text-ink-3">{m.courseId}</span>
                                      <Link href={`/courses/${m.courseId}`} className="text-ink hover:underline">
                                        {c?.title ?? m.courseId}
                                      </Link>
                                      {c ? <ReadinessBadge readiness={c.readiness} /> : null}
                                    </div>
                                    <p className="mt-1 text-xs text-ink-2">{m.contribution}</p>
                                    {m.unitIds.length ? (
                                      <ul className="mt-1 flex flex-col gap-1">
                                        {m.unitIds.map((u) => {
                                          const unit = unitTitle(m.courseId, u);
                                          return (
                                            <li key={u} className="flex flex-wrap items-center gap-2 text-xs">
                                              <span className="font-mono text-ink-3">{u}</span>
                                              <span className="text-ink-2">{unit?.title ?? "unit not in the catalogue"}</span>
                                              {unit ? <UnitStatusBadge status={unit.status} /> : null}
                                            </li>
                                          );
                                        })}
                                      </ul>
                                    ) : (
                                      <p className="mt-1 text-xs text-ink-3">Units to be chosen once the course's sources are verified.</p>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                          {block.bridges.length ? (
                            <div>
                              <p className="font-medium text-ink">Targeted bridges</p>
                              <ul className="mt-1 list-disc pl-5 text-xs text-ink-2">
                                {block.bridges.map((b) => (
                                  <li key={b.title}>
                                    {b.title}
                                    {b.courseId ? ` (${b.courseId}${b.unitIds.length ? `: ${b.unitIds.join(", ")}` : ""})` : ""}: {b.note}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                          <div>
                            <p className="font-medium text-ink">Shelf</p>
                            <ul className="mt-1 flex flex-col gap-1 text-xs">
                              {block.sourceShelf.map((s) => (
                                <li key={s.sourceId ?? s.candidate} className="flex flex-wrap items-center gap-2">
                                  <Badge>{s.role}</Badge>
                                  {s.sourceId ? (
                                    <a
                                      href={sources.get(s.sourceId)?.canonicalUrl ?? "#"}
                                      className="text-ink underline underline-offset-4"
                                      rel="noreferrer"
                                    >
                                      {sources.get(s.sourceId)?.title ?? s.sourceId}
                                    </a>
                                  ) : (
                                    <>
                                      <span className="text-ink">{s.candidate}</span>
                                      <Badge tone="rust">lead, not yet verified</Badge>
                                    </>
                                  )}
                                  <span className="text-ink-3">{s.note}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-4 border-t border-stone pt-3 text-sm lg:grid-cols-2">
                        <div>
                          <p className="font-medium text-ink">Activities</p>
                          <ul className="mt-1 flex flex-col gap-1 text-ink-2">
                            {block.activities.map((a) => (
                              <li key={a.title}>
                                <span className="text-ink">{a.title}. </span>
                                {a.description}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="flex flex-col gap-2">
                          <p className="text-ink-2">
                            <span className="font-medium text-ink">Evidence of understanding. </span>
                            {block.evidenceOfUnderstanding}
                          </p>
                          {block.tutorGuidance ? (
                            <p className="text-xs text-ink-3">
                              <span className="font-medium">Tutor guidance. </span>
                              {block.tutorGuidance}
                            </p>
                          ) : null}
                          {block.gaps.length ? (
                            <p className="text-xs text-rust">
                              <span className="font-medium">Not yet in place. </span>
                              {block.gaps.join(" ")}
                            </p>
                          ) : null}
                          {learner ? (
                            <p className="text-xs text-ink-3">
                              You take {learner.takingCourseIds.length ? learner.takingCourseIds.join(", ") : "none of its courses"}; worked{" "}
                              {learner.unitsWorked.length} of {learner.unitsWorked.length + learner.unitsOpen.length} prepared units.
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </details>
                  </Card>
                );
              })}
            </ol>
          </section>

          {p.methods.length ? (
            <section aria-labelledby="methods-heading">
              <h2 id="methods-heading" className="text-xl text-ink">
                Modelling methods
              </h2>
              <p className="mt-1 max-w-prose text-sm text-ink-2">
                Each method is taught explicitly and has its own evidence state. Running notebook cells is activity; it is not evidence of
                understanding, and introduced, practised and demonstrated are shown separately.
              </p>
              <section
                className="mt-3 overflow-x-auto rounded-[var(--radius-panel)] border border-stone"
                // biome-ignore lint/a11y/noNoninteractiveTabindex: the table scrolls sideways on a phone and must be reachable by keyboard (axe: scrollable-region-focusable)
                tabIndex={0}
                aria-label="Modelling methods"
              >
                <table className="w-full min-w-[44rem] text-left text-sm">
                  <thead className="bg-paper-3 text-xs uppercase tracking-wide text-ink-3">
                    <tr>
                      <th className="px-3 py-2">Method</th>
                      <th className="px-3 py-2">Prepared units</th>
                      <th className="px-3 py-2">Planned in</th>
                      <th className="px-3 py-2">Evidence</th>
                      {mineMap ? <th className="px-3 py-2">Your state</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {p.methods.map((m) => {
                      const cover = mineMap?.methods.find((x) => x.methodId === m.id);
                      return (
                        <tr key={m.id} className="border-t border-stone align-top">
                          <td className="px-3 py-2 text-ink">
                            <span className="font-mono text-xs text-ink-3">{m.section}</span> {m.title}
                          </td>
                          <td className="px-3 py-2 text-xs text-ink-2">
                            {m.units.length
                              ? m.units.map((u) => (
                                  <span key={`${u.unitId}-${u.role}`} className="block">
                                    {u.unitId} ({u.role}) {unitTitle(u.courseId, u.unitId)?.status === "ready" ? "" : "· not prepared"}
                                  </span>
                                ))
                              : "none yet"}
                          </td>
                          <td className="px-3 py-2 text-xs text-ink-2">
                            {m.plannedIn.map((pl) => (
                              <span key={pl.courseId + pl.note} className="block">
                                {pl.courseId}: {pl.note}
                              </span>
                            ))}
                          </td>
                          <td className="px-3 py-2 text-xs text-ink-2">{m.evidence}</td>
                          {mineMap ? (
                            <td className="px-3 py-2">
                              <Badge tone={STATE_TONE[cover?.state ?? "unassessed"]}>{cover?.state ?? "unassessed"}</Badge>
                            </td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            </section>
          ) : null}

          {p.electives.length ? (
            <section aria-labelledby="electives-heading">
              <h2 id="electives-heading" className="text-xl text-ink">
                Electives
              </h2>
              <ul className="mt-3 grid gap-3 md:grid-cols-2">
                {p.electives.map((e) => {
                  const c = courses.get(e.courseId);
                  const notes = c?.catalogueNotes ?? {};
                  return (
                    <Card key={e.courseId} as="li">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-ink-3">{e.courseId}</span>
                        <Link href={`/courses/${e.courseId}`} className="text-base text-ink hover:underline">
                          {c?.title ?? e.courseId}
                        </Link>
                        {c ? <ReadinessBadge readiness={c.readiness} /> : null}
                      </div>
                      {notes.centralQuestion ? <p className="mt-1 text-sm text-ink-2">{notes.centralQuestion}</p> : null}
                      <p className="mt-1 text-xs text-ink-3">
                        Connects to {e.connectsToBlockIds.join(", ")}. {e.note}
                      </p>
                      {notes.prerequisiteGuidance ? (
                        <p className="mt-2 text-xs text-ink-2">
                          <span className="font-medium text-ink">Before it: </span>
                          {notes.prerequisiteGuidance}
                        </p>
                      ) : null}
                      {notes.preparationPath ? (
                        <p className="mt-1 text-xs text-ink-2">
                          <span className="font-medium text-ink">How it would be prepared: </span>
                          {notes.preparationPath}
                        </p>
                      ) : null}
                    </Card>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {p.paperSeminar ? (
            <section aria-labelledby="seminar-heading">
              <h2 id="seminar-heading" className="text-xl text-ink">
                {p.paperSeminar.title}
              </h2>
              <p className="mt-1 max-w-prose text-sm text-ink-2">
                {p.paperSeminar.description} {p.paperSeminar.papers.length} of at most {p.paperSeminar.maxPapers} papers. Discuss one in the{" "}
                <Link href="/common-room" className="text-brass underline underline-offset-4">
                  common room
                </Link>{" "}
                if you want company.
              </p>
              <ul className="mt-3 flex flex-col gap-2">
                {p.paperSeminar.papers.map((paper, i) => (
                  <li
                    key={paper.sourceId ?? paper.candidate}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-panel)] border border-stone bg-paper-2 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="text-ink">
                        {paper.sourceId ? (sources.get(paper.sourceId)?.title ?? paper.sourceId) : paper.candidate}{" "}
                        {paper.sourceId ? null : <Badge tone="rust">lead, not yet verified</Badge>}
                      </p>
                      <p className="text-xs text-ink-3">
                        {paper.blockIds.join(", ")} · {paper.focus}
                      </p>
                    </div>
                    <form action={startPaperReportAction}>
                      <input type="hidden" name="programmeId" value={p.id} />
                      <input type="hidden" name="paper" value={i} />
                      <Button type="submit" variant="secondary">
                        Start a report
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-ink-3">
                A report opens in your notebook with these headings: {p.paperSeminar.reportHeadings.join(", ")}.
              </p>
            </section>
          ) : null}

          {shared.length ? (
            <section aria-labelledby="shared-heading">
              <h2 id="shared-heading" className="text-xl text-ink">
                Units that serve more than one block
              </h2>
              <p className="mt-1 text-sm text-ink-2">Studied once, assessed once, and counted towards each block it serves.</p>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {shared.map((w) => (
                  <li key={w.unitId}>
                    <span className="font-mono text-xs text-ink-3">{w.unitId}</span> {unitTitle(w.courseId, w.unitId)?.title ?? ""}:{" "}
                    <span className="text-ink-2">{w.blockIds.join(", ")}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
