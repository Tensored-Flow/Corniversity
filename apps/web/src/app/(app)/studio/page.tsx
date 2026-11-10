import { PROJECT_KIND_INFO, PROJECT_KINDS } from "@corniversity/core";
import { listProgrammes } from "@corniversity/db/services/programmes";
import { listProjects } from "@corniversity/db/services/research";
import Link from "next/link";
import { Badge, Button, Card, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { db } from "@/lib/db";
import { errorNotice } from "@/lib/notices";
import { requireSession } from "@/lib/session";
import { createProjectAction } from "./actions";

export const metadata = { title: "Research studio" };

const STATUS_TONE = { formulating: "neutral", working: "brass", reporting: "slate", completed: "moss", paused: "neutral" } as const;

/**
 * The research studio's front room: the learner's projects and a way to start one from a
 * question. What the studio does not do is said before anything is started.
 */
export default async function StudioPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await requireSession("/studio");
  const { error } = await searchParams;
  const [projects, programmes] = await Promise.all([listProjects(db(), session.user.id), listProgrammes(db())]);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-6">
        <p className="text-sm uppercase tracking-[0.18em] text-brass">Research studio</p>
        <h1 className="mt-1 text-3xl text-ink">Your own questions</h1>
        <p className="mt-2 max-w-prose text-sm text-ink-2">
          Take a question from formulation to a report: a focused shelf of verified sources, a proposal and its methods, where every dataset
          or simulation came from, notes and intermediate results, feedback, revisions, and an optional oral discussion.
        </p>
      </header>
      <Notice tone="neutral" title="What the studio does not do">
        It does not recruit anyone, collect new data from people, contact researchers, publish anything or import private data. Projects
        work from simulations, published or open materials, existing datasets used as their licence or terms permit (data about people
        included) and your own reasoning. Feedback comes from automatic structural checks, and from a live model only when one is configured
        and approved in Settings.
      </Notice>
      {error ? (
        <div className="mt-4">
          <Notice tone="rust">{errorNotice(error)}</Notice>
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[3fr_2fr]">
        <section aria-labelledby="projects-heading">
          <h2 id="projects-heading" className="text-xl text-ink">
            Projects
          </h2>
          {projects.length === 0 ? (
            <p className="mt-2 text-sm text-ink-2">None yet. Start one from a question you want answered.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {projects.map((p) => (
                <Card key={p.id} as="li">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/studio/${p.id}`} className="text-base text-ink hover:underline">
                      {p.title}
                    </Link>
                    <Badge>{PROJECT_KIND_INFO[p.kind].label}</Badge>
                    <Badge tone={STATUS_TONE[p.status]}>{p.status}</Badge>
                    {p.demo ? <Badge tone="rust">demonstration, not your work</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm text-ink-2">{p.question}</p>
                  <p className="mt-1 text-xs text-ink-3">Updated {p.updatedAt.toISOString().slice(0, 10)}</p>
                </Card>
              ))}
            </ul>
          )}
        </section>

        <Card as="section" aria-labelledby="start-heading">
          <h2 id="start-heading" className="text-lg text-ink">
            Start a project
          </h2>
          <form action={createProjectAction} className="mt-3 flex flex-col gap-3">
            <Field label="Title" htmlFor="title">
              <Input id="title" name="title" required minLength={3} maxLength={200} />
            </Field>
            <Field label="Question" htmlFor="question" hint="As a question you could answer; it can be refined later.">
              <Textarea id="question" name="question" rows={3} required minLength={10} maxLength={1000} />
            </Field>
            <Field label="Kind of project" htmlFor="kind">
              <Select id="kind" name="kind" defaultValue="computational">
                {PROJECT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {PROJECT_KIND_INFO[k].label}
                  </option>
                ))}
              </Select>
            </Field>
            <ul className="flex flex-col gap-1 text-xs text-ink-3">
              {PROJECT_KINDS.map((k) => (
                <li key={k}>
                  <span className="text-ink-2">{PROJECT_KIND_INFO[k].label}:</span> {PROJECT_KIND_INFO[k].description}
                </li>
              ))}
            </ul>
            <Field label="Programme (optional)" htmlFor="programmeId">
              <Select id="programmeId" name="programmeId" defaultValue="">
                <option value="">None</option>
                {programmes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </Select>
            </Field>
            {programmes.some((p) => p.blocks.length) ? (
              <details className="text-sm">
                <summary className="cursor-pointer text-ink-2">Blocks it serves (optional)</summary>
                <div className="mt-2 flex max-h-48 flex-col gap-1 overflow-y-auto">
                  {programmes.flatMap((p) =>
                    p.blocks.map((b) => (
                      <label key={`${p.id}-${b.id}`} className="flex items-start gap-2 text-xs text-ink-2">
                        <input type="checkbox" name="blockIds" value={b.id} className="mt-0.5" /> {b.id} {b.title}
                      </label>
                    )),
                  )}
                </div>
              </details>
            ) : null}
            <Button type="submit">Start the project</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
