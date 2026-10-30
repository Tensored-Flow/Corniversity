import { LinkButton, Notice } from "./ui";

/**
 * An honest interim page for a destination that is planned but not yet built. It says so,
 * names the milestone, and offers a real next step. These pages are removed as each
 * milestone lands; none may remain at handoff.
 */
export function Interim({ title, milestone, body }: { title: string; milestone: string; body: string }) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="text-3xl text-ink">{title}</h1>
      <div className="mt-4">
        <Notice tone="neutral" title={`Being built (milestone ${milestone})`}>
          {body}
        </Notice>
      </div>
      <div className="mt-6 flex gap-3">
        <LinkButton href="/studies" variant="secondary">
          My Studies
        </LinkButton>
        <LinkButton href="/catalogue" variant="secondary">
          Catalogue
        </LinkButton>
      </div>
    </div>
  );
}
