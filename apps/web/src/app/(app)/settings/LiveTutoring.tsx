import { BUDGET_CEILINGS, BUDGET_WINDOW_TIMEZONE, modelLabel, type PublicProviderState, SUPPORTED_MODELS } from "@corniversity/ai";
import type { BudgetLimitsRow, ProviderSettingView } from "@corniversity/db/services/provider-config";
import { Badge, Button, Card, Field, Input, Notice, Select } from "@/components/ui";
import { saveLiveTutoringAction, settleRunAction, withdrawApprovalAction } from "./actions";

interface Run {
  id: string;
  role: string;
  model: string;
  status: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: string;
  worstCaseUsd?: string | null;
  error?: string | null;
  startedAt: Date;
}

interface Props {
  state: PublicProviderState;
  view: ProviderSettingView;
  limits: BudgetLimitsRow;
  spend: { todayUsd: number; monthUsd: number };
  runs: Run[];
  /** Runs whose cost the provider could not report; each holds its worst case until settled. */
  unsettled: Run[];
}

/**
 * The live-tutoring settings: which provider answers, the model, the key (write-only, shown by
 * its ends), refusal fallback, the spending limits, and the owner's approval of paid use, all
 * saved together so an approval covers exactly what is on screen. Recent runs show what was
 * actually spent.
 */
