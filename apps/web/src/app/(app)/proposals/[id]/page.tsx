import { findOverlap, getProposal, listProposalVersions, PROPOSAL_KINDS } from "@corniversity/db/services/extension";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Button, Card, Notice, Select, Textarea } from "@/components/ui";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { decideOverlapAction, publishProposalAction, rejectProposalAction, reviseProposalAction } from "../actions";

const link = "text-brass underline underline-offset-4";

/**
 * One proposal: what already exists on the same ground (searched from its title and scope), the
 * owner's decision on each overlapping course, the prepared units and concepts it reuses, its
 * versions, and publication or rejection.
 */
export default async function ProposalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const session = await requireSession(`/proposals/${id}`);
  const proposal = await getProposal(db(), session.user.id, id);
  if (!proposal) notFound();
  const [overlap, versions] = await Promise.all([
    findOverlap(db(), `${proposal.title} ${proposal.scope}`, proposal.publishedCourseId ?? undefined),
    listProposalVersions(db(), proposal.id),
  ]);
  const draft = proposal.status === "draft";
  const decisionFor = new Map(proposal.overlapDecisions.map((d) => [d.courseId, d]));
  const undecided = overlap.courses.filter((c) => !decisionFor.has(c.id));
  const readyUnits = overlap.units.filter((u) => u.status === "ready");

  return (
    <div className="mx-auto w-full max-w-4xl">
      <nav aria-label="Breadcrumb" className="mb-3 text-sm text-ink-3">
        <Link href="/proposals" className="hover:text-ink">
          Proposals
        </Link>
      </nav>
      <h1 className="text-3xl text-ink">{proposal.title}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge tone={proposal.status === "published" ? "moss" : proposal.status === "rejected" ? "rust" : "neutral"}>
          {proposal.status}
        </Badge>
        <Badge>{PROPOSAL_KINDS.find((k) => k.kind === proposal.kind)?.label ?? proposal.kind}</Badge>
        <span className="text-xs text-ink-3">
          {proposal.departmentId} · {proposal.depth} · version {proposal.version}
        </span>
      </div>
      <p className="mt-3 max-w-prose text-ink-2">{proposal.purpose}</p>
      {error ? (
        <div className="mt-4">
          <Notice tone="rust">{error}</Notice>
        </div>
      ) : null}
      {proposal.status === "published" && proposal.publishedCourseId ? (
        <div className="mt-4">
          <Notice tone="neutral" title="Listed in the catalogue as a proposal">
            <Link href={`/courses/${proposal.publishedCourseId}`} className={link}>
              {proposal.publishedCourseId}
            </Link>{" "}
            is in the catalogue at readiness “proposed”. You are not enrolled; no source was verified (the leads are requests in{" "}
            <Link href="/library/requests" className={link}>
              Books to obtain
            </Link>
            ); no teaching was prepared.
          </Notice>
        </div>
      ) : null}
      {proposal.status === "rejected" ? (
        <p className="mt-3 text-sm text-ink-2">Rejected{proposal.decisionNote ? `: ${proposal.decisionNote}` : "."}</p>
      ) : null}

      <Card as="section" aria-labelledby="overlap-heading" className="mt-6">
        <h2 id="overlap-heading" className="text-lg text-ink">
          What already exists
        </h2>
        <p className="mt-1 text-xs text-ink-3">
          Searched from the title and scope for: {overlap.terms.join(", ") || "no distinctive words"}.
        </p>
        {overlap.courses.length === 0 ? (
          <p className="mt-2 text-sm text-ink-2">No course shares its distinctive words.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {overlap.courses.map((c) => {
              const decision = decisionFor.get(c.id);
              return (
                <li
                  key={c.id}
                  className="rounded-[var(--radius-control)] border border-stone bg-paper px-3 py-2 text-sm"
                  data-testid="overlap-course"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/courses/${c.id}`} className={link}>
                      {c.id} {c.title}
                    </Link>
                    <span className="text-xs text-ink-3">{c.readiness.replace(/_/g, " ")}</span>
                    {decision ? (
                      <Badge tone="moss">{decision.decision === "reuse" ? "reuse its units" : `distinct: ${decision.note}`}</Badge>
                    ) : (
                      <Badge tone="rust">needs a decision</Badge>
                    )}
                  </div>
                  {draft ? (
                    <form action={decideOverlapAction} className="mt-2 flex flex-wrap items-end gap-2">
                      <input type="hidden" name="id" value={proposal.id} />
                      <input type="hidden" name="courseId" value={c.id} />
                      <label className="text-xs text-ink-2" htmlFor={`decision-${c.id}`}>
                        Decision
                      </label>
                      <Select id={`decision-${c.id}`} name="decision" defaultValue={decision?.decision ?? "distinct"}>
                        <option value="reuse">Reuse its units</option>
                        <option value="distinct">Keep the proposal distinct</option>
                      </Select>
                      <input
                        name="note"
                        aria-label={`Why, for ${c.id}`}
                        placeholder="Why (required when distinct)"
                        defaultValue={decision?.note ?? ""}
                        className="min-w-48 flex-1 rounded-[var(--radius-control)] border border-stone-2 bg-paper-2 px-2 py-1 text-sm"
                      />
                      <Button type="submit" variant="secondary">
                        Record decision
                      </Button>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {draft ? (
        <Card as="section" aria-labelledby="revise-heading" className="mt-6">
          <h2 id="revise-heading" className="text-lg text-ink">
            Revise
          </h2>
          <form action={reviseProposalAction} className="mt-3 flex flex-col gap-4">
            <input type="hidden" name="id" value={proposal.id} />
            <label className="text-sm text-ink" htmlFor="scope">
              Scope
            </label>
            <Textarea id="scope" name="scope" rows={3} defaultValue={proposal.scope} />
            <label className="text-sm text-ink" htmlFor="revise-depth">
              Depth
            </label>
            <Select id="revise-depth" name="depth" defaultValue={proposal.depth}>
              <option value="survey">A survey</option>
              <option value="standard">Standard</option>
              <option value="rigorous">Rigorous</option>
            </Select>
            {readyUnits.length ? (
              <fieldset>
                <legend className="text-sm text-ink">Prepared units to reuse (studied where they are)</legend>
                <div className="mt-1 flex flex-col gap-1 text-sm text-ink-2">
                  {readyUnits.map((u) => (
                    <label key={u.id} className="flex items-center gap-2">
                      <input type="checkbox" name="reusedUnitIds" value={u.id} defaultChecked={proposal.reusedUnitIds.includes(u.id)} />{" "}
                      {u.id} {u.title}
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}
            {overlap.concepts.length ? (
              <fieldset>
                <legend className="text-sm text-ink">Existing concepts it teaches or uses</legend>
                <div className="mt-1 flex flex-wrap gap-3 text-sm text-ink-2">
                  {overlap.concepts.map((c) => (
                    <label key={c.id} className="flex items-center gap-2">
                      <input type="checkbox" name="conceptIds" value={c.id} defaultChecked={proposal.conceptIds.includes(c.id)} /> {c.title}
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}
            <label className="text-sm text-ink" htmlFor="sources">
              Source leads, one per line as “Title | note”
            </label>
            <Textarea
              id="sources"
              name="sources"
              rows={3}
              defaultValue={proposal.sourceCandidates.map((s) => (s.note ? `${s.title} | ${s.note}` : s.title)).join("\n")}
            />
            <div>
              <Button type="submit" variant="secondary">
                Save a new version
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {draft ? (
        <Card as="section" aria-labelledby="publish-heading" className="mt-6">
          <h2 id="publish-heading" className="text-lg text-ink">
            Publish or reject
          </h2>
          <p className="mt-1 text-sm text-ink-2">
            Publishing lists it in the catalogue at readiness “proposed”, turns each source lead into a request in Books to obtain, and
            changes nothing else: no enrolment, no verified source, no prepared unit.
            {undecided.length ? ` Decide on ${undecided.map((c) => c.id).join(", ")} first.` : ""}
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <form action={publishProposalAction}>
              <input type="hidden" name="id" value={proposal.id} />
              <Button type="submit" disabled={undecided.length > 0}>
                Publish to the catalogue
              </Button>
            </form>
            <form action={rejectProposalAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="id" value={proposal.id} />
              <input
                name="note"
                aria-label="Reason for rejecting"
                placeholder="Why (optional)"
                className="rounded-[var(--radius-control)] border border-stone-2 bg-paper-2 px-2 py-1 text-sm"
              />
              <Button type="submit" variant="secondary">
                Reject
              </Button>
            </form>
          </div>
        </Card>
      ) : null}

      <p className="mt-6 text-xs text-ink-3">
        Versions kept: {versions.map((v) => `v${v.version} (${v.createdAt.toISOString().slice(0, 10)})`).join(", ")}.
      </p>
    </div>
  );
}
