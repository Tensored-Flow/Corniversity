import { getEnv } from "@corniversity/db/env";
import {
  type CitedByView,
  type CourseSourceItem,
  citedByYourPapers,
  discoverClient,
  type ListView,
  openAlexBrowsingAllowed,
  type SimilarView,
  type SurpriseView,
  similarToRecent,
  surprise,
} from "@corniversity/db/services/discover";
import Link from "next/link";
import { Suspense } from "react";
import { Badge, LinkButton } from "@/components/ui";
import { db } from "@/lib/db";
import { failureText, KEY_NEEDED, resetText } from "./failure";
import { authorsLine, ListBody, ListCard, ProvenanceLine, SaveButton, workHref } from "./lists";

/**
 * The lists that depend on the owner's papers. Each renders what the provider cache already holds at
 * once (so it also works without JavaScript); only what still has to be fetched from OpenAlex streams
 * in, and an out-of-date cached list is shown with its date while the fresh one streams in. Without
 * JavaScript the streamed part cannot replace its placeholder, which then says to reload: the server
 * finishes the fetch and caches it either way.
 */

type WorkIndex = ReadonlyMap<string, string>;
/** A failed Save from this list (see CardNotice). */
type Notice = { notice?: string | null };

/** An out-of-date cached list: the request refreshes it. */
function stale(list: ListView): boolean {
  return list.state === "ready" && list.provenance.stale;
}

function services() {
  const env = getEnv();
  const database = db();
  return { database, client: discoverClient(env, database), browsing: openAlexBrowsingAllowed(env) };
}

export function Fetching() {
  return (
    <>
      <p role="status" className="mt-2 text-sm text-ink-3">
        Loading from OpenAlex…
      </p>
      <noscript>
        <p className="mt-1 text-sm text-ink-2">This list is fetched while the page loads; without JavaScript, reload the page to see it.</p>
      </noscript>
    </>
  );
}

const CITED_ID = "cited-by-yours";

function CitedByCard({ view, notice }: { view: CitedByView } & Notice) {
  return (
    <ListCard
      id={CITED_ID}
      title="Cited by 2 or more of your papers"
      description="Counted from the reference lists of your saved papers, as OpenAlex matched them; papers already in your library are left out."
      notice={notice}
    >
      {view.state === "not_cached" ? (
        <Fetching />
      ) : view.state === "empty" ? (
        <p className="mt-2 text-sm text-ink-2">
          No work is cited by two or more of your saved papers yet. You have {view.savedPapers} saved{" "}
          {view.savedPapers === 1 ? "paper" : "papers"}; {view.withReferences} {view.withReferences === 1 ? "has" : "have"} a reference list
          from OpenAlex.
        </p>
      ) : (
        <>
          <ListBody view={view.list} provider="openalex" returnTo="/library/discover" anchor={CITED_ID} />
          {view.missing > 0 ? (
            <p className="mt-1 text-xs text-ink-3">
              OpenAlex returned no record for {view.missing} more cited {view.missing === 1 ? "work" : "works"}.
            </p>
          ) : null}
        </>
      )}
    </ListCard>
  );
}

type CrossProps = { ownerId: string; index: WorkIndex } & Notice;

async function CitedByFetched({ ownerId, index, notice }: CrossProps) {
  const { database, client, browsing } = services();
  return <CitedByCard notice={notice} view={await citedByYourPapers(database, ownerId, client, { browsing, index, cache: "use" })} />;
}

/** Cited by 2 or more of your papers: counted from the saved papers' reference lists (as OpenAlex matched them). */
export async function CitedByYourPapers(props: CrossProps) {
  const { database, client, browsing } = services();
  const cached = await citedByYourPapers(database, props.ownerId, client, { browsing, index: props.index, cache: "only" });
  if (cached.state !== "not_cached" && !(cached.state === "list" && stale(cached.list)))
    return <CitedByCard view={cached} notice={props.notice} />;
  return (
    <Suspense fallback={<CitedByCard view={cached} notice={props.notice} />}>
      <CitedByFetched {...props} />
    </Suspense>
  );
}

const SIMILAR_ID = "similar";

