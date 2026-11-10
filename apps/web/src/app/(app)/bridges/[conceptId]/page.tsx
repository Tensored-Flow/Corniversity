import { MAX_BRIDGE_DEPTH } from "@corniversity/core/prerequisites/bridges";
import { conceptPrerequisiteView, getBridge, getVisit } from "@corniversity/db/services/bridges";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import { Badge, Button, Card, Notice } from "@/components/ui";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { answerBridgeCheckAction, returnFromBridgeAction } from "./actions";

const REFUSED: Record<string, string> = {
  cycle: "That concept is already open further up this trail. Return to it rather than going round in a circle.",
  depth: `Bridges stop ${MAX_BRIDGE_DEPTH} deep so the lesson stays in reach. If more preparation is needed, ask the director to propose a short study route instead.`,
  unprepared:
    "No bridge is prepared for this concept yet. It is still a prerequisite: ask the tutor about it in your session, or the director for a short study route.",
};

/**
 * A concept bridge: a focused explanation with a worked example and an optional self-check, then
 * back to the exact place in the lesson. Reading it records assistance, never evidence.
 */
export default async function BridgePage({
  params,
  searchParams,
}: {
  params: Promise<{ conceptId: string }>;
  searchParams: Promise<{ visit?: string; refused?: string; back?: string }>;
}) {
  const { conceptId } = await params;
  const { visit: visitId, refused, back } = await searchParams;
  const auth = await requireSession(`/bridges/${conceptId}`);
  const bridge = await getBridge(db(), conceptId);
  const backPath = back && /^\/(sessions|bridges|courses)\//.test(back) ? back : "/campus";

  if (refused || !visitId) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <h1 className="text-2xl text-ink">{bridge?.title ?? conceptId}</h1>
        <div className="mt-4">
          <Notice tone="slate">{REFUSED[refused ?? "unprepared"] ?? REFUSED.unprepared}</Notice>
        </div>
        <Link href={backPath} className="mt-4 inline-block text-sm text-brass underline underline-offset-4">
          Return to where you were
        </Link>
      </div>
    );
  }
  const visit = await getVisit(db(), auth.user.id, visitId);
  if (!visit || visit.conceptId !== conceptId || !bridge) notFound();
  const assumed = await conceptPrerequisiteView(db(), auth.user.id, bridge.assumesConceptIds);
  const atCap = visit.trail.length >= MAX_BRIDGE_DEPTH;

  const ReturnButton = (
    <form action={returnFromBridgeAction}>
      <input type="hidden" name="visitId" value={visit.id} />
      <Button type="submit" variant="secondary">
        ← Return to {visit.returnTo.label}
      </Button>
    </form>
  );

  return (
    <div className="mx-auto w-full max-w-3xl">
      <nav aria-label="Bridge trail" className="mb-3 flex flex-wrap items-center gap-2 text-xs text-ink-3">
        <span>
          Bridge {visit.depth} of at most {MAX_BRIDGE_DEPTH}
        </span>
        <span aria-hidden="true">·</span>
        <span>{visit.trail.join(" → ")}</span>
      </nav>
      <div className="mb-4">{ReturnButton}</div>
      <header>
        <p className="text-sm uppercase tracking-[0.18em] text-brass">Prerequisite bridge</p>
        <h1 className="mt-1 text-3xl text-ink">{bridge.title}</h1>
        <p className="mt-2 text-sm text-ink-2">{bridge.summary}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge>{bridge.origin === "original" ? "original Corniversity teaching" : "adapted with attribution"}</Badge>
          <Badge>version {bridge.version}</Badge>
        </div>
      </header>

      <Card className="mt-5">
        <Markdown source={bridge.bodyMarkdown} />
      </Card>

      {bridge.check ? (
        <Card className="mt-5">
          <h2 className="text-lg text-ink">Check yourself (optional)</h2>
          <div className="mt-2">
            <Markdown source={bridge.check.prompt} />
          </div>
          {visit.checkAnswer ? (
            <>
              <p className="mt-3 text-xs uppercase tracking-wide text-ink-3">Your answer (kept as a note)</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-ink-2">{visit.checkAnswer}</p>
              <p className="mt-3 text-xs uppercase tracking-wide text-brass">Guidance</p>
              <div className="mt-1">
                <Markdown source={bridge.check.guidance} />
              </div>
              <p className="mt-2 text-xs text-ink-3">This check is for you; it is not assessed and records no evidence.</p>
            </>
          ) : (
            <form action={answerBridgeCheckAction} className="mt-3 flex flex-col gap-2">
              <input type="hidden" name="visitId" value={visit.id} />
              <label htmlFor="bridge-answer" className="sr-only">
                Your answer
              </label>
              <textarea
                id="bridge-answer"
                name="answer"
                rows={4}
                required
                minLength={10}
                className="w-full rounded-[var(--radius-control)] border border-stone-2 bg-paper px-3 py-2 text-sm text-ink"
                placeholder="Answer in a few sentences; the guidance appears afterwards."
              />
              <div>
                <Button type="submit" variant="secondary">
                  Save my answer and show the guidance
                </Button>
              </div>
            </form>
          )}
        </Card>
      ) : null}

      {assumed.length ? (
        <Card className="mt-5">
          <h2 className="text-lg text-ink">This bridge assumes</h2>
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {assumed.map((a) => (
              <li key={a.conceptId}>
                <span className="text-ink">{a.title}</span>{" "}
                {atCap ? (
                  <span className="text-xs text-ink-3">(bridges stop here; ask the director for a route if it is a real gap)</span>
                ) : a.bridge === "prepared" && !visit.trail.includes(a.conceptId) ? (
                  <Link
                    className="text-brass underline underline-offset-4"
                    href={`/bridges/open?concept=${a.conceptId}&parent=${visit.id}`}
                  >
                    Explain this first
                  </Link>
                ) : (
                  <span className="text-xs text-ink-3">(no bridge prepared yet)</span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {bridge.sources.length ? (
        <p className="mt-5 text-xs text-ink-3">
          Sources: {bridge.sources.map((s) => s.note).join(" ")} The explanation above is original; the sources support it and are listed in
          the library.
        </p>
      ) : null}
      <details className="mt-3 text-xs text-ink-3">
        <summary className="cursor-pointer">The author's own checks (not independent verification)</summary>
        <ul className="mt-1 list-disc pl-4">
          {bridge.checks.map((c) => (
            <li key={c.name}>
              {c.name}: {c.result}. {c.evidence}
            </li>
          ))}
        </ul>
      </details>
      <div className="mt-6">{ReturnButton}</div>
    </div>
  );
}
