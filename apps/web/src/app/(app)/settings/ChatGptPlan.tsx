import {
  CHATGPT_MANAGE_USAGE_URL,
  CHATGPT_PLAN_INTEREST_FORM_URL,
  PLAN_REQUEST_CEILINGS,
  type PlanModel,
  type PlanUseApproval,
} from "@corniversity/ai";
import type { PlanConnection } from "@corniversity/db/services/chatgpt-plan";
import { Badge, Button, Card, Field, Input, Notice, Select } from "@/components/ui";
import { errorNotice } from "@/lib/notices";
import {
  disconnectPlanAction,
  resumePlanUseAction,
  savePlanSettingsAction,
  startPlanSignInAction,
  withdrawPlanApprovalAction,
} from "./actions";

interface Props {
  /** Null when this installation may use the plan; else why it cannot. */
  unavailableReason: string | null;
  chosen: boolean;
  connection: PlanConnection;
  models: PlanModel[] | { error: string };
  settings: {
    model: string | null;
    dailyRequests: number;
    monthlyRequests: number;
    approval: PlanUseApproval | null;
    pausedReason: string | null;
  };
  counts: { today: number; month: number };
  flash: { plan?: string; planError?: string };
}

const FLASH: Record<string, { tone: "moss" | "neutral"; title?: string; text: string }> = {
  connected: {
    tone: "moss",
    title: "You're using your ChatGPT plan",
    text: "Eligible usage in this app uses your ChatGPT plan. Manage usage in your ChatGPT settings. Choose a model and approve its use below before anything is sent.",
  },
  saved: { tone: "moss", text: "Saved." },
  "signed-out": {
    tone: "neutral",
    text: "Signed out of ChatGPT here. OpenAI confirmed the session was revoked, and the tokens were removed from this computer.",
  },
  "signed-out-unconfirmed": {
    tone: "neutral",
    text: "Signed out of ChatGPT here and the tokens were removed from this computer, but OpenAI did not confirm the revocation. You can disconnect Corniversity in your ChatGPT settings.",
  },
  resumed: { tone: "moss", text: "Plan requests resumed." },
};

const manageUsage = (
  <a className="underline" href={CHATGPT_MANAGE_USAGE_URL} rel="noreferrer noopener" target="_blank">
    Manage usage
  </a>
);

/**
 * Teaching through the owner's own ChatGPT plan (local installation only): the sign-in with
 * OpenAI, separate from the Corniversity account; the model chosen from the account's list;
 * request limits a day and a month; and the owner's approval of exactly those. A usage limit or
 * an eligibility refusal pauses plan requests until the owner resumes them.
 */
