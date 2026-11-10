import { listIssues } from "@corniversity/db/services/learning-issues";
import { Badge, Card } from "@/components/ui";
import { db } from "@/lib/db";
import { createIssueAction, deleteIssueAction, respondIssueAction } from "./issue-actions";

const STATUS_TONE: Record<string, "neutral" | "brass" | "rust" | "moss" | "slate"> = {
  proposed: "slate",
  confirmed: "rust",
  revisiting: "brass",
  resolved: "moss",
  dismissed: "neutral",
};
const ORIGIN: Record<string, string> = {
  check: "proposed by an automatic check",
  assessor: "proposed by the AI assessor",
  learner: "written by you",
};

const small = "rounded-[var(--radius-control)] border border-stone-2 bg-paper px-2 py-1 text-xs text-ink hover:bg-paper-3";

/**
 * Issues: specific points in pieces of work, each with where it came from. A proposal is only a
 * proposal until the learner confirms it; corrections, disputes, resolution and deletion are all
 * the learner's.
 */
export async function IssuesSection({ ownerId }: { ownerId: string }) {
  const rows = await listIssues(db(), ownerId);
  const current = rows.filter((r) => ["proposed", "confirmed", "revisiting"].includes(r.issue.status));
  const closed = rows.filter((r) => !["proposed", "confirmed", "revisiting"].includes(r.issue.status));
  return (
    <Card as="section" aria-labelledby="issues-heading">
      <h2 id="issues-heading" className="text-lg text-ink">
        Issues to revisit ({current.length})
      </h2>
      <p className="mt-1 text-sm text-ink-2">
        Each describes a piece of work, never you. Confirm a proposal only if you agree; correct its wording, dispute it, or resolve it when
        later work shows it is fixed. Past issues are never shown to the assessor.
      </p>
      {current.length === 0 ? <p className="mt-3 text-sm text-ink-3">No open issues.</p> : null}
      <ul className="mt-3 flex flex-col gap-3">
        {current.map(({ issue, conceptTitle }) => (
          <li key={issue.id} className="rounded-[var(--radius-panel)] border border-stone bg-paper px-3 py-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={STATUS_TONE[issue.status]}>{issue.status}</Badge>
              <span className="text-xs text-ink-3">
                {ORIGIN[issue.origin]}
                {conceptTitle ? ` · ${conceptTitle}` : ""}
                {issue.exerciseId ? ` · ${issue.exerciseId}` : ""}
              </span>
            </div>
            <p className="mt-2 text-ink">{issue.claim}</p>
            {issue.interpretation ? <p className="mt-1 text-xs text-ink-3">{issue.interpretation}</p> : null}
            {issue.followUp ? <p className="mt-1 text-xs text-ink-2">Follow-up: {issue.followUp}</p> : null}
            <div className="mt-3 flex flex-col gap-2">
              {issue.status === "proposed" ? (
                <form action={respondIssueAction} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="id" value={issue.id} />
                  <input type="hidden" name="kind" value="confirm" />
                  <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-ink-2">
                    Correct the wording if needed
                    <input
                      name="statement"
                      defaultValue={issue.claim}
                      className="rounded-[var(--radius-control)] border border-stone-2 bg-paper-2 px-2 py-1 text-sm"
                    />
                  </label>
                  <button type="submit" className={small}>
                    Confirm
                  </button>
                </form>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {issue.status !== "revisiting" ? (
                  <form action={respondIssueAction}>
                    <input type="hidden" name="id" value={issue.id} />
                    <input type="hidden" name="kind" value="revisit" />
                    <button type="submit" className={small}>
                      I am revisiting it
                    </button>
                  </form>
                ) : null}
                <form action={deleteIssueAction}>
                  <input type="hidden" name="id" value={issue.id} />
                  <button type="submit" className={small}>
                    Delete
                  </button>
                </form>
              </div>
              <form action={respondIssueAction} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={issue.id} />
                <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-ink-2">
                  Why you disagree, or what resolved it
                  <input name="note" className="rounded-[var(--radius-control)] border border-stone-2 bg-paper-2 px-2 py-1 text-sm" />
                </label>
                <button type="submit" name="kind" value="dispute" className={small}>
                  Dispute
                </button>
                <button type="submit" name="kind" value="resolve" className={small}>
                  Resolved
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>
      {closed.length ? (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-ink-2">Resolved and dismissed ({closed.length})</summary>
          <ul className="mt-2 flex flex-col gap-2">
            {closed.map(({ issue }) => (
              <li key={issue.id} className="rounded-[var(--radius-control)] border border-stone bg-paper px-3 py-2 text-xs">
                <Badge tone={STATUS_TONE[issue.status]}>{issue.status}</Badge> <span className="text-ink-2">{issue.claim}</span>
                {issue.resolvedBy?.note ? <span className="ml-1 text-ink-3">({issue.resolvedBy.note})</span> : null}
                {issue.learnerNote ? <span className="ml-1 text-ink-3">(your note: {issue.learnerNote})</span> : null}
                <form action={respondIssueAction} className="mt-1 inline-block">
                  <input type="hidden" name="id" value={issue.id} />
                  <input type="hidden" name="kind" value="reopen" />
                  <button type="submit" className="underline">
                    Reopen
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-ink-2">Record an issue yourself</summary>
        <form action={createIssueAction} className="mt-2 flex flex-col gap-2">
          <label htmlFor="new-issue" className="text-xs text-ink-2">
            What went wrong, in which piece of work (for example: “In the C([0,1]) proof I used the triangle inequality the wrong way”)
          </label>
          <textarea
            id="new-issue"
            name="statement"
            rows={3}
            required
            minLength={10}
            className="rounded-[var(--radius-control)] border border-stone-2 bg-paper px-2 py-1"
          />
          <div>
            <button type="submit" className={small}>
              Record it
            </button>
          </div>
        </form>
      </details>
    </Card>
  );
}
