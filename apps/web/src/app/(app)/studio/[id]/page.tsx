import { PROJECT_KIND_INFO, PROVENANCE_KINDS } from "@corniversity/core";
import { listSourceRegistry } from "@corniversity/db/services/library";
import { type DocumentKind, getProjectBundle } from "@corniversity/db/services/research";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Button, Card, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import {
  addProvenanceAction,
  holdOralAction,
  newNotebookEntryAction,
  removeProvenanceAction,
  requestFeedbackAction,
  requestOralAction,
  saveDocumentAction,
  setShelfAction,
  updateProjectAction,
  withdrawOralAction,
} from "../actions";
import { ArtifactForm } from "./ArtifactForm";

export const metadata = { title: "Research project" };

const DOCUMENT_LABEL: Record<DocumentKind, { title: string; hint: string }> = {
  proposal: {
    title: "Proposal",
    hint: "The question, what is known, and how you will find out. Save a version when you want feedback on it.",
  },
  methods: {
    title: "Methods",
    hint: "Exactly what you will do: models, analyses, the evaluation and its split, and what would change your mind.",
  },
  report: {
    title: "Report",
    hint: "Its headings keep apart what was observed, assumed and predicted, the competing explanations, what the evidence establishes and what it does not.",
  },
};

const PROVENANCE_LABEL: Record<(typeof PROVENANCE_KINDS)[number], string> = {
  existing_dataset: "Existing dataset",
  simulation: "Simulation",
  derived: "Derived from another record",
  literature: "Published literature",
};

const CHECK_TONE = { met: "moss", not_met: "rust", advice: "slate" } as const;

