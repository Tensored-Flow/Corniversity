import { isSubjectSlug, subjectBySlug } from "@corniversity/core";
import { getEnv } from "@corniversity/db/env";
import { discoverClient, openAlexBrowsingAllowed, subjectRoom } from "@corniversity/db/services/discover";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Notice } from "@/components/ui";
import { db } from "@/lib/db";
import { errorNotice } from "@/lib/notices";
import { requireSession } from "@/lib/session";
import { cardNotice, SubjectListCards, subjectCardIds } from "../../discover/_components/lists";
import { RefreshWhilePending } from "../../discover/_components/RefreshWhilePending";
import { Subfields } from "../../discover/_components/Subfields";
import { FlashNotices, LibraryHeader } from "../../shared";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: subjectBySlug(slug)?.name ?? "Subject" };
}

/**
 * A subject room (contract §2, §9): the subject's subfields in the OpenAlex taxonomy and its lists in
 * full, from the same cache as Discover.
 */
export default async function SubjectRoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; saved?: string; at?: string }>;
}) {
  const { slug } = await params;
  if (!isSubjectSlug(slug)) notFound();
  const session = await requireSession(`/library/subjects/${slug}`);
  const { error, saved, at } = await searchParams;
  const env = getEnv();
  const database = db();
  const view = await subjectRoom(database, session.user.id, discoverClient(env, database), slug, {
    now: new Date(),
    browsing: openAlexBrowsingAllowed(env),
  });
  const { subject } = view;
  // A failed Save's notice goes in the list it came from.
  const notice = cardNotice(at, errorNotice(error), subjectCardIds(view.lists));
  const openalex = `OpenAlex ${subject.openalex.level} ${subject.openalex.name}`;
  const arxiv = subject.arxivCategories.length > 0 ? ` · arXiv ${subject.arxivCategories.join(", ")}` : "";

  return (
    <div className="mx-auto w-full max-w-6xl">
      <LibraryHeader title={subject.name} active="/library/discover" />
      <p className="-mt-2 mb-4 text-sm text-ink-2 [overflow-wrap:anywhere]">
        <Link href="/library/discover" className="text-brass underline underline-offset-4">
          Discover
        </Link>{" "}
        · {view.chosen ? "One of your subjects" : "Not one of your subjects"} · {openalex}
        {arxiv}
      </p>
      <FlashNotices error={notice ? undefined : error} />
      {saved === "paper" ? (
        <div className="mb-4">
          <Notice tone="moss">Saved to your library.</Notice>
        </div>
      ) : null}
      <RefreshWhilePending active={view.lists.pending} />

      <section aria-labelledby="subfields-heading" className="mb-8 rounded-[var(--radius-panel)] border border-stone bg-paper-2 p-4">
        <h2 id="subfields-heading" className="text-lg text-ink">
          Subfields
        </h2>
        <Subfields slug={subject.slug} name={subject.name} />
      </section>

      <SubjectListCards lists={view.lists} returnTo={`/library/subjects/${subject.slug}`} headingLevel={2} notice={notice} />
    </div>
  );
}
