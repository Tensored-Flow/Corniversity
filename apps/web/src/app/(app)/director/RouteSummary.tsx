import type { RouteAction, RouteProposal } from "@corniversity/core";
import Link from "next/link";
import { Badge } from "@/components/ui";

const ACTION: Record<RouteAction, { label: string; tone: "moss" | "brass" | "slate" | "neutral" }> = {
  continue: { label: "you take it", tone: "moss" },
  enrol: { label: "enrol from its page, after the workload preview", tone: "brass" },
  audit_or_read: { label: "audit or read alongside", tone: "slate" },
  later: { label: "later, when a place frees up", tone: "neutral" },
};

/** What a programme route proposes, step by step, and exactly what confirming it would change. */
export function RouteSummary({ route }: { route: RouteProposal }) {
  return (
    <div className="mt-2 flex flex-col gap-2 text-xs text-ink-2">
      {route.focusChange ? (
        <p>
          <span className="font-medium text-ink">Focus: </span>
          {route.focusChange.before.length ? route.focusChange.before.join(", ") : "none"} → {route.focusChange.after.join(", ") || "none"}
        </p>
      ) : (
        <p>Your focus stays as it is.</p>
      )}
      {route.steps.length ? (
        <ol className="flex list-decimal flex-col gap-1 pl-4">
          {route.steps.map((s) => (
            <li key={s.courseId}>
              <Link href={`/courses/${s.courseId}`} className="text-ink underline underline-offset-2">
                {s.courseId} {s.title}
              </Link>{" "}
              <Badge tone={ACTION[s.action].tone}>{ACTION[s.action].label}</Badge>
              <span className="block">{s.why}</span>
            </li>
          ))}
        </ol>
      ) : null}
      {route.recognised.length ? (
        <div>
          <p className="font-medium text-ink">Already met</p>
          <ul className="list-disc pl-4">
            {route.recognised.map((r) => (
              <li key={`${r.courseId}-${r.description.slice(0, 24)}`}>
                {r.courseId}: {r.satisfiedBy}
                {r.basis === "self_report" ? " (your own report; unverified until your work shows it)" : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {route.toPrepare.length ? (
        <div>
          <p className="font-medium text-ink">To prepare</p>
          <ul className="list-disc pl-4">
            {route.toPrepare.map((r) => (
              <li key={`${r.courseId}-${r.description.slice(0, 24)}`}>
                {r.courseId} ({r.strength}): {r.description}
                {r.alternativeCourseIds.length ? ` Met by: ${r.alternativeCourseIds.join(", ")}.` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