function SimilarCard({ view, notice }: { view: SimilarView } & Notice) {
  if (view.state !== "list")
    return (
      <ListCard
        id={SIMILAR_ID}
        title="Similar to a paper you saved"
        description="OpenAlex's related works (similarity, not a citation)."
        notice={notice}
      >
        {view.state === "not_cached" ? (
          <Fetching />
        ) : view.savedPapers === 0 ? (
          <p className="mt-2 text-sm text-ink-2">Save a paper to see the works OpenAlex considers similar to it.</p>
        ) : (
          <p className="mt-2 text-sm text-ink-2">
            None of your saved papers has an OpenAlex identifier yet; OpenAlex finds similar works only for a paper it has a record of.
          </p>
        )}
      </ListCard>
    );
  return (
    <ListCard
      id={SIMILAR_ID}
      title={
        <>
          Similar to <em>{view.basis.title}</em>
        </>
      }
      description={
        <>
          In OpenAlex (similarity, not a citation); your most recently saved paper that has an OpenAlex identifier.{" "}
          <Link href={`/library/papers/${view.basis.workId}`} className="text-brass underline underline-offset-4">
            Its page
          </Link>
        </>
      }
      notice={notice}
    >
      <ListBody view={view.list} provider="openalex" returnTo="/library/discover" anchor={SIMILAR_ID} />
    </ListCard>
  );
}

async function SimilarFetched({ ownerId, index, notice }: CrossProps) {
  const { database, client, browsing } = services();
  return <SimilarCard notice={notice} view={await similarToRecent(database, ownerId, client, { browsing, index, cache: "use" })} />;
}

/** Similar to a recently saved paper: OpenAlex's related works (similarity, never called citation). */
export async function SimilarToRecent(props: CrossProps) {
  const { database, client, browsing } = services();
  const cached = await similarToRecent(database, props.ownerId, client, { browsing, index: props.index, cache: "only" });
  if (cached.state !== "not_cached" && !(cached.state === "list" && stale(cached.list)))
    return <SimilarCard view={cached} notice={props.notice} />;
  return (
    <Suspense fallback={<SimilarCard view={cached} notice={props.notice} />}>
      <SimilarFetched {...props} />
    </Suspense>
  );
}

