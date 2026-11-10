import { listDepartments } from "@corniversity/db/services/catalogue";
import { listProposals, PROPOSAL_KINDS } from "@corniversity/db/services/extension";
import Link from "next/link";
import { Badge, Button, Card, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { createProposalAction } from "./actions";

/**
 * Proposing a subject or reading programme inside an existing department. A proposal is a draft
 * until the owner publishes it; publishing lists a catalogue item at readiness "proposed" and
 * enrols, verifies and prepares nothing.
 */
export default async function ProposalsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const session = await requireSession("/proposals");
  const [departments, proposals] = await Promise.all([listDepartments(db()), listProposals(db(), session.user.id)]);
  return (
    <div className="mx-auto w-full max-w-3xl">
      <p className="text-sm uppercase tracking-[0.18em] text-brass">Catalogue</p>
      <h1 className="mt-1 text-3xl text-ink">Propose a subject or reading programme</h1>
      <p className="mt-2 max-w-prose text-sm text-ink-2">
        A proposal lives inside one of the existing departments. Before anything is published you will see the courses, prepared units and
        concepts that already cover the same ground, and decide for each overlapping course whether to reuse it or why yours is distinct.
        Publishing lists the item in the catalogue as a proposal: it enrols you in nothing, verifies no source and prepares no teaching.
      </p>
      {error ? (
        <div className="mt-4">
          <Notice tone="rust">{error}</Notice>
        </div>
      ) : null}
      {proposals.length ? (
        <Card className="mt-5">
          <h2 className="text-lg text-ink">Your proposals</h2>
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {proposals.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2">
                <Link href={`/proposals/${p.id}`} className="text-brass underline underline-offset-4">
                  {p.title}
                </Link>
                <Badge tone={p.status === "published" ? "moss" : p.status === "rejected" ? "rust" : "neutral"}>{p.status}</Badge>
                <span className="text-xs text-ink-3">v{p.version}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <Card className="mt-5">
        <form action={createProposalAction} className="grid gap-4 sm:grid-cols-2">
          <Field label="Kind" htmlFor="kind">
            <Select id="kind" name="kind" defaultValue="reading_course">
              {PROPOSAL_KINDS.map((k) => (
                <option key={k.kind} value={k.kind}>
                  {k.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Department" htmlFor="departmentId">
            <Select id="departmentId" name="departmentId">
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Title" htmlFor="title">
              <Input id="title" name="title" required minLength={5} maxLength={160} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Purpose: what it is for" htmlFor="purpose">
              <Textarea id="purpose" name="purpose" rows={2} required minLength={20} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Scope: what it covers and leaves out" htmlFor="scope">
              <Textarea id="scope" name="scope" rows={3} required minLength={20} />
            </Field>
          </div>
          <Field label="Depth" htmlFor="depth">
            <Select id="depth" name="depth" defaultValue="standard">
              <option value="survey">A survey</option>
              <option value="standard">Standard</option>
              <option value="rigorous">Rigorous</option>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Source leads, one per line as “Title | note” (optional)" htmlFor="sources">
              <Textarea id="sources" name="sources" rows={3} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit">Save as a draft and search for overlap</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
