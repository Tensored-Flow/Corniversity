import { getEnv } from "@corniversity/db/env";
import { discoverClient, discoverPage, MAX_SURPRISE, openAlexBrowsingAllowed } from "@corniversity/db/services/discover";
import Link from "next/link";
import { EmptyState, LinkButton, Notice } from "@/components/ui";
import { db } from "@/lib/db";
import { errorNotice } from "@/lib/notices";
import { requireSession } from "@/lib/session";
import { FlashNotices, LibraryHeader } from "../shared";
import { CitedByYourPapers, FromYourCourses, SimilarToRecent, SurprisePick } from "./_components/cross";
import { cardNotice, ListCard, noticeFor, SubjectListCards, subjectCardIds } from "./_components/lists";
import { RefreshWhilePending } from "./_components/RefreshWhilePending";
import { SubjectsForm } from "./_components/SubjectsForm";

export const metadata = { title: "Discover" };

const SAVED: Record<string, string> = { paper: "Saved to your library.", subjects: "Subjects saved." };

function surpriseNumber(value: string | undefined): number | null {
  if (!value || !/^\d{1,4}$/.test(value)) return null;
  const n = Number(value);
  return n >= 1 && n <= MAX_SURPRISE ? n : null;
}

/**
 * Discover (contract §9): the owner's subjects with New on arXiv, Reviews and surveys, Most cited and
 * Earlier work each, rendered from the provider cache (a missing list is fetched by the worker and
 * the page refreshes until it arrives); across subjects, the lists that depend on the owner's papers
 * render from the cache or stream in from OpenAlex, From your courses comes from the source registry,
 * and Surprise me is fetched only when asked for. Every count names its source; nothing is scored.
 */
export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; surprise?: string; at?: string }>;
}) {
  const session = await requireSession("/library/discover");
  const { error, saved, surprise, at } = await searchParams;
  const ownerId = session.user.id;
  const env = getEnv();
  const database = db();
  const view = await discoverPage(database, ownerId, discoverClient(env, database), {
    now: new Date(),
    browsing: openAlexBrowsingAllowed(env),
  });
  const n = surpriseNumber(surprise);
  const chosen = view.subjects.map((s) => s.slug);
  // A failed Save's notice goes in the list it came from, when that list is on the page.
  const cards = [...view.lists.flatMap(subjectCardIds), "cited-by-yours", "similar", ...(n === null ? [] : ["surprise"])];
  const notice = cardNotice(at, errorNotice(error), cards);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <LibraryHeader title="Discover" active="/library/discover" />
      <FlashNotices error={notice ? undefined : error} />
      {saved && Object.hasOwn(SAVED, saved) ? (
        <div className="mb-4">
          <Notice tone="moss">{SAVED[saved]}</Notice>
        </div>
      ) : null}
      <RefreshWhilePending active={view.pending} />

      <SubjectsForm chosen={chosen} />

      {view.lists.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="No subjects chosen" body="Choose one or more subjects above to see their lists here." />
        </div>
      ) : (
        view.lists.map((lists) => (
          <section key={lists.subject.slug} aria-labelledby={`${lists.subject.slug}-heading`} className="mt-8">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 id={`${lists.subject.slug}-heading`} className="text-xl text-ink">
                {lists.subject.name}
              </h2>
              <Link
                href={`/library/subjects/${lists.subject.slug}`}
                className="inline-flex min-h-6 items-center text-sm text-brass underline underline-offset-4"
              >
                {lists.subject.name}: subject room
              </Link>
            </div>
            <SubjectListCards lists={lists} returnTo="/library/discover" headingLevel={3} notice={notice} />
          </section>
        ))
      )}

      <section aria-labelledby="across-heading" className="mt-10">
        <h2 id="across-heading" className="mb-3 text-xl text-ink">
          Across your subjects
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <CitedByYourPapers ownerId={ownerId} index={view.index} notice={noticeFor(notice, "cited-by-yours")} />
          <SimilarToRecent ownerId={ownerId} index={view.index} notice={noticeFor(notice, "similar")} />
          <FromYourCourses view={view.fromCourses} />
          <ListCard
            id="surprise"
            title="Surprise me"
            description="One review from a field outside your subjects, chosen by OpenAlex sampling."
            notice={noticeFor(notice, "surprise")}
          >
            {n === null ? (
              <div className="mt-3">
                <LinkButton href="/library/discover?surprise=1#surprise" variant="secondary">
                  Surprise me
                </LinkButton>
              </div>
            ) : (
              <SurprisePick ownerId={ownerId} index={view.index} n={n} slugs={chosen} />
            )}
          </ListCard>
        </div>
      </section>
    </div>
  );
}
