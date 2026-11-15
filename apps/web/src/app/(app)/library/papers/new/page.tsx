import { getEnv } from "@corniversity/db/env";
import { isUuid } from "@corniversity/db/ids";
import Link from "next/link";
import { Button, Card, Field, Input } from "@/components/ui";
import { requireSession } from "@/lib/session";
import { FlashNotices, LibraryHeader } from "../../shared";

export const metadata = { title: "Add a paper" };

/**
 * A paper without an identifier: the owner's PDF becomes a new paper (not identified by any
 * provider) that can be read, annotated and shelved at once, and merged later into the identified
 * paper. The form posts to /api/library/papers/new (multipart; no JavaScript needed).
 */
export default async function NewPaperPage({ searchParams }: { searchParams: Promise<{ error?: string; other?: string }> }) {
  await requireSession("/library/papers/new");
  const { error, other } = await searchParams;
  const env = getEnv();
  return (
    <div className="mx-auto w-full max-w-3xl">
      <LibraryHeader title="Add a paper without an identifier" active="/library/find" />
      <FlashNotices error={error} />
      {other && isUuid(other) ? (
        <p className="-mt-2 mb-4 text-sm">
          <Link href={`/library/papers/${other}`} className="text-brass underline underline-offset-4">
            Open the paper that file belongs to
          </Link>
        </p>
      ) : null}
      <Card>
        <form method="post" action="/api/library/papers/new" encType="multipart/form-data" className="flex flex-col gap-4">
          <Field label={`PDF (up to ${env.MAX_UPLOAD_MB} MB)`} htmlFor="new-paper-file">
            <input
              id="new-paper-file"
              name="file"
              type="file"
              required
              accept=".pdf,application/pdf"
              className="block w-full text-sm text-ink file:mr-3 file:rounded-[var(--radius-control)] file:border file:border-stone-2 file:bg-paper-2 file:px-3 file:py-2 file:text-sm file:text-ink"
            />
          </Field>
          <Field label="Title (optional)" htmlFor="new-paper-title" hint="Nothing is read from the file to fill this in.">
            <Input id="new-paper-title" name="title" maxLength={500} />
          </Field>
          <div>
            <Button type="submit">Add paper</Button>
          </div>
        </form>
      </Card>
      <p className="mt-3 max-w-prose text-sm text-ink-2">
        If the paper has a DOI, arXiv id or OpenAlex id,{" "}
        <Link href="/library/find" className="text-brass underline underline-offset-4">
          find it by that
        </Link>{" "}
        instead and attach your PDF on its page.
      </p>
    </div>
  );
}
