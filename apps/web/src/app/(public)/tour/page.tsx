import { Badge, Card, LinkButton } from "@/components/ui";

export const metadata = { title: "A short tour" };

/**
 * A static description of the institution. Deliberately not a demo account: it never creates
 * activity in anyone's real record, and everything below is labelled as illustration.
 */
export default function TourPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-8">
      <div className="flex items-center gap-3">
        <h1 className="text-3xl text-ink">A short tour</h1>
        <Badge tone="neutral">Illustration only</Badge>
      </div>
      <p className="prose-reading mt-4 text-ink-2">
        Corniversity is shaped like a small college rather than a dashboard. Here is how a term goes.
      </p>
      <ol className="mt-8 flex flex-col gap-4">
        {[
          ["Orientation", "Twelve short steps: who you are, what you want to study, what you already know, how you like to learn, and how much time you really have. Everything is saved as you go."],
          ["A programme, not a playlist", "A director of studies (an AI persona, labelled as such) proposes a coherent first term: usually one demanding core course and a lighter reading seminar, with prerequisites explained and workload estimated honestly."],
          ["Real materials", "Courses adapt openly licensed university materials and author-hosted notes. Every reading has an exact source and page; the catalogue says plainly which courses are fully prepared and which are still proposals."],
          ["Lectures, tutorials, laboratories", "A lecture room with equations and sources; a tutorial workbench with a hint ladder rather than instant answers; computational laboratories with models you can actually change."],
          ["Serious work, careful feedback", "Proof attempts are kept as immutable versions. Feedback localises the first substantive gap, accepts valid alternative proofs, and says when it is unsure. Progress is shown as evidence, never as a percentage."],
          ["A record you keep", "A notebook of definitions, attempts and unresolved questions; an unofficial transcript; portable exports. Yours, in formats you can read without the software."],
        ].map(([title, body], index) => (
          <li key={title}>
            <Card>
              <p className="text-xs uppercase tracking-[0.18em] text-brass">Step {index + 1}</p>
              <h2 className="mt-1 text-xl text-ink">{title}</h2>
              <p className="mt-2 text-sm text-ink-2">{body}</p>
            </Card>
          </li>
        ))}
      </ol>
      <div className="mt-10 flex gap-3">
        <LinkButton href="/sign-in">Sign in</LinkButton>
        <LinkButton href="/" variant="secondary">
          Back
        </LinkButton>
      </div>
    </div>
  );
}
