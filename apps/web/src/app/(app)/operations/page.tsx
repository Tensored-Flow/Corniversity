import { publicProviderState, ROLE_CONTRACTS } from "@corniversity/ai";
import { PREPARATION_STAGES } from "@corniversity/core/preparation/pipeline";
import { getEnv } from "@corniversity/db/env";
import { operationsOverview } from "@corniversity/db/services/operations";
import { getBudgetLimits, getSpend, listUnsettledRuns, resolveProviderState } from "@corniversity/db/services/provider-config";
import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";

const STAGE_TITLE = new Map(PREPARATION_STAGES.map((s) => [s.key, s.title]));

function consentLabel(kind: string): string {
  if (kind === "voice-dictation-browser") return "Dictation through the browser's speech service";
  if (kind.startsWith("work-pages-external-ai:")) return "Send these page images for transcription";
  return kind;
}

const link = "text-brass underline underline-offset-4";

/**
 * Academic operations: prepared content, sources still wanted, background jobs, permissions,
 * model use against the budget, recent problems, and preparation tasks by role. Read-only; each
 * section links to the page where it is changed.
 */
export default async function OperationsPage() {
  const auth = await requireSession("/operations");
  const ownerId = auth.user.id;
  const env = getEnv();
  const [o, state, limits, spend, unsettled] = await Promise.all([
    operationsOverview(db(), ownerId),
    resolveProviderState(db(), ownerId, env),
    getBudgetLimits(db(), ownerId, env),
    getSpend(db(), ownerId),
    listUnsettledRuns(db(), ownerId),
  ]);
  const provider = publicProviderState(state);
  const unitsReady = o.units.find((u) => u.status === "ready")?.n ?? 0;
  // As everywhere else, a unit that is not ready is an outline (draft, checking or blocked).
  const unitsOutlined = o.units.reduce((sum, u) => sum + u.n, 0) - unitsReady;
  const tasksByRole = new Map<string, typeof o.tasks>();
  for (const t of o.tasks) tasksByRole.set(t.role, [...(tasksByRole.get(t.role) ?? []), t]);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <p className="text-sm uppercase tracking-[0.18em] text-brass">Academic operations</p>
      <h1 className="mt-1 text-3xl text-ink">How the university is running</h1>
      <p className="mt-2 max-w-prose text-sm text-ink-2">
        Every figure here comes from a record. Changes are made where each section links: settings, the library or a preparation.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card as="section" aria-labelledby="ops-content">
          <h2 id="ops-content" className="text-lg text-ink">
            Prepared content
          </h2>
          <p className="mt-2 text-sm text-ink-2">
            Courses by readiness:{" "}
            {o.readiness
              .map((r) => `${r.readiness.replace(/_/g, " ")} ${r.n}`)
              .sort()
              .join(", ")}
            .
          </p>
          <p className="mt-1 text-sm text-ink-2" data-testid="ops-units">
            Units in current versions: {unitsReady} prepared, {unitsOutlined} outlined.
          </p>
          <p className="mt-1 text-sm text-ink-2">Concept bridges: {o.bridges.map((b) => `${b.n} ${b.status}`).join(", ") || "none"}.</p>
          <h3 className="mt-3 text-sm font-medium text-ink">Visual explanations</h3>
          <ul className="mt-1 flex flex-col gap-1 text-sm">
            {o.visuals.map((v) => (
              <li key={v.slug}>
                <Link href={`/visuals/${v.slug}`} className={link}>
                  {v.title}
                </Link>{" "}
                <span className="text-xs text-ink-3">
                  {v.status} · {v.film ? "film current" : v.stale ? "film withheld (older storyboard)" : "no film"}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card as="section" aria-labelledby="ops-sources">
          <h2 id="ops-sources" className="text-lg text-ink">
            Sources still wanted
          </h2>
          {o.requests.length === 0 ? (
            <p className="mt-2 text-sm text-ink-3">No open requests.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2 text-sm">
              {o.requests.map((r) => (
                <li key={r.id}>
                  <span className="text-ink">{r.title}</span>{" "}
                  {r.courseId ? <span className="text-xs text-ink-3">({r.courseId})</span> : null}
                  <p className="text-xs text-ink-2">{r.why}</p>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-sm">
            <Link href="/library/requests" className={link}>
              Library: books to obtain
            </Link>
          </p>
        </Card>

        <Card as="section" aria-labelledby="ops-jobs">
          <h2 id="ops-jobs" className="text-lg text-ink">
            Background jobs, last seven days
          </h2>
          <p className="mt-2 text-sm text-ink-2" data-testid="ops-jobs">
            {o.jobs.length ? o.jobs.map((j) => `${j.n} ${j.status}`).join(", ") : "None."}
          </p>
          {o.failedJobs.length ? (
            <>
              <h3 className="mt-3 text-sm font-medium text-ink">Recent failures</h3>
              <ul className="mt-1 flex flex-col gap-1 text-xs text-ink-2">
                {o.failedJobs.map((j) => (
                  <li key={j.id}>
                    {j.at.toISOString().slice(0, 16).replace("T", " ")} · {j.kind}: {j.error ?? "no message recorded"}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </Card>

        <Card as="section" aria-labelledby="ops-permissions">
          <h2 id="ops-permissions" className="text-lg text-ink">
            Permissions that stand
          </h2>
          {o.consents.length === 0 && o.permissions.length === 0 ? (
            <p className="mt-2 text-sm text-ink-3">None granted.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1 text-sm text-ink-2">
              {o.consents.map((c) => (
                <li key={`${c.kind}-${c.at.toISOString()}`}>
                  {consentLabel(c.kind)} <span className="text-xs text-ink-3">since {c.at.toISOString().slice(0, 10)}</span>
                </li>
              ))}
              {o.permissions.map((p) => (
                <li key={p.action}>
                  Library processing ({p.action.replace(/_/g, " ")}): {p.n} file{p.n === 1 ? "" : "s"}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-sm">
            <Link href="/settings#voice" className={link}>
              Voice settings
            </Link>{" "}
            ·{" "}
            <Link href="/library" className={link}>
              Library permissions
            </Link>
          </p>
        </Card>

        <Card as="section" aria-labelledby="ops-models">
          <h2 id="ops-models" className="text-lg text-ink">
            Model use and budget
          </h2>
          <p className="mt-2 text-sm text-ink-2" data-testid="ops-provider">
            {provider.mode === "scripted"
              ? "Scripted demo: no model is called and nothing is spent."
              : provider.mode === "live"
                ? `Live model: ${provider.model}.`
                : `Blocked: ${provider.reason}`}
          </p>
          <p className="mt-1 text-sm text-ink-2">
            Spent or held today ${spend.todayUsd.toFixed(4)} of ${limits.dailyUsd.toFixed(2)}; this month ${spend.monthUsd.toFixed(4)} of $
            {limits.monthlyUsd.toFixed(2)}; at most ${limits.perRunUsd.toFixed(2)} a run.
          </p>
          {unsettled.length ? (
            <p className="mt-1 text-sm text-rust">
              {unsettled.length} run{unsettled.length === 1 ? "" : "s"} awaiting settlement, counted at the worst case.
            </p>
          ) : null}
          {o.runErrors.length ? (
            <>
              <h3 className="mt-3 text-sm font-medium text-ink">Recent problems</h3>
              <ul className="mt-1 flex flex-col gap-1 text-xs text-ink-2">
                {o.runErrors.map((r) => (
                  <li key={r.id}>
                    {r.at.toISOString().slice(0, 16).replace("T", " ")} · {r.role} · {r.status.replace(/_/g, " ")}
                    {r.error ? `: ${r.error}` : ""}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <p className="mt-3 text-sm">
            <Link href="/settings#provider" className={link}>
              Live tutoring settings
            </Link>
          </p>
        </Card>

        <Card as="section" aria-labelledby="ops-tasks">
          <h2 id="ops-tasks" className="text-lg text-ink">
            Preparation tasks by role
          </h2>
          <p className="mt-1 text-xs text-ink-3">
            Each role works on the same records within its contract: it proposes, a service checks and records, and publication is yours.
          </p>
          {o.tasks.length === 0 ? (
            <p className="mt-2 text-sm text-ink-3">No preparation is in progress.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-3 text-sm">
              {[...tasksByRole.entries()].map(([role, tasks]) => (
                <li key={role}>
                  <p className="font-medium text-ink">{role === "owner" ? "You" : role}</p>
                  <ul className="mt-1 flex flex-col gap-1">
                    {tasks.map((t) => (
                      <li key={`${t.requestId}-${t.stageKey}-${t.unitKey ?? ""}`} className="flex flex-wrap items-center gap-2 text-xs">
                        <Badge tone={t.status === "done" ? "moss" : t.status === "blocked" || t.status === "failed" ? "rust" : "neutral"}>
                          {t.status}
                        </Badge>
                        <Link href={`/preparations/${t.requestId}`} className={link}>
                          {STAGE_TITLE.get(t.stageKey as (typeof PREPARATION_STAGES)[number]["key"]) ?? t.stageKey}
                        </Link>
                        <span className="text-ink-3">
                          {t.courseId}
                          {t.unitKey ? ` · ${t.unitKey}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-ink-2">Roles and their limits</summary>
            <ul className="mt-2 flex flex-col gap-2 text-xs text-ink-2">
              {Object.values(ROLE_CONTRACTS).map((c) => (
                <li key={c.role}>
                  <span className="font-medium text-ink">{c.role}</span> (v{c.version}): {c.purpose} Tools:{" "}
                  {c.allowedTools.length ? c.allowedTools.join(", ") : "none"}. At most ${c.limits.maxRunUsd.toFixed(2)} a run.
                </li>
              ))}
            </ul>
          </details>
        </Card>
      </div>
    </div>
  );
}