/** From your courses: registry sources (verified by opening) that carry a DOI or arXiv id; read-only. */
export function FromYourCourses({ view }: { view: { items: CourseSourceItem[]; total: number; courses: number } }) {
  const id = "from-courses";
  return (
    <ListCard
      id={id}
      title="From your courses"
      description="Sources of the courses you take, from the source registry, whose address carries a DOI or an arXiv id."
    >
      {view.courses === 0 ? (
        <p className="mt-2 text-sm text-ink-2">
          You are not taking a course.{" "}
          <Link href="/catalogue" className="text-brass underline underline-offset-4">
            Catalogue
          </Link>
        </p>
      ) : view.items.length === 0 ? (
        <p className="mt-2 text-sm text-ink-2">No source of your courses carries a DOI or an arXiv id.</p>
      ) : (
        <>
          <ol className="mt-2">
            {view.items.map((item) => (
              <li key={item.sourceId} className="flex items-start justify-between gap-3 border-t border-stone py-3 first:border-t-0">
                <div className="min-w-0">
                  <Link
                    href={workHref(item)}
                    prefetch={false}
                    className="inline-flex min-h-6 items-center text-ink underline-offset-4 [overflow-wrap:anywhere] hover:underline"
                  >
                    {item.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-ink-2 [overflow-wrap:anywhere]">
                    {authorsLine(item.authors, undefined, "No authors recorded")} ·{" "}
                    {item.ref.scheme === "arxiv"
                      ? `arXiv:${item.ref.value}`
                      : item.ref.scheme === "doi"
                        ? `DOI ${item.ref.value}`
                        : item.ref.value}
                  </p>
                  <p className="text-xs text-ink-3">
                    {item.courses.map((c) => `${c.id} ${c.title}`).join("; ")} · verified in the source registry on {item.verifiedAt}
                  </p>
                </div>
                {item.workId ? (
                  <div className="shrink-0">
                    <Badge tone="moss">In your library</Badge>
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
          {view.total > view.items.length ? (
            <p className="mt-1 text-xs text-ink-3">
              {view.total - view.items.length} more in the{" "}
              <Link href="/library/sources" className="text-brass underline underline-offset-4">
                source registry
              </Link>
              .
            </p>
          ) : null}
        </>
      )}
    </ListCard>
  );
}

function SurpriseBody({ view, n }: { view: SurpriseView; n: number }) {
  const returnTo = `/library/discover?surprise=${n}`;
  const another = n < 1000 ? `/library/discover?surprise=${n + 1}#surprise` : null;
  const anotherLink = another ? (
    <LinkButton href={another} variant="secondary">
      Another
    </LinkButton>
  ) : null;
  if (view.state === "not_cached") return <Fetching />;
  if (view.state === "no_field") return <p className="mt-2 text-sm text-ink-2">Every OpenAlex field is already one of your subjects.</p>;
  if (view.state === "failed") {
    const reset = view.view.state === "failed" ? resetText(view.view.resetAt) : null;
    return (
      <p role="status" className="mt-2 text-sm text-rust">
        {view.view.state === "key_needed" ? KEY_NEEDED : failureText(view.view.code)}
        {reset ? ` ${reset}` : ""}
      </p>
    );
  }
  if (view.state === "none")
    return (
      <div className="mt-2 flex flex-col gap-2">
        <p className="text-sm text-ink-2">OpenAlex's sample found no review in {view.field.name} with an abstract that is free to read.</p>
        <div>{anotherLink}</div>
      </div>
    );
  const { pick } = view;
  return (
    <article aria-labelledby="surprise-title" className="mt-3">
      <p className="text-xs text-ink-2">{view.reason.text}.</p>
      <ProvenanceLine provenance={pick.provenance} provider="openalex" />
      <h4 id="surprise-title" className="mt-2 text-lg text-ink [overflow-wrap:anywhere]">
        <Link href={workHref(pick.item)} prefetch={false} className="inline-flex min-h-6 items-center underline-offset-4 hover:underline">
          {pick.item.title ?? `Untitled (OpenAlex ${pick.item.ref.value})`}
        </Link>
      </h4>
      <p className="text-xs text-ink-2 [overflow-wrap:anywhere]">
        {authorsLine(pick.item.authors, pick.item.moreAuthors)}
        {pick.item.year ? ` · ${pick.item.year}` : ""}
        {pick.venue ? ` · ${pick.venue}` : ""}
      </p>
      {pick.item.citedByCount !== null ? (
        <p className="text-xs text-ink-3">Cited by {pick.item.citedByCount.toLocaleString("en-GB")} works in OpenAlex</p>
      ) : null}
      {pick.abstract ? (
        <div className="mt-3">
          <p className="text-xs uppercase tracking-wide text-ink-3">Abstract, as indexed by OpenAlex</p>
          <p className="mt-1 max-w-prose text-sm text-ink [overflow-wrap:anywhere]">{pick.abstract}</p>
        </div>
      ) : null}
      {pick.freeAt ? (
        <p className="mt-3 text-sm text-ink-2">
          Free to read at{" "}
          <a href={pick.freeAt.url} target="_blank" rel="noopener noreferrer" className="text-brass underline underline-offset-4">
            {pick.freeAt.host}
          </a>
          , according to OpenAlex.
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {pick.item.workId ? (
          <Badge tone="moss">In your library</Badge>
        ) : (
          <SaveButton item={pick.item} returnTo={returnTo} anchor="surprise" />
        )}
        {anotherLink}
      </div>
    </article>
  );
}

type SurpriseProps = { ownerId: string; index: WorkIndex; n: number; slugs: readonly string[] };

async function SurpriseFetched({ ownerId, index, n, slugs }: SurpriseProps) {
  const { database, client, browsing } = services();
  return (
    <SurpriseBody n={n} view={await surprise(database, ownerId, client, { now: new Date(), n, browsing, slugs, index, cache: "use" })} />
  );
}

/** Surprise me: one sampled review from a field outside the owner's subjects, shown when asked for. */
export async function SurprisePick(props: SurpriseProps) {
  const { database, client, browsing } = services();
  const { ownerId, index, n, slugs } = props;
  const cached = await surprise(database, ownerId, client, { now: new Date(), n, browsing, slugs, index, cache: "only" });
  if (cached.state !== "not_cached" && !(cached.state === "pick" && cached.pick.provenance.stale))
    return <SurpriseBody n={n} view={cached} />;
  return (
    <Suspense fallback={<SurpriseBody n={n} view={cached} />}>
      <SurpriseFetched {...props} />
    </Suspense>
  );
}
