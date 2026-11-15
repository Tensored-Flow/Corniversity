import { getEnv } from "@corniversity/db/env";
import { discoverClient, openAlexBrowsingAllowed, type SubfieldsView, subjectSubfields } from "@corniversity/db/services/discover";
import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { Fetching } from "./cross";
import { failureText, KEY_NEEDED, resetText } from "./failure";
import { ProvenanceLine } from "./lists";

function SubfieldsBody({ view, name }: { view: SubfieldsView; name: string }) {
  if (view.state === "not_cached") return <Fetching />;
  if (view.state === "subfield")
    return (
      <p className="mt-2 text-sm text-ink-2">
        {name} is an OpenAlex subfield
        {view.parent ? (
          <>
            {" "}
            of{" "}
            <Link href={`/library/subjects/${view.parent.slug}`} className="text-brass underline underline-offset-4">
              {view.parent.name}
            </Link>
          </>
        ) : null}
        .
      </p>
    );
  if (view.state === "key_needed") return <p className="mt-2 text-sm text-ink-2">{KEY_NEEDED}</p>;
  if (view.state === "failed") {
    const reset = resetText(view.resetAt);
    return (
      <p role="status" className="mt-2 text-sm text-rust">
        {failureText(view.code)}
        {reset ? ` ${reset}` : ""}
      </p>
    );
  }
  if (view.subfields.length === 0 || !view.provenance) return <p className="mt-2 text-sm text-ink-2">OpenAlex lists no subfields here.</p>;
  return (
    <>
      <ProvenanceLine provenance={view.provenance} provider="openalex" />
      <ul className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
        {view.subfields.map((s) => (
          <li key={s.id} className="text-sm text-ink">
            {s.name}
            {s.worksCount !== null ? (
              <span className="text-xs text-ink-3"> · {s.worksCount.toLocaleString("en-GB")} works in OpenAlex</span>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}

function client() {
  const env = getEnv();
  return { client: discoverClient(env, db()), browsing: openAlexBrowsingAllowed(env) };
}

async function SubfieldsFetched({ slug, name }: { slug: string; name: string }) {
  const { client: c, browsing } = client();
  return <SubfieldsBody name={name} view={await subjectSubfields(c, slug, { browsing, cache: "use" })} />;
}

/**
 * A subject room's subfields from the OpenAlex taxonomy: from the cache at once, else streamed in (an
 * out-of-date cached taxonomy is shown with its date while the fresh one streams in).
 */
export async function Subfields({ slug, name }: { slug: string; name: string }) {
  const { client: c, browsing } = client();
  const cached = await subjectSubfields(c, slug, { browsing, cache: "only" });
  if (cached.state !== "not_cached" && !(cached.state === "ready" && cached.provenance?.stale))
    return <SubfieldsBody name={name} view={cached} />;
  return (
    <Suspense fallback={<SubfieldsBody name={name} view={cached} />}>
      <SubfieldsFetched slug={slug} name={name} />
    </Suspense>
  );
}
