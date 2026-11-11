import { publicProviderState } from "@corniversity/ai";
import { TIMEZONE_SUGGESTIONS } from "@corniversity/core/onboarding/steps";
import { getEnv } from "@corniversity/db/env";
import { planConnection, planModels, planRequestCounts, planUnavailableReason } from "@corniversity/db/services/chatgpt-plan";
import { listPersonaMemory } from "@corniversity/db/services/community";
import { ensureProfile } from "@corniversity/db/services/onboarding";
import {
  getBudgetLimits,
  getSpend,
  listRecentRuns,
  listUnsettledRuns,
  providerSettingView,
  resolveProviderState,
} from "@corniversity/db/services/provider-config";
import { voiceDictationAllowed } from "@corniversity/db/services/voice";
import { Badge, Button, Card, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { db } from "@/lib/db";
import { errorNotice } from "@/lib/notices";
import { requireSession } from "@/lib/session";
import {
  allowVoiceAction,
  deleteMemoryAction,
  purgeMemoryAction,
  updateExperienceAction,
  updateProfileAction,
  withdrawVoiceAction,
} from "./actions";
import { ChatGptPlan } from "./ChatGptPlan";
import { LiveTutoring } from "./LiveTutoring";

export const metadata = { title: "Settings" };

/**
 * Settings edit the baseline that orientation wrote: identity and goals, the experience
 * (immersion, theme, type size, motion, social layer, notifications), the model provider and
 * its budgets, and the memory each persona holds about the learner, inspectable and deletable.
 */
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; plan?: string; planError?: string }>;
}) {
  const session = await requireSession("/settings");
  const flash = await searchParams;
  const database = db();
  const env = getEnv();
  const ownerId = session.user.id;
  const [profile, state, view, limits, spend, runs, unsettled, memory, voiceAllowed] = await Promise.all([
    ensureProfile(database, ownerId),
    resolveProviderState(database, ownerId, env),
    providerSettingView(database, ownerId, env),
    getBudgetLimits(database, ownerId, env),
    getSpend(database, ownerId),
    listRecentRuns(database, ownerId),
    listUnsettledRuns(database, ownerId),
    listPersonaMemory(database, ownerId),
    voiceDictationAllowed(database, ownerId),
  ]);
  const fontScale = profile.accessibility.fontScale ?? 1;
  const planUnavailable = planUnavailableReason(env);
  const [planConn, planCounts] = await Promise.all([planConnection(env, ownerId), planRequestCounts(database, ownerId)]);
  const planModelList =
    planConn.state === "connected"
      ? await planModels(database, env, ownerId).catch((error: unknown) => ({
          error: error instanceof Error ? error.message : "no answer from ChatGPT.",
        }))
      : [];

  return (
    <div className="mx-auto w-full max-w-4xl">
      <header className="mb-6">
        <h1 className="text-3xl text-ink">Settings</h1>
      </header>
      {flash.saved ? (
        <div className="mb-4">
          <Notice tone="moss">Saved.</Notice>
        </div>
      ) : null}
      {flash.error ? (
        <div className="mb-4">
          <Notice tone="rust">{errorNotice(flash.error)}</Notice>
        </div>
      ) : null}

      <div className="flex flex-col gap-6">
        <Card as="section" aria-labelledby="profile" id="profile">
          <h2 id="profile-heading" className="text-lg text-ink">
            Profile
          </h2>
          <form action={updateProfileAction} className="mt-3 grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="displayName">
              <Input id="displayName" name="displayName" defaultValue={profile.displayName} maxLength={80} required />
            </Field>
            <Field label="Time zone" htmlFor="timezone">
              <Select id="timezone" name="timezone" defaultValue={profile.timezone}>
                {[...new Set([profile.timezone, ...TIMEZONE_SUGGESTIONS])].map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </Select>
            </Field>
            <input type="hidden" name="weeklyHoursCeiling" value={profile.weeklyHoursCeiling ?? ""} />
            <div className="sm:col-span-2">
              <Field label="Goals (the tutor sees these)" htmlFor="goalsText">
                <Textarea id="goalsText" name="goalsText" rows={2} defaultValue={profile.goalsText ?? ""} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">Save</Button>
            </div>
          </form>
        </Card>

        <Card as="section" aria-labelledby="experience-heading" id="experience">
          <h2 id="experience-heading" className="text-lg text-ink">
            Appearance
          </h2>
          <form action={updateExperienceAction} className="mt-3 grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="immersion" value={profile.immersion} />
            <Field label="Theme" htmlFor="theme">
              <Select id="theme" name="theme" defaultValue={profile.theme}>
                <option value="light">Light (paper)</option>
                <option value="dark">Dark reading mode</option>
              </Select>
            </Field>
            <Field label="Type size" htmlFor="fontScale">
              <Select id="fontScale" name="fontScale" defaultValue={String(fontScale)}>
                <option value="0.875">Smaller</option>
                <option value="1">Standard</option>
                <option value="1.125">Larger</option>
                <option value="1.25">Largest</option>
              </Select>
            </Field>
            <div className="sm:col-span-2 grid gap-2 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" name="reducedMotion" value="1" defaultChecked={Boolean(profile.accessibility.reducedMotion)} />{" "}
                Reduce motion
              </label>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" name="highContrast" value="1" defaultChecked={Boolean(profile.accessibility.highContrast)} /> Higher
                contrast
              </label>
              {profile.socialLayerEnabled ? <input type="hidden" name="socialLayerEnabled" value="1" /> : null}
              {profile.notifications.inApp ? <input type="hidden" name="notifyInApp" value="1" /> : null}
              {profile.notifications.email ? <input type="hidden" name="notifyEmail" value="1" /> : null}
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">Save</Button>
            </div>
          </form>
        </Card>

        <LiveTutoring state={publicProviderState(state)} view={view} limits={limits} spend={spend} runs={runs} unsettled={unsettled} />
        <ChatGptPlan
          unavailableReason={planUnavailable}
          chosen={view.provider === "chatgpt_plan"}
          connection={planConn}
          models={planModelList}
          settings={{
            model: view.planModel,
            dailyRequests: view.planDailyRequests,
            monthlyRequests: view.planMonthlyRequests,
            approval: view.planApproval,
            pausedReason: view.planPausedReason,
          }}
          counts={planCounts}
          flash={{ plan: flash.plan, planError: flash.planError }}
        />

        <Card as="section" aria-labelledby="voice-heading" id="voice">
          <h2 id="voice-heading" className="text-lg text-ink">
            Voice
          </h2>
          <p className="mt-1 max-w-prose text-sm text-ink-2">
            Read aloud uses voices on this device only. Dictation uses your browser&apos;s speech recognition: Chrome and Edge send the
            audio to Google or Microsoft. Corniversity never keeps audio; you edit the text before sending it.
          </p>
          {voiceAllowed ? (
            <form action={withdrawVoiceAction} className="mt-3 flex flex-wrap items-center gap-3">
              <Badge tone="moss">dictation allowed</Badge>
              <Button type="submit" variant="secondary">
                Stop allowing dictation
              </Button>
            </form>
          ) : (
            <form action={allowVoiceAction} className="mt-3 flex flex-col gap-2">
              <label className="flex items-start gap-2 text-sm text-ink">
                <input type="checkbox" name="understood" value="1" className="mt-1" />
                <span>I understand that my browser may send the audio to its maker&apos;s speech service while I dictate.</span>
              </label>
              <div>
                <Button type="submit">Allow dictation</Button>
              </div>
            </form>
          )}
        </Card>

        <Card as="section" aria-labelledby="memory-heading" id="memory">
          <h2 id="memory-heading" className="text-lg text-ink">
            What tutors remember
          </h2>
          <p className="mt-1 text-sm text-ink-2">Deleting memory leaves your submitted work and records untouched.</p>
          {memory.length === 0 ? (
            <p className="mt-3 text-sm text-ink-3">Nothing stored yet.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {memory.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-[var(--radius-panel)] border border-stone bg-paper-2 px-3 py-2"
                >
                  <div>
                    <p className="text-ink">
                      <span className="font-medium">{m.personaName}</span> ·{" "}
                      <Badge tone={m.kind === "social" ? "slate" : "neutral"}>{m.kind}</Badge>
                    </p>
                    <p className="mt-1 text-ink-2">{m.content}</p>
                    <p className="mt-1 text-xs text-ink-3">
                      {m.provenance} · {m.createdAt.toISOString().slice(0, 10)}
                    </p>
                  </div>
                  <form action={deleteMemoryAction}>
                    <input type="hidden" name="id" value={m.id} />
                    <Button type="submit" variant="quiet">
                      Delete
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {(["social", "preference", "academic"] as const).map((kind) => (
              <form key={kind} action={purgeMemoryAction}>
                <input type="hidden" name="kind" value={kind} />
                <Button type="submit" variant="danger">
                  Delete all {kind} memory
                </Button>
              </form>
            ))}
          </div>
        </Card>

        <Card as="section" aria-labelledby="privacy-heading" id="privacy">
          <h2 id="privacy-heading" className="text-lg text-ink">
            What leaves this installation
          </h2>
          <ul className="mt-2 list-disc pl-5 text-sm text-ink-2">
            <li>Scripted demo: nothing. A connected teacher: the prompts of the requests you make.</li>
            <li>Library files: only passages from items you allowed for AI; local-only items never leave your device.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
