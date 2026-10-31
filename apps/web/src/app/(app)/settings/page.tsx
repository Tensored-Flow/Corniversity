import { TIMEZONE_SUGGESTIONS } from "@corniversity/core/onboarding/steps";
import { getEnv } from "@corniversity/db/env";
import { providerSetting } from "@corniversity/db/schema/index";
import { listPersonaMemory } from "@corniversity/db/services/community";
import { ensureProfile } from "@corniversity/db/services/onboarding";
import { getBudgetLimits, getSpend, resolveProviderConfig } from "@corniversity/db/services/provider-config";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { Badge, Button, Card, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import {
  deleteMemoryAction,
  purgeMemoryAction,
  saveBudgetAction,
  saveProviderAction,
  updateExperienceAction,
  updateProfileAction,
} from "./actions";

export const metadata = { title: "Settings" };

/**
 * Settings edit the baseline that orientation wrote: identity and goals, the experience
 * (immersion, theme, type size, motion, social layer, notifications), the model provider and
 * its budgets, and the memory each persona holds about the learner, inspectable and deletable.
 */
export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const session = await requireSession("/settings");
  const flash = await searchParams;
  const database = db();
  const env = getEnv();
  const ownerId = session.user.id;
  const [profile, config, limits, spend, memory, setting] = await Promise.all([
    ensureProfile(database, ownerId),
    resolveProviderConfig(database, ownerId, env),
    getBudgetLimits(database, ownerId, env),
    getSpend(database, ownerId),
    listPersonaMemory(database, ownerId),
    database
      .select({ hint: providerSetting.apiKeyHint, provider: providerSetting.provider })
      .from(providerSetting)
      .where(eq(providerSetting.userId, ownerId))
      .limit(1),
  ]);
  const hint = setting[0]?.hint ?? null;
  const fontScale = profile.accessibility.fontScale ?? 1;

  return (
    <div className="mx-auto w-full max-w-4xl">
      <header className="mb-6">
        <p className="text-sm uppercase tracking-[0.18em] text-brass">Settings</p>
        <h1 className="mt-1 text-3xl text-ink">Your settings</h1>
        <p className="mt-2 max-w-prose text-sm text-ink-2">
          Everything orientation asked can be changed here. Course modes and the timetable are edited in{" "}
          <Link href="/studies" className="text-brass underline underline-offset-4">
            My Studies
          </Link>{" "}
          and{" "}
          <Link href="/timetable" className="text-brass underline underline-offset-4">
            Timetable
          </Link>
          ; library permissions on each item's page; desktop sync under{" "}
          <Link href="/library/sync" className="text-brass underline underline-offset-4">
            Library
          </Link>
          ; exports under{" "}
          <Link href="/records" className="text-brass underline underline-offset-4">
            Records
          </Link>
          .
        </p>
      </header>
      {flash.saved ? (
        <div className="mb-4">
          <Notice tone="moss">Saved.</Notice>
        </div>
      ) : null}
      {flash.error ? (
        <div className="mb-4">
          <Notice tone="rust">{flash.error}</Notice>
        </div>
      ) : null}

      <div className="flex flex-col gap-6">
        <Card as="section" aria-labelledby="profile" id="profile">
          <h2 id="profile-heading" className="text-lg text-ink">
            Who you are and what you are here for
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
            <Field label="Weekly hours ceiling" htmlFor="weeklyHoursCeiling" hint="Caps the timetable and the revision load.">
              <Input
                id="weeklyHoursCeiling"
                name="weeklyHoursCeiling"
                type="number"
                min={1}
                max={60}
                defaultValue={profile.weeklyHoursCeiling ?? ""}
              />
            </Field>
            <Field label="Study rhythm" htmlFor="studyRhythm">
              <Select id="studyRhythm" name="studyRhythm" defaultValue={profile.studyRhythm ?? "term"}>
                <option value="term">Terms with a reading week</option>
                <option value="rolling">Rolling, course by course</option>
                <option value="reading_course">Reading course, lighter rhythm</option>
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Goals, in your words" htmlFor="goalsText">
                <Textarea id="goalsText" name="goalsText" rows={3} defaultValue={profile.goalsText ?? ""} />
              </Field>
            </div>
            <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
              <Button type="submit">Save</Button>
              <Link href="/onboarding/1" className="text-sm text-brass underline underline-offset-4">
                Review every orientation answer
              </Link>
            </div>
          </form>
        </Card>

        <Card as="section" aria-labelledby="experience-heading" id="experience">
          <h2 id="experience-heading" className="text-lg text-ink">
            Experience
          </h2>
          <form action={updateExperienceAction} className="mt-3 grid gap-4 sm:grid-cols-2">
            <fieldset className="sm:col-span-2">
              <legend className="text-sm font-medium text-ink">Immersion</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {[
                  { value: "quiet", title: "Quiet study", body: "Full academic function; no classmates, no societies, no campus flavour." },
                  {
                    value: "collegiate",
                    title: "Collegiate",
                    body: "Faculty, societies and the common room; classmates only when invited.",
                  },
                  { value: "full", title: "Full", body: "Everything on, including classmates in tutorials when you invite them." },
                ].map((o) => (
                  <label
                    key={o.value}
                    className="flex items-start gap-3 rounded-[var(--radius-control)] border border-stone bg-paper-2 p-3 text-sm has-[:checked]:border-brass"
                  >
                    <input
                      type="radio"
                      name="immersion"
                      value={o.value}
                      defaultChecked={profile.immersion === o.value}
                      className="mt-1 accent-[var(--brass)]"
                    />
                    <span>
                      <span className="block font-medium text-ink">{o.title}</span>
                      <span className="block text-xs text-ink-3">{o.body}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
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
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" name="socialLayerEnabled" value="1" defaultChecked={profile.socialLayerEnabled} /> Social layer (AI
                classmates may be invited)
              </label>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" name="notifyInApp" value="1" defaultChecked={profile.notifications.inApp} /> In-app notices
              </label>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" name="notifyEmail" value="1" defaultChecked={profile.notifications.email} /> Email (needs an SMTP
                provider; none configured)
              </label>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">Save</Button>
            </div>
          </form>
        </Card>

        <Card as="section" aria-labelledby="provider-heading" id="provider">
          <h2 id="provider-heading" className="text-lg text-ink">
            Model provider
          </h2>
          <p className="mt-1 text-sm text-ink-2">
            Currently:{" "}
            <Badge tone={config.keyConfigured ? "moss" : "neutral"}>
              {config.keyConfigured
                ? `${config.provider} (${config.source.replace("_", " ")})`
                : "fixture: scripted responses, nothing is sent anywhere"}
            </Badge>
            {hint ? <span className="ml-2 font-mono text-xs text-ink-3">key …{hint}</span> : null}
          </p>
          <p className="mt-1 text-xs text-ink-3">
            Keys are stored encrypted with the server secret and shown only by their last characters. Tutors, the assessor, the reading room
            and discussions use this provider; reading, notes and the timetable never need it.
          </p>
          <form action={saveProviderAction} className="mt-3 grid gap-4 sm:grid-cols-2">
            <Field label="Provider" htmlFor="provider">
              <Select
                id="provider"
                name="provider"
                defaultValue={setting[0]?.provider ?? (config.provider === "anthropic" ? "anthropic" : "fixture")}
              >
                <option value="fixture">Fixture (deterministic, free)</option>
                <option value="anthropic">Anthropic (default model {env.AI_MODEL_DEFAULT})</option>
              </Select>
            </Field>
            <Field label="API key" htmlFor="apiKey" hint="Write-only; leave blank to keep the stored key.">
              <Input id="apiKey" name="apiKey" type="password" autoComplete="off" />
            </Field>
            <label className="flex items-center gap-2 text-sm text-ink sm:col-span-2">
              <input type="checkbox" name="clearKey" value="1" /> Remove the stored key
            </label>
            <div className="sm:col-span-2">
              <Button type="submit">Save provider</Button>
            </div>
          </form>
        </Card>

        <Card as="section" aria-labelledby="budgets-heading" id="budgets">
          <h2 id="budgets-heading" className="text-lg text-ink">
            Budgets
          </h2>
          <p className="mt-1 text-sm text-ink-2">
            Spent today ${spend.todayUsd.toFixed(2)} · this month ${spend.monthUsd.toFixed(2)}. Every paid run is estimated before it starts
            and refused when a limit would be crossed; fixture runs cost nothing.
          </p>
          <form action={saveBudgetAction} className="mt-3 grid gap-4 sm:grid-cols-3">
            <Field label="Per run (USD)" htmlFor="perRunUsd">
              <Input id="perRunUsd" name="perRunUsd" type="number" step="any" min={0.01} defaultValue={limits.perRunUsd} />
            </Field>
            <Field label="Per day (USD)" htmlFor="dailyUsd">
              <Input id="dailyUsd" name="dailyUsd" type="number" step="any" min={0.01} defaultValue={limits.dailyUsd} />
            </Field>
            <Field label="Per month (USD)" htmlFor="monthlyUsd">
              <Input id="monthlyUsd" name="monthlyUsd" type="number" step="any" min={0.01} defaultValue={limits.monthlyUsd} />
            </Field>
            <label className="flex items-center gap-2 text-sm text-ink sm:col-span-3">
              <input type="checkbox" name="hardStop" value="1" defaultChecked={limits.hardStop} /> Hard stop at the limit (no paid runs
              until the window resets)
            </label>
            <div className="sm:col-span-3">
              <Button type="submit">Save budgets</Button>
            </div>
          </form>
        </Card>

        <Card as="section" aria-labelledby="memory-heading" id="memory">
          <h2 id="memory-heading" className="text-lg text-ink">
            What the personas remember
          </h2>
          <p className="mt-1 text-sm text-ink-2">
            Academic summaries, stated preferences and social memory are kept apart and are yours to delete. The academic record itself
            lives in Records and is not affected here.
          </p>
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
            <li>
              With the fixture provider: nothing. With a live provider: the prompts of the runs you start (tutor, assessor, reading room,
              director, discussions), each recorded under Jobs and in the budget ledger.
            </li>
            <li>
              Library items: only passages from items you have explicitly permitted for external AI processing; local-only items never leave
              your device.
            </li>
            <li>
              Calendar subscription links carry a token you can revoke on the Timetable page; the companion's device token is revoked under
              Library → Desktop sync.
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
