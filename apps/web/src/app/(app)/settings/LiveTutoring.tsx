import { BUDGET_CEILINGS, modelLabel, type PublicProviderState, SUPPORTED_MODELS } from "@corniversity/ai";
import type { BudgetLimitsRow, ProviderSettingView } from "@corniversity/db/services/provider-config";
import { Badge, Button, Card, Field, Input, Notice, Select } from "@/components/ui";
import { saveLiveTutoringAction, withdrawApprovalAction } from "./actions";

interface Run {
  id: string;
  role: string;
  model: string;
  status: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: string;
  startedAt: Date;
}

interface Props {
  state: PublicProviderState;
  view: ProviderSettingView;
  limits: BudgetLimitsRow;
  spend: { todayUsd: number; monthUsd: number };
  runs: Run[];
}

/**
 * The live-tutoring settings: which provider answers, the model, the key (write-only, shown by
 * its ends), refusal fallback, the spending limits, and the owner's approval of paid use, all
 * saved together so an approval covers exactly what is on screen. Recent runs show what was
 * actually spent.
 */
export function LiveTutoring({ state, view, limits, spend, runs }: Props) {
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

      <form action={saveLiveTutoringAction} className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Provider" htmlFor="provider-choice">
          <Select id="provider-choice" name="provider" defaultValue={view.provider}>
            <option value="fixture">Scripted demo (no model; nothing is sent anywhere)</option>
            <option value="anthropic">Anthropic (live model, paid)</option>
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
          <legend className="mb-1 text-sm font-medium text-ink">Spending limits (USD), each a hard stop</legend>
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
          A run is refused before it starts if its worst case could cross a limit: the whole output allowance (thinking counts towards it),
          the prompt counted conservatively, and, with fallback on, a second run on the fallback model; runs still in progress count at
          their worst case. Afterwards the run counts at what it actually cost. Spent today ${spend.todayUsd.toFixed(2)} · this month $
          {spend.monthUsd.toFixed(2)} (UTC). Model use is billed by Anthropic to your API account, separately from hosting.
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
