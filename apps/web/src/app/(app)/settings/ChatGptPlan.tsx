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
    text: "Eligible usage in this app uses your ChatGPT plan. Manage usage in your ChatGPT settings. Pick a model and approve below; nothing is sent before that.",
  },
  saved: { tone: "moss", text: "Saved." },
  "signed-out": {
    tone: "neutral",
    text: "Signed out. OpenAI confirmed the session was revoked; the tokens are gone from this computer.",
  },
  "signed-out-unconfirmed": {
    tone: "neutral",
    text: "Signed out and the tokens are gone from this computer, but OpenAI didn't confirm the revocation. Disconnect Corniversity in your ChatGPT settings to be sure.",
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
        ChatGPT plan
      </h2>
      <p className="mt-1 max-w-prose text-sm text-ink-2">
        Use your ChatGPT plan instead of an API key. You sign in on OpenAI&apos;s page; Corniversity never sees your password or your
        ChatGPT conversations.
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
          <Notice tone="neutral" title="Local installation only">
            {unavailableReason} Run <code>pnpm local:owner</code> on your computer to use it there. For this site, OpenAI&apos;s{" "}
            <a className="underline" href={CHATGPT_PLAN_INTEREST_FORM_URL} rel="noreferrer noopener" target="_blank">
              interest form
            </a>{" "}
            is the route.
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
                <span>The sign-in expired or was revoked. Continue with ChatGPT to sign in again.</span>
              </>
            ) : (
              <>
                <Badge>not connected</Badge>
                <span>Nothing is sent until you sign in and approve.</span>
              </>
            )}
          </div>
          {!chosen ? <p className="text-xs text-ink-3">Also choose “Your ChatGPT plan” as the teacher above.</p> : null}

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
              Paused because {settings.pausedReason}. {manageUsage}, then resume.
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
                <Field label="Model" htmlFor="planModel" hint="From your ChatGPT account's list.">
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
                Used {counts.today}/{settings.dailyRequests} today and {counts.month}/{settings.monthlyRequests} this month (UTC). Your
                plan&apos;s own limits also apply. {manageUsage}
              </p>
              <label className="flex items-start gap-2 rounded-[var(--radius-control)] border border-stone bg-paper p-3 text-sm text-ink sm:col-span-3">
                <input type="checkbox" name="approvePlanUse" value="1" className="mt-1" />
                <span>
                  I approve teaching through my ChatGPT plan with this model within these limits (it can draw on the plan&apos;s credits). A
                  new model or higher limit needs approval again.
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
                  <span className="text-xs text-ink-3">Not approved yet.</span>
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
