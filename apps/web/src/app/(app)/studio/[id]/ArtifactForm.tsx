"use client";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Button, Field, Input, Select } from "@/components/ui";

/**
 * Attaches an artefact: a small file (image, table, code, JSON or text, up to 5 MB), or a
 * notebook entry already tagged with the project. Files go through an upload route because they
 * can exceed what a form action carries.
 */
export function ArtifactForm({ projectId, notebook }: { projectId: string; notebook: { id: string; title: string }[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = event.currentTarget;
    const body = new FormData(form);
    body.set("projectId", projectId);
    const response = await fetch("/api/studio/artifacts", { method: "POST", body });
    setPending(false);
    if (!response.ok) {
      const json = (await response.json().catch(() => ({}))) as { error?: string };
      setError(json.error ?? `The artefact could not be attached (${response.status}).`);
      return;
    }
    form.reset();
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mt-3 grid gap-3 sm:grid-cols-2">
      <Field label="Title" htmlFor="art-title">
        <Input id="art-title" name="title" required />
      </Field>
      <Field label="Kind" htmlFor="art-kind">
        <Select id="art-kind" name="kind" defaultValue="figure">
          {["figure", "table", "code", "data", "notes", "other"].map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="File (PNG, JPEG, CSV, code, JSON or text; at most 5 MB)" htmlFor="art-file">
        <Input id="art-file" name="file" type="file" accept=".png,.jpg,.jpeg,.csv,.txt,.md,.json,.py" />
      </Field>
      <Field label="Or a notebook entry of this project" htmlFor="art-note">
        <Select id="art-note" name="notebookEntryId" defaultValue="">
          <option value="">None</option>
          {notebook.map((n) => (
            <option key={n.id} value={n.id}>
              {n.title}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="What it shows (optional)" htmlFor="art-desc">
        <Input id="art-desc" name="description" />
      </Field>
      <div className="flex items-end">
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Attaching…" : "Attach"}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-rust sm:col-span-2">
          {error}
        </p>
      ) : null}
    </form>
  );
}
