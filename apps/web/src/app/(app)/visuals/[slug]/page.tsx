import { totalDuration } from "@corniversity/core/visuals/visual";
import { getVisualForLearner, visualSources } from "@corniversity/db/services/visuals";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LocatorLink } from "@/components/LocatorLink";
import { Markdown } from "@/components/Markdown";
import { Badge, Card, Notice } from "@/components/ui";
import { PlotSvg } from "@/components/visuals/PlotSvg";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { VisualPlayer } from "./VisualPlayer";

const ORIGIN: Record<string, string> = {
  original: "Original teaching",
  external: "Authorised external material",
  ai_assisted_draft: "AI-assisted draft",
};

/** What the status means, from the record: a published visual names its reviewer. */
function statusText(status: string, review: { by: string; on: string } | undefined): string {
  if (status === "published" && review) return `Its numerical checks pass, and ${review.by} reviewed it on ${review.on}.`;
  return "Its numerical checks pass. No second reader has reviewed it yet.";
}

/**
 * A visual explanation: the storyboard scene by scene (equations typeset, plots drawn from the
 * same values its checks use), a film recorded from this exact storyboard when one exists, the
 * checks and sources, and a full transcript. An answer-revealing visual stays closed until the
 * learner has attempted the exercise or chosen to see its reasoning.
 */
export default async function VisualPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const auth = await requireSession(`/visuals/${slug}`);
  const found = await getVisualForLearner(db(), auth.user.id, slug);
  if (!found) notFound();
  const { row, spec, gate } = found;
  const unitId = spec.unitIds[0]!;
  const courseId = unitId.replace(/-u\d+$/, "");
  const unitHref = `/courses/${courseId}/units/${unitId}`;
  const sources = await visualSources(db(), spec.sourceLocatorIds);

  return (
    <div className="mx-auto w-full max-w-4xl">
      <nav aria-label="Breadcrumb" className="mb-3 text-sm text-ink-3">
        <Link href={unitHref} className="hover:text-ink">
          Back to the unit
        </Link>
      </nav>
      <p className="text-sm uppercase tracking-[0.18em] text-brass">Visual explanation</p>
      <h1 className="mt-1 text-3xl text-ink">{spec.title}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge tone={row.status === "published" ? "moss" : "slate"}>{row.status}</Badge>
        <Badge>{ORIGIN[row.origin] ?? row.origin}</Badge>
        <span className="text-xs text-ink-3">
          storyboard v{spec.version} · {Math.round(totalDuration(spec))} s · {statusText(row.status, spec.review)}
        </span>
      </div>
      <p className="mt-3 max-w-prose text-ink-2">{spec.objective}</p>

      {!gate.open ? (
        <div className="mt-6">
          <Notice tone="neutral" title="Closed until you have tried the exercise">
            This explanation shows the answer to {gate.waitingFor.map((w) => w.title).join(" or ")}. It opens once you have submitted an
            attempt at it or chosen to see its reference reasoning, so watching it first does not take the problem away from you.{" "}
            <Link href={unitHref} className="text-brass underline underline-offset-4">
              Go to the unit
            </Link>
          </Notice>
        </div>
      ) : (
        <>
          <div className="mt-6">
            <VisualPlayer
              title={spec.title}
              scenes={spec.scenes.map((s) => ({
                id: s.id,
                title: s.title,
                caption: s.caption,
                durationSeconds: s.durationSeconds,
                body: (
                  <div className="flex flex-col gap-3">
                    {s.equations.length ? <Markdown source={s.equations.map((e) => `$$${e}$$`).join("\n\n")} /> : null}
                    {s.plot ? <PlotSvg plot={s.plot} description={s.plotDescription ?? ""} idPrefix={`plot-${s.id}`} /> : null}
                  </div>
                ),
              }))}
            />
          </div>

          <Card as="section" aria-labelledby="film-heading" className="mt-6">
            <h2 id="film-heading" className="text-lg text-ink">
              Film
            </h2>
            {row.filmBlobKey ? (
              <>
                <p className="mt-1 text-sm text-ink-2">
                  A recording of the same storyboard
                  {row.filmRenderedAt ? `, made on ${row.filmRenderedAt.toISOString().slice(0, 10)}` : ""}
                  {row.filmTool ? ` with ${row.filmTool}` : ""}. It has no sound; the captions carry the words.
                </p>
                <video
                  controls
                  preload="metadata"
                  className="mt-3 w-full rounded-[var(--radius-control)] border border-stone"
                  data-testid="film"
                >
                  <source src={`/api/visuals/${slug}/film`} type="video/webm" />
                  <track kind="captions" srcLang="en" label="English" src={`/api/visuals/${slug}/captions`} default />
                </video>
              </>
            ) : (
              <p className="mt-1 text-sm text-ink-2">
                {row.filmStale
                  ? "A film exists but was recorded from an earlier version of this storyboard, so it is not shown; the scenes above are current."
                  : "No film has been recorded for this storyboard; the scenes above are the explanation."}
              </p>
            )}
          </Card>

          <Card as="section" aria-labelledby="checks-heading" className="mt-6">
            <h2 id="checks-heading" className="text-lg text-ink">
              Numerical checks
            </h2>
            <p className="mt-1 text-xs text-ink-3">Run on the plotted values themselves when the content was seeded.</p>
            <ul className="mt-2 flex flex-col gap-1 text-sm text-ink-2">
              {row.checkResults.map((c) => (
                <li key={c.id}>
                  <span className={c.passed ? "text-moss" : "text-rust"}>{c.passed ? "✓" : "✗"}</span> {c.detail}
                </li>
              ))}
            </ul>
            {sources.length ? (
              <>
                <h3 className="mt-4 text-sm font-medium text-ink">Sources</h3>
                <ul className="mt-1 flex flex-col gap-1 text-sm">
                  {sources.map((s) => (
                    <li key={s.id}>
                      <LocatorLink label={s.label} locator={s.payload} />
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </Card>

          <details className="mt-6 rounded-[var(--radius-panel)] border border-stone bg-paper-2 px-4 py-3 text-sm">
            <summary className="cursor-pointer text-ink">Transcript</summary>
            <ol className="mt-2 flex flex-col gap-3">
              {spec.scenes.map((s, i) => (
                <li key={s.id}>
                  <p className="font-medium text-ink">
                    {i + 1}. {s.title}
                  </p>
                  <p className="text-ink-2">{s.caption}</p>
                  {s.plotDescription ? <p className="text-ink-2">Plot: {s.plotDescription}</p> : null}
                  {s.equations.length ? <p className="font-mono text-xs text-ink-3">{s.equations.join("   ")}</p> : null}
                </li>
              ))}
            </ol>
          </details>
        </>
      )}
    </div>
  );
}