export function ChatGptPlan({ unavailableReason, chosen, connection, models, settings, counts, flash }: Props) {
  const notice = flash.plan && Object.hasOwn(FLASH, flash.plan) ? FLASH[flash.plan] : undefined;
  return (
    <Card as="section" aria-labelledby="chatgpt-plan-heading" id="chatgpt-plan">
      <h2 id="chatgpt-plan-heading" className="text-lg text-ink">
        Use your ChatGPT plan
      </h2>
      <p className="mt-1 max-w-prose text-sm text-ink-2">
        Complete eligible AI requests in this app with usage included in your ChatGPT plan or credits balance, instead of an API key. This
        is a sign-in with OpenAI, separate from your Corniversity account: you sign in on OpenAI's own page, and OpenAI states that plan
        usage does not give this app access to your ChatGPT conversations or other account context.
      </p>
      {notice ? (
        <div className="mt-2">
          <Notice tone={notice.tone} title={notice.title}>
            {notice.text}
          </Notice>
        </div>
      ) : null}
      {flash.planError ? (
        <div className="mt-2">
          <Notice tone="rust">{errorNotice(flash.planError)}</Notice>
        </div>
      ) : null}

      {unavailableReason ? (
        <div className="mt-3" data-testid="plan-unavailable">
          <Notice tone="neutral" title="Available in a local installation only">
            {unavailableReason} To teach through your plan, run Corniversity on your own computer (the owner's local installation in
            USER_ACTIONS.md) and connect there. For this hosted site, OpenAI's{" "}
            <a className="underline" href={CHATGPT_PLAN_INTEREST_FORM_URL} rel="noreferrer noopener" target="_blank">
              interest form
            </a>{" "}
            is the route; until OpenAI approves it, this site uses the scripted demo or an API key.
          </Notice>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-ink" data-testid="plan-connection">
            {connection.state === "connected" ? (
              <>
                <Badge tone="moss">connected</Badge>
                <span>
                  Signed in to ChatGPT{connection.email ? ` as ${connection.email}` : ""} since{" "}
                  {new Date(connection.since).toLocaleDateString("en-GB")}.
                </span>
              </>
            ) : connection.state === "reconnect" ? (
              <>
                <Badge tone="rust">sign in again</Badge>
                <span>The ChatGPT sign-in can no longer be used, so nothing is sent. Continue with ChatGPT to sign in again.</span>
              </>
            ) : (
              <>
                <Badge>not connected</Badge>
                <span>Nothing is sent to ChatGPT until you sign in and approve its use.</span>
              </>
            )}
          </div>
          {!chosen ? (
            <p className="text-xs text-ink-3">
              To teach with it, also choose “Your ChatGPT plan” as the provider under Live tutoring above. Choosing it never falls back to
              an API key or to scripted replies.
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {connection.state !== "connected" ? (
              <form action={startPlanSignInAction}>
                <Button type="submit">Continue with ChatGPT</Button>
              </form>
            ) : (
              <form action={disconnectPlanAction}>
                <Button type="submit" variant="secondary">
                  Sign out of ChatGPT here
                </Button>
              </form>
            )}
            {connection.state !== "missing" || connection.registered ? (
              <form action={startPlanSignInAction}>
                <input type="hidden" name="otherAccount" value="1" />
                <Button type="submit" variant="quiet">
                  Use a different ChatGPT account
                </Button>
              </form>
            ) : null}
          </div>

          {settings.pausedReason ? (
            <Notice tone="rust" title="Plan requests are paused">
              Paused because {settings.pausedReason}. {manageUsage} in ChatGPT, then resume here when you are ready; Corniversity does not
              guess when a limit resets.
              <form action={resumePlanUseAction} className="mt-2">
                <Button type="submit" variant="secondary">
                  Resume plan requests
                </Button>
              </form>
            </Notice>
          ) : null}

          {connection.state === "connected" ? (
            <form action={savePlanSettingsAction} className="grid gap-4 sm:grid-cols-3">
              {"error" in models ? (
                <div className="sm:col-span-3">
                  <Notice tone="rust">The model list could not be read: {models.error}</Notice>
                  <input type="hidden" name="planModel" value={settings.model ?? ""} />
                </div>
              ) : (
                <Field
                  label="Model"
                  htmlFor="planModel"
                  hint="From your ChatGPT account's list. A completed request is what confirms access."
                >
                  <Select id="planModel" name="planModel" defaultValue={settings.model ?? ""}>
                    <option value="">Choose a model</option>
                    {models.map((m) => (
                      <option key={m.slug} value={m.slug}>
                        {m.displayName}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              <Field label="Requests a day (UTC)" htmlFor="planDailyRequests">
                <Input
                  id="planDailyRequests"
                  name="planDailyRequests"
                  type="number"
                  step="1"
                  min={1}
                  max={PLAN_REQUEST_CEILINGS.dailyRequests}
                  defaultValue={settings.dailyRequests}
                />
              </Field>
              <Field label="Requests a month (UTC)" htmlFor="planMonthlyRequests">
                <Input
                  id="planMonthlyRequests"
                  name="planMonthlyRequests"
                  type="number"
                  step="1"
                  min={1}
                  max={PLAN_REQUEST_CEILINGS.monthlyRequests}
                  defaultValue={settings.monthlyRequests}
                />
              </Field>
              <p className="text-xs text-ink-3 sm:col-span-3" data-testid="plan-usage">
                Requests through your plan: {counts.today} of {settings.dailyRequests} today, {counts.month} of {settings.monthlyRequests}{" "}
                this month. Every tutor turn, assessment, transcription or drafting step is one request, refused before it starts once a
                limit is reached. These limits are yours; your plan has its own, which OpenAI applies across every app using it.{" "}
                {manageUsage}
              </p>
              <label className="flex items-start gap-2 rounded-[var(--radius-control)] border border-stone bg-paper p-3 text-sm text-ink sm:col-span-3">
                <input type="checkbox" name="approvePlanUse" value="1" className="mt-1" />
                <span>
                  I approve teaching through my ChatGPT plan with this model within these request limits. Requests draw on my plan's usage,
                  and on its credits balance if it has one. Changing the model or raising a limit needs approval again.
                </span>
              </label>
              <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
                <Button type="submit">Save ChatGPT plan settings</Button>
                {settings.approval ? (
                  <span className="text-xs text-ink-3">
                    Approved on {new Date(settings.approval.approvedAt).toLocaleDateString("en-GB")} for {settings.approval.model}, up to{" "}
                    {settings.approval.dailyRequests} a day and {settings.approval.monthlyRequests} a month.
                  </span>
                ) : (
                  <span className="text-xs text-ink-3">Not approved: nothing is sent through your plan.</span>
                )}
              </div>
            </form>
          ) : null}
          {settings.approval ? (
            <form action={withdrawPlanApprovalAction}>
              <Button type="submit" variant="quiet">
                Withdraw approval of plan use
              </Button>
            </form>
          ) : null}
        </div>
      )}
    </Card>
  );
}