export function LiveTutoring({ state, view, limits, spend, runs, unsettled }: Props) {
  return (
    <Card as="section" aria-labelledby="provider-heading" id="provider">
      <h2 id="provider-heading" className="text-lg text-ink">
        Live tutoring and its costs
      </h2>
      <div className="mt-2">
        {state.mode === "scripted" ? (
          <Notice tone="neutral" title="Scripted demo">
            No model is configured. Tutors, the assessor, the director, the reading room and classmates answer with scripted text that does
            not read your work, and every such reply is labelled. Reading, notes, laboratories and prepared material work fully.
          </Notice>
        ) : state.mode === "plan" ? (
          <Notice tone="moss" title={`Your ChatGPT plan: ${state.model}`}>
            Requests go through your own ChatGPT plan, up to {state.dailyRequests} a day and {state.monthlyRequests} a month as you approved
            below. Nothing is billed to an API key, and a failed request is never answered by another provider or by scripted text.
          </Notice>
        ) : state.mode === "live" ? (
          <Notice tone="moss" title={`Live: ${modelLabel(state.model)}`}>
            Paid use was approved on {view.approval ? new Date(view.approval.approvedAt).toLocaleDateString("en-GB") : "an earlier date"}{" "}
            within the limits below. Every run is checked against its worst case before it starts, and its actual cost is recorded.
          </Notice>
        ) : (
          <Notice tone="rust" title="Live model blocked">
            {state.reason} Until then nothing is sent to a provider, and no scripted reply is shown in its place.
          </Notice>
        )}
      </div>

      <p className="mt-3 max-w-prose text-xs text-ink-3">
        A live model needs an API key from an organization in the Anthropic Console; signing in to Claude or a Claude subscription does not
        give this website a key, and the website never uses your Claude login. Some subscriptions include API credits for the Console:
        whether yours does, its expiry and your balance are shown only in your Console (
        <a
          className="underline"
          href="https://platform.claude.com/docs/en/about-claude/api-credits-for-subscribers"
          rel="noreferrer noopener"
          target="_blank"
        >
          API credits for subscribers
        </a>
        ). Nothing here buys credits or turns on automatic reloads.
      </p>

      <form action={saveLiveTutoringAction} className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Provider" htmlFor="provider-choice">
          <Select id="provider-choice" name="provider" defaultValue={view.provider}>
            <option value="fixture">Scripted demo (no model; nothing is sent anywhere)</option>
            <option value="anthropic">Anthropic (live model, paid)</option>
            <option value="chatgpt_plan">Your ChatGPT plan (local installation only; set up below)</option>
          </Select>
        </Field>
        <Field label="Model" htmlFor="model" hint={SUPPORTED_MODELS.find((m) => m.id === view.model)?.note}>
          <Select id="model" name="model" defaultValue={view.model}>
            {SUPPORTED_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="API key"
          htmlFor="apiKey"
          hint={
            view.keyHint ? `Stored key ${view.keyHint}. Leave blank to keep it.` : "Write-only; stored encrypted with the server secret."
          }
        >
          <Input id="apiKey" name="apiKey" type="password" autoComplete="off" />
        </Field>
        <div className="flex flex-col justify-end gap-2 text-sm text-ink">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="clearKey" value="1" /> Remove the stored key
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" name="refusalFallback" value="1" defaultChecked={view.refusalFallback} className="mt-1" />
            <span>
              If the model declines a request, let Anthropic re-run it on its recommended fallback model (a run can then be billed twice)
            </span>
          </label>
        </div>
        <fieldset className="grid gap-3 sm:col-span-2 sm:grid-cols-3">
          <legend className="mb-1 text-sm font-medium text-ink">Spending limits (USD), checked before every paid run</legend>
          <Field label="Per run" htmlFor="perRunUsd">
            <Input
              id="perRunUsd"
              name="perRunUsd"
              type="number"
              step="0.01"
              min={0.01}
              max={BUDGET_CEILINGS.perRunUsd}
              defaultValue={limits.perRunUsd}
            />
          </Field>
          <Field label="Per day" htmlFor="dailyUsd">
            <Input
              id="dailyUsd"
              name="dailyUsd"
              type="number"
              step="0.01"
              min={0.01}
              max={BUDGET_CEILINGS.dailyUsd}
              defaultValue={limits.dailyUsd}
            />
          </Field>
          <Field label="Per month" htmlFor="monthlyUsd">
            <Input
              id="monthlyUsd"
              name="monthlyUsd"
              type="number"
              step="0.01"
              min={0.01}
              max={BUDGET_CEILINGS.monthlyUsd}
              defaultValue={limits.monthlyUsd}
            />
          </Field>
        </fieldset>
        <p className="text-xs text-ink-3 sm:col-span-2">
          A run is refused before it starts if its worst case could cross a limit. The worst case is the whole output allowance (thinking
          counts towards it), every byte of the prompt counted as a token, each image at the provider's documented maximum, and, with
          fallback on, a second run on the fallback model. Counting a token per byte relies on the provider's tokenizer encoding at least
          one byte per token, which holds for byte-level tokenizers; the tokenizer is not published, so this is a stated assumption, not a
          proof. Runs in progress, and runs whose cost the provider could not report, count at their worst case until finished or settled;
          afterwards a run counts at what it cost. A record made afterwards cannot undo a charge. Spent or held today $
          {spend.todayUsd.toFixed(2)} · this month ${spend.monthUsd.toFixed(2)} ({BUDGET_WINDOW_TIMEZONE} day and month). Model use is
          billed by Anthropic to your API account, separately from hosting.
        </p>
        <label className="flex items-start gap-2 rounded-[var(--radius-control)] border border-stone bg-paper p-3 text-sm text-ink sm:col-span-2">
          <input type="checkbox" name="approvePaidUse" value="1" className="mt-1" />
          <span>
            I approve paid use of the selected model within these limits. Without this, a live model stays blocked; changing the model,
            turning fallback on or raising a limit needs approval again.
          </span>
        </label>
        <div className="sm:col-span-2">
          <Button type="submit">Save live tutoring settings</Button>
        </div>
      </form>
      {view.approval ? (
        <form action={withdrawApprovalAction} className="mt-2">
          <Button type="submit" variant="quiet">
            Withdraw approval of paid use
          </Button>
        </form>
      ) : null}

      {unsettled.length > 0 ? (
        <div className="mt-5">
          <h3 className="text-sm font-medium text-ink">Unsettled runs</h3>
          <p className="mt-1 max-w-prose text-xs text-ink-3">
            The provider may have billed these runs more than it reported (a connection was lost, a stream broke, or the process ended
            mid-run). Each counts at its worst case until you record the amount your Anthropic Console shows for it; the record is kept in
            the audit log.
          </p>
          <ul className="mt-2 flex flex-col gap-3">
            {unsettled.map((r) => (
              <li key={r.id} className="rounded-[var(--radius-panel)] border border-stone bg-paper p-3 text-xs">
                <p className="text-ink">
                  {r.startedAt.toISOString().slice(0, 16).replace("T", " ")} UTC · {r.role} · {modelLabel(r.model)} · held at $
                  {Number(r.worstCaseUsd ?? 0).toFixed(4)} (at least ${Number(r.costUsd).toFixed(4)} known)
                </p>
                {r.error ? <p className="mt-1 text-ink-3">{r.error}</p> : null}
                <form action={settleRunAction} className="mt-2 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="runId" value={r.id} />
                  <Field label="Amount from the console (USD)" htmlFor={`amount-${r.id}`}>
                    <Input id={`amount-${r.id}`} name="amountUsd" type="number" step="0.000001" min={0} required />
                  </Field>
                  <Field label="Where it comes from" htmlFor={`note-${r.id}`}>
                    <Input id={`note-${r.id}`} name="note" required minLength={5} placeholder="Console usage page" />
                  </Field>
                  <Button type="submit" variant="secondary">
                    Settle this run
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-5">
        <h3 className="text-sm font-medium text-ink">Recent model runs</h3>
        {runs.length === 0 ? (
          <p className="mt-1 text-xs text-ink-3">None yet.</p>
        ) : (
          <section
            className="mt-2 overflow-x-auto rounded-[var(--radius-panel)] border border-stone"
            // biome-ignore lint/a11y/noNoninteractiveTabindex: the table scrolls sideways on a phone and must be reachable by keyboard (axe: scrollable-region-focusable)
            tabIndex={0}
            aria-label="Recent model runs"
          >
            <table className="w-full min-w-[36rem] text-left text-xs">
              <thead className="bg-paper-3 uppercase tracking-wide text-ink-3">
                <tr>
                  <th className="px-2 py-1.5">When (UTC)</th>
                  <th className="px-2 py-1.5">Role</th>
                  <th className="px-2 py-1.5">Model</th>
                  <th className="px-2 py-1.5">Status</th>
                  <th className="px-2 py-1.5">Tokens in / out</th>
                  <th className="px-2 py-1.5">Cost</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-t border-stone">
                    <td className="px-2 py-1.5 text-ink-2">{r.startedAt.toISOString().slice(0, 16).replace("T", " ")}</td>
                    <td className="px-2 py-1.5 text-ink-2">{r.role}</td>
                    <td className="px-2 py-1.5 text-ink">{modelLabel(r.model)}</td>
                    <td className="px-2 py-1.5">
                      <Badge tone={r.status === "ok" ? "neutral" : "rust"}>{r.status.replace("_", " ")}</Badge>
                    </td>
                    <td className="px-2 py-1.5 font-mono text-ink-2">
                      {r.inputTokens} / {r.outputTokens}
                    </td>
                    <td className="px-2 py-1.5 font-mono text-ink-2">${Number(r.costUsd).toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </Card>
  );
}
