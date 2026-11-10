import { REVIEW_RULE } from "@corniversity/core/review/review";
import { nextReviewItems } from "@corniversity/db/services/revision";
import { db } from "@/lib/db";
import { archiveReviewAction, reviewRevisionAction, saveReviewSettingsAction, snoozeReviewAction } from "./actions";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const KIND_LABEL: Record<string, string> = {
  definition: "Definition",
  theorem: "Theorem",
  problem: "Problem",
  explain: "Explain back",
  counterexample: "Counterexample",
  derivation: "Short derivation",
  unfamiliar: "Unfamiliar problem",
  issue: "Revisit an issue",
};

/**
 * Review, bounded: the rule in plain words, the small next set, and the learner's own choices
 * (weekly number, pause, days kept free). Items past their date are not owed; skipping costs
 * nothing, and ordinary study never waits for review.
 */
export async function ReviewSection({ ownerId }: { ownerId: string }) {
  const { settings, set, items, reviewedThisWeek } = await nextReviewItems(db(), ownerId);
  const state =
    set.kind === "paused"
      ? "Review is paused. Nothing is offered until you resume it."
      : set.kind === "rest_day"
        ? "Today is a day you keep free, so nothing is offered."
        : set.kind === "budget_used"
          ? `You have reviewed your ${settings.budgetPerWeek} items for this week. Nothing more is offered until Monday.`
          : items.length === 0
            ? "Nothing to review now."
            : `The next set: ${items.length} item${items.length === 1 ? "" : "s"}.`;
  return (
    <section className="mt-10" aria-labelledby="revision">
      <h2 id="revision" className="text-xl text-ink">
        Review
      </h2>
      <p className="mt-1 max-w-prose text-sm text-ink-2">{REVIEW_RULE}</p>
      <p className="mt-2 text-sm text-ink" role="status">
        {state}{" "}
        <span className="text-ink-3">
          ({reviewedThisWeek} of {settings.budgetPerWeek} this week; {set.dueCount} past their date, which is information, not a debt.)
        </span>
      </p>
      {items.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id} className="rounded-[var(--radius-panel)] border border-stone bg-paper-2 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-ink-3">
                {KIND_LABEL[item.kind] ?? item.kind} · {item.conceptTitle}
              </p>
              <p className="mt-1 text-sm text-ink">{item.prompt}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(["recalled", "shaky", "forgot"] as const).map((outcome) => (
                  <form key={outcome} action={reviewRevisionAction}>
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="outcome" value={outcome} />
                    <button
                      type="submit"
                      className="rounded-[var(--radius-control)] border border-stone-2 bg-paper px-3 py-1 text-xs text-ink hover:bg-paper-3"
                    >
                      {outcome === "recalled" ? "Recalled it" : outcome === "shaky" ? "Shaky" : "Forgot"}
                    </button>
                  </form>
                ))}
                <form action={snoozeReviewAction}>
                  <input type="hidden" name="id" value={item.id} />
                  <button
                    type="submit"
                    className="rounded-[var(--radius-control)] px-3 py-1 text-xs text-ink-2 underline-offset-4 hover:underline"
                  >
                    Snooze 3 days
                  </button>
                </form>
                <form action={archiveReviewAction}>
                  <input type="hidden" name="id" value={item.id} />
                  <button
                    type="submit"
                    className="rounded-[var(--radius-control)] px-3 py-1 text-xs text-ink-2 underline-offset-4 hover:underline"
                  >
                    Archive
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      <details className="mt-4 rounded-[var(--radius-panel)] border border-stone bg-paper-2 px-4 py-3 text-sm">
        <summary className="cursor-pointer text-ink">Your review choices</summary>
        <form action={saveReviewSettingsAction} className="mt-3 flex flex-col gap-3">
          <label className="flex items-center gap-2">
            <span className="text-ink-2">Items a week</span>
            <input
              type="number"
              name="budgetPerWeek"
              min={1}
              max={50}
              defaultValue={settings.budgetPerWeek}
              className="w-20 rounded-[var(--radius-control)] border border-stone-2 bg-paper px-2 py-1"
            />
            <span className="text-xs text-ink-3">{settings.chosen.budgetPerWeek ? "your choice" : "default from your weekly hours"}</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="paused" value="1" defaultChecked={settings.paused} /> Pause all review
          </label>
          <fieldset>
            <legend className="text-ink-2">Days kept free of review</legend>
            <div className="mt-1 flex flex-wrap gap-3">
              {WEEKDAYS.map((d, i) => (
                <label key={d} className="flex items-center gap-1 text-xs">
                  <input type="checkbox" name="restWeekdays" value={i + 1} defaultChecked={settings.restWeekdays.includes(i + 1)} /> {d}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <button
              type="submit"
              className="rounded-[var(--radius-control)] border border-stone-2 bg-paper px-3 py-1 text-sm hover:bg-paper-3"
            >
              Save review choices
            </button>
          </div>
        </form>
      </details>
    </section>
  );
}
