import { microsToUsd } from "@corniversity/ai";
import { PREPARATION_STAGES } from "@corniversity/core/preparation/pipeline";
import { preparationView } from "@corniversity/db/services/preparation";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import { Badge, Button, Card, Notice } from "@/components/ui";
import { db } from "@/lib/db";
import { errorNotice } from "@/lib/notices";
import { requireSession } from "@/lib/session";
import { AutoRefresh } from "../../sessions/[id]/AutoRefresh";
import {
  cancelPreparationAction,
  confirmPreparationAction,
  publishDraftAction,
  rejectDraftAction,
  resumePreparationAction,
} from "../actions";

const STATUS_TONE: Record<string, "neutral" | "brass" | "rust" | "moss" | "slate"> = {
  pending: "neutral",
  running: "brass",
  done: "moss",
  blocked: "rust",
  failed: "rust",
  cancelled: "neutral",
  skipped: "neutral",
};

/** A short, readable summary of a stage's artifact (the full artifact is kept in the record). */
function artifactSummary(key: string, artifact: Record<string, unknown> | null): string | null {
  if (!artifact) return null;
  switch (key) {
    case "source_inspection": {
      const sources = (artifact.sources as { title: string; licence: string; importAllowed: boolean; verifiedLocators: number }[]) ?? [];
      return sources.length
        ? sources
            .map(
              (s) =>
                `${s.title} (${s.licence}; ${s.importAllowed ? "may be imported" : "reference only"}; ${s.verifiedLocators} verified locators)`,
            )
            .join(" · ")
        : "No registered source.";
    }
    case "primary_shelf":
      return artifact.spine ? `Spine: ${artifact.spine}; supplements: ${(artifact.supplements as string[]).join(", ") || "none"}.` : null;
    case "concept_mapping":
      return `Teaches ${(artifact.teaches as string[]).length} concepts; ${(artifact.rules as unknown[]).length} prerequisite rules; bridges prepared: ${(artifact.bridgesPrepared as string[]).length}, not yet: ${(artifact.bridgesMissing as string[]).length}.`;
    case "syllabus_workload": {
      const units = (artifact.units as { status: string }[]) ?? [];
      return `${units.length} units (${units.filter((u) => u.status === "ready").length} prepared); about ${(artifact.workload as { typical: number }).typical} hours in all at ${artifact.weeklyHours} a week.`;
    }
    case "resource_requirements":
      return `${(artifact.referenceOnly as string[]).length} reference-only sources; ${(artifact.requestsCreated as string[]).length} new requests in Library → Books to obtain.`;
    case "unit_authoring":
      return artifact.draftId ? `Draft v${artifact.version} written by ${artifact.model}.` : null;
    case "checks":
      return artifact.draftId
        ? `${artifact.passed} checks passed${(artifact.failed as string[]).length ? `; failed: ${(artifact.failed as string[]).join(", ")}` : ""}.`
        : null;
    default:
      return null;
  }
}

/**
 * One preparation request: what was asked, each stage with its role, status and artifact, what it
 * has spent against its budget, and the drafts the owner may publish or reject.
 */
