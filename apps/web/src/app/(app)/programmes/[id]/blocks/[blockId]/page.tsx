import { BLOCK_READINESS_LABEL, type BlockReadiness, blockLearnerView, blockNextStep, type NextStep } from "@corniversity/core";
import { assessPrerequisites } from "@corniversity/db/services/programme";
import { courseSourceLeads, learnerProgress, listParticipation, programmeDetail, sourceTitles } from "@corniversity/db/services/programmes";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReadinessBadge, UnitStatusBadge } from "@/components/Readiness";
import { Badge, Card, LinkButton, Notice } from "@/components/ui";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";

const READINESS_TONE: Record<BlockReadiness, "moss" | "brass" | "slate" | "neutral"> = {
  teaching_available: "moss",
  partly_prepared: "brass",
  sources_only: "slate",
  proposed: "neutral",
};

/**
 * One programme block on its own page: the question it answers and its scope, the courses and
 * exact units that serve it (or that are only planned), prerequisites and their alternatives,
 * activities and the evidence of understanding expected, the status of its sources, what is
 * missing, the curriculum's readiness and, separately, the learner's own progress, and one next
 * step. Readiness describes the curriculum; it never says what the learner understands.
 */
export default async function BlockPage({ params }: { params: Promise<{ id: string; blockId: string }> }) {
  const { id, blockId } = await params;
  const session = await requireSession(`/programmes/${id}/blocks/${blockId}`);
  const detail = await programmeDetail(db(), id);
  const entry = detail?.blocks.find((b) => b.block.id === blockId);
  if (!detail || !entry) notFound();
  const { block, report } = entry;
  const p = detail.programme;
  const [progress, participation] = await Promise.all([learnerProgress(db(), session.user.id), listParticipation(db(), session.user.id)]);
  const mine = participation.find((x) => x.programmeId === p.id);
  const learner = blockLearnerView(block, p.blocks, detail.courses, progress);
  const next = blockNextStep(block, report, progress);
  const sources = await sourceTitles(
    db(),
    block.sourceShelf.map((s) => s.sourceId).filter((x): x is string => Boolean(x)),
  );
  const servingCourses = block.courseMappings
    .filter((m) => m.unitIds.some((u) => report.preparedUnitIds.includes(u)))
    .map((m) => m.courseId);
  const prerequisites = await Promise.all(
    servingCourses.map(async (c) => ({ courseId: c, rules: await assessPrerequisites(db(), session.user.id, c) })),
  );
  const unit = (courseId: string, unitId: string) => detail.courses.get(courseId)?.units.find((u) => u.id === unitId);
  const leads = block.sourceShelf.filter((s) => !s.sourceId);
  const courseLeads = await courseSourceLeads(
    db(),
    block.courseMappings.map((m) => m.courseId),
  );
  const missingCount =
    leads.length + courseLeads.length + report.unpreparedUnitIds.length + report.coursesToRefine.length + report.missingUnitIds.length;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-ink-3">
        <Link href="/programmes" className="hover:text-ink">
          Programmes
        </Link>
        <span className="mx-2">/</span>
        <Link href={`/programmes/${p.id}#${block.id}`} className="hover:text-ink">
          {p.title}
        </Link>
        <span className="mx-2">/</span>
        <span>{block.id}</span>
      </nav>
      <header className="mb-6">
        <p className="text-sm uppercase tracking-[0.18em] text-brass">
          Block <span className="font-mono normal-case tracking-normal text-ink-3">{block.id}</span>
          {mine?.focusBlockIds.includes(block.id) ? (
            <span className="ml-2">
              <Badge tone="brass">your focus</Badge>
            </span>
          ) : null}
        </p>
        <h1 className="mt-1 text-3xl text-ink">{block.title}</h1>
        <p className="mt-2 max-w-prose text-base text-ink-2">{block.centralQuestion}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        {/* On a phone the side column comes last, so the next step is shown first here instead. */}
        <NextStepCard next={next} headingId="next-heading-top" className="lg:hidden" />
        <div className="flex flex-col gap-6">
          <Card as="section" aria-labelledby="scope-heading">
            <h2 id="scope-heading" className="text-lg text-ink">
              Scope
            </h2>
            <p className="mt-1 text-sm text-ink-2">
              <span className="font-medium text-ink">Entry level. </span>
              {block.entryLevel}
            </p>
            <ul className="mt-2 list-disc pl-5 text-sm text-ink-2">
              {block.requiredCoverage.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </Card>

          <Card as="section" aria-labelledby="courses-heading">
            <h2 id="courses-heading" className="text-lg text-ink">
              Courses and units that serve it
            </h2>
            <ul className="mt-3 flex flex-col gap-3">
              {block.courseMappings.length === 0 ? <li className="text-sm text-ink-2">No course is mapped yet.</li> : null}
              {block.courseMappings.map((m) => {
                const c = detail.courses.get(m.courseId);
                return (
                  <li key={m.courseId} className="rounded-[var(--radius-panel)] border border-stone bg-paper p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-ink-3">{m.courseId}</span>
                      <Link href={`/courses/${m.courseId}`} className="text-ink hover:underline">
                        {c?.title ?? m.courseId}
                      </Link>
                      {c ? <ReadinessBadge readiness={c.readiness} /> : null}
                    </div>
                    <p className="mt-1 text-xs text-ink-2">{m.contribution}</p>
                    {m.unitIds.length ? (
                      <ul className="mt-2 flex flex-col gap-1">
                        {m.unitIds.map((u) => {
                          const row = unit(m.courseId, u);
                          const shared = learner.sharedUnits.find((s) => s.unitId === u);
                          return (
                            <li key={u} className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="font-mono text-ink-3">{u}</span>
                              {row?.status === "ready" ? (
                                <Link href={`/courses/${m.courseId}/units/${u}`} className="text-ink underline underline-offset-2">
                                  {row.title}
                                </Link>
                              ) : (
                                <span className="text-ink-2">{row?.title ?? "unit not in the catalogue"}</span>
                              )}
                              {row ? <UnitStatusBadge status={row.status} /> : null}
                              {shared ? <span className="text-ink-3">also serves {shared.alsoServes.join(", ")}</span> : null}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-ink-3">Planned: units are chosen once this course&apos;s sources are verified.</p>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs text-ink-3">
              A unit that serves several blocks is studied once and assessed once; its evidence counts towards each block it serves.
            </p>
          </Card>

          <Card as="section" aria-labelledby="prereq-heading">
            <h2 id="prereq-heading" className="text-lg text-ink">
              Prerequisites and alternatives
            </h2>
            <p className="mt-1 text-sm text-ink-2">{block.prerequisiteReasoning}</p>
            {block.canStudyAlongside.length ? (
              <p className="mt-2 text-xs text-ink-3">
                Can run alongside:{" "}
                {block.canStudyAlongside.map((b, i) => (
                  <span key={b}>
                    {i ? ", " : ""}
                    <Link href={`/programmes/${p.id}/blocks/${b}`} className="underline underline-offset-2">
                      {b}
                    </Link>
                  </span>
                ))}
                . The numbering is an order of ideas, not a chain of prerequisites.
              </p>
            ) : null}
            {block.bridges.length ? (
              <div className="mt-3">
                <p className="text-sm font-medium text-ink">Targeted bridges</p>
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
            {prerequisites.some((x) => x.rules.length) ? (
              <div className="mt-3">
                <p className="text-sm font-medium text-ink">For you, rule by rule</p>
                <ul className="mt-1 flex flex-col gap-1 text-xs text-ink-2">
                  {prerequisites.flatMap(({ courseId, rules }) =>
                    rules.map((r) => (
                      <li key={r.ruleId}>
                        <Badge tone={r.satisfied ? (r.basis === "evidence" ? "moss" : "slate") : "rust"}>
                          {r.satisfied ? (r.basis === "evidence" ? "met by your work" : "met by your own report") : "not yet shown"}
                        </Badge>{" "}
                        {courseId} ({r.strength}): {r.description}
                        {!r.satisfied && r.alternativeCourseIds.length ? ` Met by: ${r.alternativeCourseIds.join(", ")}.` : ""}
                      </li>
                    )),
                  )}
                </ul>
                <p className="mt-1 text-xs text-ink-3">
                  Each rule is met only by its own concepts: a background in one subject does not stand in for another.
                </p>
              </div>
            ) : null}
          </Card>

          <Card as="section" aria-labelledby="activities-heading">
            <h2 id="activities-heading" className="text-lg text-ink">
              Activities and evidence of understanding
            </h2>
            <ul className="mt-2 flex flex-col gap-2 text-sm text-ink-2">
              {block.activities.map((a) => (
                <li key={a.title}>
                  <span className="text-ink">{a.title}. </span>
                  {a.description}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-ink-2">
              <span className="font-medium text-ink">Evidence of understanding. </span>
              {block.evidenceOfUnderstanding}
            </p>
          </Card>

          <Card as="section" aria-labelledby="sources-heading">
            <h2 id="sources-heading" className="text-lg text-ink">
              Sources
            </h2>
            <ul className="mt-2 flex flex-col gap-2 text-xs">
              {block.sourceShelf.map((s) => (
                <li key={s.sourceId ?? s.candidate} className="flex flex-wrap items-center gap-2">
                  <Badge>{s.role}</Badge>
                  {s.sourceId ? (
                    <>
                      <a
                        href={sources.get(s.sourceId)?.canonicalUrl ?? "#"}
                        className="text-ink underline underline-offset-4"
                        rel="noreferrer"
                      >
                        {sources.get(s.sourceId)?.title ?? s.sourceId}
                      </a>
                      <Badge tone="moss">verified record</Badge>
                    </>
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
            <p className="mt-2 text-xs text-ink-3">
              A verified record means the source was opened and its edition and locations checked; it does not mean every lesson here draws
              on it. Leads are never cited.
            </p>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <NextStepCard next={next} headingId="next-heading" className="hidden lg:block" />

          <Card as="section" aria-labelledby="readiness-heading">
            <h2 id="readiness-heading" className="text-lg text-ink">
              Curriculum readiness
            </h2>
            <p className="mt-2">
              <Badge tone={READINESS_TONE[report.readiness]}>{BLOCK_READINESS_LABEL[report.readiness]}</Badge>
            </p>
            <p className="mt-2 text-xs text-ink-2">
              {report.preparedUnitIds.length} mapped unit{report.preparedUnitIds.length === 1 ? "" : "s"} prepared,{" "}
              {report.unpreparedUnitIds.length} outlined
              {report.coursesToRefine.length ? `, ${report.coursesToRefine.length} course(s) without units chosen` : ""}. Worked out from
              the catalogue; it describes what can be taught, not what you understand.
            </p>
          </Card>

          <Card as="section" aria-labelledby="progress-heading">
            <h2 id="progress-heading" className="text-lg text-ink">
              Your progress
            </h2>
            <p className="mt-1 text-xs text-ink-2">
              You take {learner.takingCourseIds.length ? learner.takingCourseIds.join(", ") : "none of its courses"}. You have completed a
              session of {learner.unitsWorked.length} of its {report.preparedUnitIds.length} prepared unit
              {report.preparedUnitIds.length === 1 ? "" : "s"}.
            </p>
            <p className="mt-2 text-xs text-ink-3">
              Completed sessions are activity. What you have shown you understand is recorded per concept from assessed work, on My Studies.
            </p>
          </Card>

          <Card as="section" aria-labelledby="missing-heading">
            <h2 id="missing-heading" className="text-lg text-ink">
              Missing resources
            </h2>
            {missingCount === 0 && block.gaps.length === 0 ? (
              <p className="mt-1 text-sm text-ink-2">Nothing recorded as missing.</p>
            ) : (
              <ul className="mt-2 list-disc pl-5 text-xs text-ink-2">
                {leads.map((s) => (
                  <li key={s.candidate}>Source to identify: {s.candidate} (a lead on the library&apos;s list, not a citation)</li>
                ))}
                {courseLeads.map((l) => (
                  <li key={`${l.courseId}:${l.name}`}>
                    Source to identify for {l.courseId}: {l.name} (a lead on the library&apos;s list, not a citation)
                  </li>
                ))}
                {report.unpreparedUnitIds.length ? <li>Outlined units not yet prepared: {report.unpreparedUnitIds.join(", ")}</li> : null}
                {report.coursesToRefine.length ? (
                  <li>Courses whose units are not chosen yet: {report.coursesToRefine.join(", ")}</li>
                ) : null}
                {report.missingUnitIds.length ? <li>Mapped units missing from the catalogue: {report.missingUnitIds.join(", ")}</li> : null}
                {block.gaps.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            )}
            {leads.length || courseLeads.length ? (
              <div className="mt-2">
                <Notice tone="neutral">
                  Leads appear in{" "}
                  <Link href="/library/requests" className="underline underline-offset-2">
                    Library, Books to obtain
                  </Link>{" "}
                  while you follow this programme. A missing optional source never blocks other work.
                </Notice>
              </div>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  );
}

/** The block's one next step; rendered once per layout, so only one copy is ever displayed. */
function NextStepCard({ next, headingId, className }: { next: NextStep; headingId: string; className: string }) {
  return (
    <Card as="section" className={className}>
      <h2 id={headingId} className="text-lg text-ink">
        Next step
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
        ) : (
          <LinkButton href="/studio" variant="secondary">
            Research studio
          </LinkButton>
        )}
      </div>
    </Card>
  );
}