/** One research project: every stage from the question to the report, on one page. */
export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { id } = await params;
  const flash = await searchParams;
  const session = await requireSession(`/studio/${id}`);
  const bundle = await getProjectBundle(db(), session.user.id, id);
  if (!bundle) notFound();
  const { project, documents, provenance, artifacts, feedback, oral, shelf, notebook } = bundle;
  const registry = await listSourceRegistry(db());
  const versions = (["proposal", "methods", "report"] as const).flatMap((kind) => documents[kind].versions.map((v) => ({ kind, v })));
  const info = PROJECT_KIND_INFO[project.kind];

  return (
    <div className="mx-auto w-full max-w-5xl">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-ink-3">
        <Link href="/studio" className="hover:text-ink">
          Research studio
        </Link>
        <span className="mx-2">/</span>
        <span>{project.title}</span>
      </nav>
      <header className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{info.label}</Badge>
          <Badge tone={project.status === "completed" ? "moss" : "brass"}>{project.status}</Badge>
          {project.demo ? <Badge tone="rust">demonstration, not your work</Badge> : null}
          {project.programmeId && project.blockIds.length
            ? project.blockIds.map((b) => (
                <Link
                  key={b}
                  href={`/programmes/${project.programmeId}/blocks/${b}`}
                  className="text-xs text-brass underline underline-offset-2"
                >
                  {b}
                </Link>
              ))
            : null}
        </div>
        <h1 className="mt-2 text-3xl text-ink">{project.title}</h1>
        <p className="mt-2 max-w-prose text-base text-ink-2">{project.question}</p>
      </header>
      {flash.error ? (
        <div className="mb-4">
          <Notice tone="rust">{flash.error}</Notice>
        </div>
      ) : null}
      {flash.saved ? (
        <div className="mb-4">
          <Notice tone="moss">Saved.</Notice>
        </div>
      ) : null}

      <div className="flex flex-col gap-6">
        <Card as="section" aria-labelledby="question-heading" id="question">
          <h2 id="question-heading" className="text-lg text-ink">
            The question
          </h2>
          <form action={updateProjectAction} className="mt-3 grid gap-3">
            <input type="hidden" name="projectId" value={project.id} />
            <Field label="Title" htmlFor="p-title">
              <Input id="p-title" name="title" defaultValue={project.title} maxLength={200} />
            </Field>
            <Field label="Question" htmlFor="p-question">
              <Textarea id="p-question" name="question" rows={2} defaultValue={project.question} maxLength={1000} />
            </Field>
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Status" htmlFor="p-status">
                <Select id="p-status" name="status" defaultValue={project.status}>
                  {["formulating", "working", "reporting", "completed", "paused"].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button type="submit" variant="secondary">
                Save
              </Button>
            </div>
          </form>
        </Card>

        <Card as="section" aria-labelledby="shelf-heading" id="shelf">
          <h2 id="shelf-heading" className="text-lg text-ink">
            Focused shelf
          </h2>
          <p className="mt-1 text-sm text-ink-2">
            Verified source records only: each was opened and its edition and locations checked. A {info.label.toLowerCase()} project needs
            at least {info.minSources} verified source{info.minSources === 1 ? "" : "s"}. Anything not yet verified is a lead, not a source.
          </p>
          {shelf.length ? (
            <ul className="mt-2 list-disc pl-5 text-sm">
              {shelf.map((s) => (
                <li key={s.id}>
                  <a href={s.canonicalUrl} className="text-ink underline underline-offset-4" rel="noreferrer">
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
          <form action={setShelfAction} className="mt-3 flex flex-col gap-3">
            <input type="hidden" name="projectId" value={project.id} />
            <fieldset>
              <legend className="text-sm font-medium text-ink">Choose sources</legend>
              <div className="mt-1 flex max-h-56 flex-col gap-1 overflow-y-auto rounded-[var(--radius-control)] border border-stone p-2">
                {registry.map((r) => (
                  <label key={r.source.id} className="flex items-start gap-2 text-xs text-ink-2">
                    <input
                      type="checkbox"
                      name="sourceIds"
                      value={r.source.id}
                      defaultChecked={project.sourceIds.includes(r.source.id)}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="text-ink">{r.source.title}</span> · {r.version.label} · {r.version.licence}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <Field
              label="Leads (one per line)"
              htmlFor="leads"
              hint="Titles you want but that are not verified sources; add them to the library's list of books to obtain."
            >
              <Textarea id="leads" name="sourceLeads" rows={2} defaultValue={project.sourceLeads.join("\n")} />
            </Field>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" variant="secondary">
                Save the shelf
              </Button>
              <Link href="/library/requests" className="text-sm text-brass underline underline-offset-4">
                Books to obtain
              </Link>
            </div>
          </form>
        </Card>

        {(["proposal", "methods"] as const).map((kind) => (
          <DocumentSection key={kind} projectId={project.id} kind={kind} document={documents[kind]} />
        ))}

        <Card as="section" aria-labelledby="provenance-heading" id="provenance">
          <h2 id="provenance-heading" className="text-lg text-ink">
            Data and simulations
          </h2>
          <p className="mt-1 text-sm text-ink-2">
            Where every dataset or simulation came from, recorded before it is used. Data about people can only come from an existing
            dataset whose licence or terms permit the analysis; the studio collects nothing new from anyone.
          </p>
          {provenance.length ? (
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {provenance.map((p) => (
                <li key={p.id} className="rounded-[var(--radius-control)] border border-stone bg-paper p-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-ink">{p.title}</span>
                    <Badge>{PROVENANCE_LABEL[p.kind]}</Badge>
                    {p.humanParticipants === "existing_published" ? <Badge tone="slate">existing data about people</Badge> : null}
                  </div>
                  <p className="mt-1 text-xs text-ink-2">
                    {p.origin}
                    {p.versionOrDate ? ` · ${p.versionOrDate}` : ""}
                    {p.licence ? ` · ${p.licence}` : ""}
                    {p.seed ? ` · seed ${p.seed}` : ""}
                    {p.generator ? ` · ${p.generator}` : ""}
                  </p>
                  <form action={removeProvenanceAction} className="mt-1">
                    <input type="hidden" name="projectId" value={project.id} />
                    <input type="hidden" name="provenanceId" value={p.id} />
                    <Button type="submit" variant="quiet">
                      Remove
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          ) : null}
          <form action={addProvenanceAction} className="mt-3 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="projectId" value={project.id} />
            <Field label="Kind" htmlFor="pv-kind">
              <Select id="pv-kind" name="kind" defaultValue="simulation">
                {PROVENANCE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {PROVENANCE_LABEL[k]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Title" htmlFor="pv-title">
              <Input id="pv-title" name="title" />
            </Field>
            <Field label="Origin" htmlFor="pv-origin" hint="A URL or citation; for a simulation, the laboratory or code that ran it.">
              <Input id="pv-origin" name="origin" />
            </Field>
            <Field label="Version or date retrieved" htmlFor="pv-version">
              <Input id="pv-version" name="versionOrDate" />
            </Field>
            <Field label="Licence or terms" htmlFor="pv-licence">
              <Input id="pv-licence" name="licence" />
            </Field>
            <Field label="Data about people" htmlFor="pv-people">
              <Select id="pv-people" name="humanParticipants" defaultValue="none">
                <option value="none">None</option>
                <option value="existing_published">An existing dataset about people, used as its licence or terms permit</option>
                <option value="new_from_people">Data I collected from people myself (the studio does not take it)</option>
              </Select>
            </Field>
            <Field label="Random seed (simulations)" htmlFor="pv-seed">
              <Input id="pv-seed" name="seed" />
            </Field>
            <Field label="Generated by, with which settings (simulations)" htmlFor="pv-generator">
              <Input id="pv-generator" name="generator" />
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit" variant="secondary">
                Record it
              </Button>
            </div>
          </form>
        </Card>

        <Card as="section" aria-labelledby="notebook-heading" id="notebook">
          <h2 id="notebook-heading" className="text-lg text-ink">
            Notebook
          </h2>
          <p className="mt-1 text-sm text-ink-2">Working notes live in your notebook, tagged with this project.</p>
          {notebook.length ? (
            <ul className="mt-2 list-disc pl-5 text-sm">
              {notebook.map((n) => (
                <li key={n.id}>
                  <Link href={`/notebook/${n.id}`} className="text-ink underline underline-offset-4">
                    {n.title}
                  </Link>{" "}
                  <span className="text-xs text-ink-3">{n.createdAt.toISOString().slice(0, 10)}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <form action={newNotebookEntryAction} className="mt-3 flex flex-wrap items-end gap-3">
            <input type="hidden" name="projectId" value={project.id} />
            <Field label="Title of the note" htmlFor="nb-title">
              <Input id="nb-title" name="title" />
            </Field>
            <Button type="submit" variant="secondary">
              New note for this project
            </Button>
          </form>
        </Card>

        <Card as="section" aria-labelledby="artifacts-heading" id="artifacts">
          <h2 id="artifacts-heading" className="text-lg text-ink">
            Intermediate artefacts
          </h2>
          {artifacts.length ? (
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {artifacts.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2">
                  <Badge>{a.kind}</Badge>
                  {a.blobKey ? (
                    <a href={`/api/studio/artifacts/${a.id}`} className="text-ink underline underline-offset-4">
                      {a.title}
                    </a>
                  ) : a.notebookEntryId ? (
                    <Link href={`/notebook/${a.notebookEntryId}`} className="text-ink underline underline-offset-4">
                      {a.title}
                    </Link>
                  ) : (
                    <span className="text-ink">{a.title}</span>
                  )}
                  {a.sizeBytes ? <span className="text-xs text-ink-3">{Math.ceil(a.sizeBytes / 1024)} KB</span> : null}
                  {a.description ? <span className="basis-full text-xs text-ink-3">{a.description}</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
          <ArtifactForm projectId={project.id} notebook={notebook.map((n) => ({ id: n.id, title: n.title }))} />
        </Card>

        <Card as="section" aria-labelledby="feedback-heading" id="feedback">
          <h2 id="feedback-heading" className="text-lg text-ink">
            Feedback
          </h2>
          <p className="mt-1 text-sm text-ink-2">
            Feedback is attached to a saved version. Automatic checks say whether the parts a proposal of this kind needs are present, not
            whether its reasoning is right. Written feedback comes only from a live model approved in Settings.
          </p>
          {versions.length ? (
            <form action={requestFeedbackAction} className="mt-3 flex flex-wrap items-end gap-3">
              <input type="hidden" name="projectId" value={project.id} />
              <Field label="Version" htmlFor="fb-version">
                <Select id="fb-version" name="versionId" defaultValue={versions.at(-1)!.v.id}>
                  {versions.map(({ kind, v }) => (
                    <option key={v.id} value={v.id}>
                      {DOCUMENT_LABEL[kind].title} version {v.version}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button type="submit" variant="secondary">
                Ask for feedback
              </Button>
            </form>
          ) : (
            <p className="mt-2 text-sm text-ink-3">Save a version of the proposal first.</p>
          )}
          <ul className="mt-4 flex flex-col gap-3">
            {feedback.map((f) => (
              <li key={f.id} className="rounded-[var(--radius-panel)] border border-stone bg-paper p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-ink">
                    {DOCUMENT_LABEL[f.documentKind].title} version {f.version}
                  </span>
                  {f.mode === "scripted" ? (
                    <Badge>Scripted demo: no model read this</Badge>
                  ) : f.mode === "blocked" ? (
                    <Badge tone="rust">live model blocked</Badge>
                  ) : f.status !== "ok" ? (
                    <Badge tone="rust">live model run failed</Badge>
                  ) : (
                    <Badge tone="slate">AI supervisor, provisional</Badge>
                  )}
                  <span className="text-xs text-ink-3">{f.createdAt.toISOString().slice(0, 16).replace("T", " ")}</span>
                </div>
                <ul className="mt-2 flex flex-col gap-1 text-xs">
                  {f.checks.map((c) => (
                    <li key={c.id} className="flex items-start gap-2">
                      <Badge tone={CHECK_TONE[c.status]}>{c.status.replace("_", " ")}</Badge>
                      <span className="text-ink-2">{c.message}</span>
                    </li>
                  ))}
                </ul>
                {f.error ? <p className="mt-2 text-xs text-rust">{f.error}</p> : null}
                {f.feedback ? (
                  <div className="mt-3 flex flex-col gap-1 text-xs text-ink-2">
                    <p>{f.feedback.summary}</p>
                    {f.feedback.strengths.length ? <p>Strengths: {f.feedback.strengths.join(" ")}</p> : null}
                    {f.feedback.questions.length ? (
                      <ul className="list-disc pl-5">
                        {f.feedback.questions.map((q) => (
                          <li key={q}>{q}</li>
                        ))}
                      </ul>
                    ) : null}
                    <p>Next: {f.feedback.nextStep}</p>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>

        <DocumentSection projectId={project.id} kind="report" document={documents.report} />
        <p className="-mt-3 text-sm">
          <a href={`/api/studio/${project.id}/report`} className="text-brass underline underline-offset-4">
            Download the report as Markdown
          </a>{" "}
          <span className="text-xs text-ink-3">
            (the latest saved report version, with the provenance, artefacts, sources and feedback)
          </span>
        </p>

        <Card as="section" aria-labelledby="oral-heading" id="oral">
          <h2 id="oral-heading" className="text-lg text-ink">
            Oral discussion (optional)
          </h2>
          <p className="mt-1 text-sm text-ink-2">
            Ask for a short discussion of the project. It is held as bounded office hours with the director of studies, an AI persona, and
            stays available in quiet mode.
          </p>
          {oral.length ? (
            <ul className="mt-2 flex flex-col gap-2 text-sm">
              {oral.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center gap-2">
                  <Badge tone={o.status === "held" ? "moss" : o.status === "withdrawn" ? "neutral" : "brass"}>{o.status}</Badge>
                  <span className="text-ink-2">{o.focus}</span>
                  {o.status === "requested" ? (
                    <>
                      <form action={holdOralAction}>
                        <input type="hidden" name="projectId" value={project.id} />
                        <input type="hidden" name="requestId" value={o.id} />
                        <Button type="submit" variant="secondary">
                          Hold it now
                        </Button>
                      </form>
                      <form action={withdrawOralAction}>
                        <input type="hidden" name="projectId" value={project.id} />
                        <input type="hidden" name="requestId" value={o.id} />
                        <Button type="submit" variant="quiet">
                          Withdraw
                        </Button>
                      </form>
                    </>
                  ) : o.discussionId ? (
                    <Link href={`/common-room/${o.discussionId}`} className="text-brass underline underline-offset-4">
                      Open the discussion
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          <form action={requestOralAction} className="mt-3 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="projectId" value={project.id} />
            <Field label="What to discuss" htmlFor="oral-focus">
              <Input id="oral-focus" name="focus" />
            </Field>
            <Field label="Preferred times" htmlFor="oral-times">
              <Input id="oral-times" name="preferredTimes" />
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit" variant="secondary">
                Request a discussion
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}

function DocumentSection({
  projectId,
  kind,
  document,
}: {
  projectId: string;
  kind: DocumentKind;
  document: {
    draftMarkdown: string;
    versions: { id: string; version: number; bodyMarkdown: string; note: string | null; createdAt: Date }[];
  };
}) {
  const label = DOCUMENT_LABEL[kind];
  return (
    <Card as="section" aria-labelledby={`${kind}-heading`} id={kind}>
      <h2 id={`${kind}-heading`} className="text-lg text-ink">
        {label.title}
      </h2>
      <p className="mt-1 text-sm text-ink-2">{label.hint}</p>
      <form action={saveDocumentAction} className="mt-3 flex flex-col gap-2">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="kind" value={kind} />
        <label htmlFor={`${kind}-text`} className="sr-only">
          {label.title}
        </label>
        <Textarea id={`${kind}-text`} name="markdown" rows={12} defaultValue={document.draftMarkdown} className="font-mono text-xs" />
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Note for the version (optional)" htmlFor={`${kind}-note`}>
            <Input id={`${kind}-note`} name="note" maxLength={500} />
          </Field>
          <Button type="submit" name="intent" value="draft" variant="secondary">
            Save draft
          </Button>
          <Button type="submit" name="intent" value="version">
            Save as version {document.versions.length + 1}
          </Button>
        </div>
      </form>
      {document.versions.length ? (
        <div className="mt-3">
          <p className="text-sm font-medium text-ink">Saved versions</p>
          <ul className="mt-1 flex flex-col gap-1">
            {[...document.versions].reverse().map((v) => (
              <li key={v.id}>
                <details className="text-xs">
                  <summary className="cursor-pointer text-ink-2">
                    Version {v.version} · {v.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                    {v.note ? ` · ${v.note}` : ""}
                  </summary>
                  <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded-[var(--radius-control)] border border-stone bg-paper p-2 text-ink-2">
                    {v.bodyMarkdown}
                  </pre>
                </details>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