export default async function PreparationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const auth = await requireSession(`/preparations/${id}`);
  const view = await preparationView(db(), auth.user.id, id);
  if (!view) notFound();
  const { request, stages, drafts, units, summary, spentMicros } = view;
  const titleOf = new Map(units.map((u) => [u.id, `Unit ${u.sequence}: ${u.title}`]));
  const stageInfo = new Map(PREPARATION_STAGES.map((s) => [s.key, s]));
  const active = request.status === "running";
  return (
    <div className="mx-auto w-full max-w-4xl">
      <AutoRefresh active={active} intervalMs={3000} />
      <p className="text-sm uppercase tracking-[0.18em] text-brass">Course preparation</p>
      <h1 className="mt-1 text-3xl text-ink">
        <Link href={`/courses/${request.courseId}`} className="hover:underline">
          {request.courseId}
        </Link>
      </h1>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge
          tone={request.status === "blocked" || request.status === "failed" ? "rust" : request.status === "completed" ? "moss" : "brass"}
        >
          {request.status.replace(/_/g, " ")}
        </Badge>
        <span className="text-sm text-ink-2" data-testid="prep-summary">
          {summary}
        </span>
      </div>
      {request.statusNote ? <p className="mt-2 max-w-prose text-sm text-ink-2">{request.statusNote}</p> : null}
      {error ? (
        <div className="mt-3">
          <Notice tone="rust">{errorNotice(error)}</Notice>
        </div>
      ) : null}

      <Card className="mt-5">
        <h2 className="text-lg text-ink">What you asked for</h2>
        <p className="mt-1 text-sm text-ink-2">“{request.intake.goal}”</p>
        <p className="mt-1 text-xs text-ink-3">
          {request.intake.depth} · {request.intake.weeklyHours} hours a week · {request.intake.balance.replace(/_/g, " ")} · assessment:{" "}
          {request.intake.assessment.replace(/_/g, " ")} · {request.intake.bufferUnits} unit{request.intake.bufferUnits === 1 ? "" : "s"} to
          prepare
        </p>
        <p className="mt-2 text-sm text-ink" data-testid="prep-budget">
          Budget ${Number(request.budgetUsd).toFixed(2)} · spent or held ${microsToUsd(spentMicros).toFixed(4)}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {request.status === "draft" ? (
            <form action={confirmPreparationAction}>
              <input type="hidden" name="id" value={request.id} />
              <Button type="submit">Confirm and prepare within ${Number(request.budgetUsd).toFixed(2)}</Button>
            </form>
          ) : null}
          {["running", "blocked", "awaiting_review", "draft"].includes(request.status) ? (
            <form action={cancelPreparationAction}>
              <input type="hidden" name="id" value={request.id} />
              <Button type="submit" variant="secondary">
                Cancel
              </Button>
            </form>
          ) : null}
          {["cancelled", "blocked", "failed"].includes(request.status) ? (
            <form action={resumePreparationAction}>
              <input type="hidden" name="id" value={request.id} />
              <Button type="submit" variant="secondary">
                Resume (finished stages are kept)
              </Button>
            </form>
          ) : null}
        </div>
        {request.status === "draft" ? (
          <p className="mt-2 text-xs text-ink-3">
            This is a proposal. Nothing has run, nothing has been spent, and confirming enrols you in nothing.
          </p>
        ) : null}
      </Card>

      <Card className="mt-5">
        <h2 className="text-lg text-ink">Stages</h2>
        <p className="mt-1 text-xs text-ink-3">
          Each stage is done by a role over the same records (the librarian, the convenor, an automatic reviewer) and leaves its result
          here. Publication is yours.
        </p>
        <ol className="mt-3 flex flex-col gap-2">
          {stages.map((s) => {
            const info = stageInfo.get(s.stageKey as (typeof PREPARATION_STAGES)[number]["key"]);
            const detail = artifactSummary(s.stageKey, s.artifact);
            return (
              <li key={s.id} className="rounded-[var(--radius-control)] border border-stone bg-paper px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={STATUS_TONE[s.status]}>{s.status}</Badge>
                  <span className="text-ink">
                    {info?.title ?? s.stageKey}
                    {s.unitKey ? ` · ${titleOf.get(s.unitKey) ?? s.unitKey}` : ""}
                  </span>
                  <span className="text-xs text-ink-3">{s.role === "owner" ? "you" : s.role}</span>
                </div>
                {detail ? <p className="mt-1 text-xs text-ink-2">{detail}</p> : null}
                {s.error ? <p className="mt-1 text-xs text-rust">{s.error}</p> : null}
              </li>
            );
          })}
        </ol>
      </Card>

      {drafts.length ? (
        <Card className="mt-5">
          <h2 className="text-lg text-ink">Drafts</h2>
          <p className="mt-1 text-xs text-ink-3">
            Written by the AI convenor and checked automatically for structure, verified sources, notation, rubric weights and leaked
            answers; those checks say nothing about whether the mathematics is right, which is for you to judge. Reference solutions stay
            hidden here so that reading a draft does not give away its answers; after publication they are available in practice mode like
            any other.
          </p>
          <ul className="mt-3 flex flex-col gap-4">
            {drafts.map((d) => (
              <li key={d.id} className="rounded-[var(--radius-panel)] border border-stone bg-paper p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-ink">{titleOf.get(d.unitId) ?? d.unitId}</span>
                  <Badge>draft v{d.version}</Badge>
                  <Badge tone={d.status === "checked" ? "moss" : d.status === "published" ? "brass" : "rust"}>
                    {d.status.replace(/_/g, " ")}
                  </Badge>
                </div>
                <ul className="mt-2 text-xs text-ink-2">
                  {d.checks.map((c) => (
                    <li key={c.name}>
                      {c.result === "pass" ? "✓" : "✗"} {c.name}: {c.detail}
                    </li>
                  ))}
                </ul>
                <details className="mt-2 text-sm">
                  <summary className="cursor-pointer text-ink-2">Read the draft lesson and exercises</summary>
                  <div className="mt-2">
                    <Markdown source={d.draft.lessonMarkdown} />
                  </div>
                  <ol className="mt-3 list-decimal pl-5">
                    {d.draft.exercises.map((e) => (
                      <li key={e.title} className="mt-2">
                        <p className="font-medium text-ink">
                          {e.title} <span className="text-xs text-ink-3">({e.stage.replace(/_/g, " ")})</span>
                        </p>
                        <Markdown source={e.promptMarkdown} />
                      </li>
                    ))}
                  </ol>
                </details>
                {d.status === "checked" ? (
                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <form action={publishDraftAction}>
                      <input type="hidden" name="id" value={request.id} />
                      <input type="hidden" name="draftId" value={d.id} />
                      <Button type="submit">Publish this unit</Button>
                    </form>
                    <form action={rejectDraftAction} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="id" value={request.id} />
                      <input type="hidden" name="draftId" value={d.id} />
                      <input
                        name="note"
                        placeholder="Why (optional)"
                        className="rounded-[var(--radius-control)] border border-stone-2 bg-paper-2 px-2 py-1 text-sm"
                      />
                      <Button type="submit" variant="secondary">
                        Reject
                      </Button>
                    </form>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
