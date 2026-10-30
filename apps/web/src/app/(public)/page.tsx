import { redirect } from "next/navigation";
import { Crest } from "@/components/Crest";
import { LinkButton } from "@/components/ui";
import { db } from "@/lib/db";
import { getOptionalSession } from "@/lib/session";
import { isBootstrapComplete } from "@corniversity/db/services/bootstrap";

export default async function ArrivalPage() {
  const session = await getOptionalSession();
  if (session) redirect("/campus");
  const bootstrapped = await isBootstrapComplete(db());

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-8 sm:py-24">
      <div className="grid gap-12 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-brass">A personal university</p>
          <h1 className="mt-3 text-4xl text-ink sm:text-5xl">Corniversity</h1>
          <p className="prose-reading mt-6 text-ink-2">
            One learner, six departments, and the time to read properly. Choose what you want to
            study; a director of studies helps shape it into a coherent programme; then attend
            lectures, tutorials and laboratories built on real university materials, attempt serious
            work, and keep a durable record of what you have understood.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {bootstrapped ? (
              <LinkButton href="/sign-in">Sign in</LinkButton>
            ) : (
              <LinkButton href="/join">Create your course of study</LinkButton>
            )}
            <LinkButton href="/tour" variant="secondary">
              Take a short tour
            </LinkButton>
          </div>
          <p className="mt-6 max-w-prose text-xs text-ink-3">
            Independent and non-accredited. Teaching staff and classmates are clearly labelled AI
            personas. Courses adapt openly licensed materials from universities and authors, with
            exact sources shown; nothing here is an official delivery of another institution's
            course.
          </p>
        </div>
        <div className="hidden justify-center md:flex">
          <Crest size={220} className="text-brass" />
        </div>
      </div>

      <section aria-labelledby="departments-heading" className="mt-20">
        <h2 id="departments-heading" className="text-2xl text-ink">
          Six departments
        </h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Mathematics", "Analysis, probability, geometry, topology, algebra."],
            ["Physics", "Mechanics, electromagnetism, quantum theory, relativity."],
            ["Chemistry", "From chemical principles to mechanisms and spectroscopy."],
            ["Computer Science & AI", "Learning systems, from foundations to language models."],
            ["Neuroscience", "Cells, circuits and computational models of the brain."],
            ["Cognitive Science & Psychology", "Computational models of mind and the methods behind them."],
          ].map(([title, body]) => (
            <li key={title} className="rounded-[var(--radius-panel)] border border-stone bg-paper-2 p-5">
              <h3 className="text-lg text-ink">{title}</h3>
              <p className="mt-1 text-sm text-ink-2">{body}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
