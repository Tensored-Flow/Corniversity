import { peerMembership } from "@corniversity/db/schema/index";
import { listPersonas } from "@corniversity/db/services/catalogue";
import { listEnrolments } from "@corniversity/db/services/enrolment";
import { nextSession } from "@corniversity/db/services/timetable";
import { eq } from "drizzle-orm";
import { AiLabel, Card, Notice } from "@/components/ui";
import { db } from "@/lib/db";
import { saveMeetAction } from "../actions";
import { Fieldset, StepFooter, type StepProps } from "./shared";

export async function StepMeet({ userId, profile }: StepProps) {
  const [personas, enrolments, memberships, next] = await Promise.all([
    listPersonas(db()),
    listEnrolments(db(), userId),
    db().select().from(peerMembership).where(eq(peerMembership.ownerId, userId)),
    nextSession(db(), userId),
  ]);
  const director = personas.find((p) => p.role === "director");
  const tutorIds = new Set(
    enrolments
      .filter((e) => e.enrolment.status === "active")
      .map((e) => e.version.tutorPersonaId)
      .filter(Boolean),
  );
  const tutors = personas.filter((p) => tutorIds.has(p.id));
  const peers = personas.filter((p) => p.isPeer);
  const enabled = new Set(memberships.filter((m) => m.enabled).map((m) => m.personaId));
  const nextHref = next?.unitId
    ? `/courses/${enrolments.find((e) => e.enrolment.id === next.enrolmentId)?.course.id ?? ""}/units/${next.unitId}`
    : "/campus";
  const quiet = profile.immersion === "quiet";

  return (
    <form action={saveMeetAction} className="flex max-w-3xl flex-col gap-8">
      <input type="hidden" name="next" value={nextHref} />
      <section className="flex flex-col gap-4">
        {director ? (
          <Card>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg text-ink">{director.name}</h2>
              <AiLabel kind={director.title} />
            </div>
            <p className="mt-2 text-sm text-ink-2">{director.introduction}</p>
          </Card>
        ) : null}
        {tutors.map((t) => (
          <Card key={t.id}>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg text-ink">{t.name}</h2>
              <AiLabel kind={t.title} />
            </div>
            <p className="mt-2 text-sm text-ink-2">{t.introduction}</p>
            <p className="mt-2 text-xs text-ink-3">{t.style.officeHours}</p>
          </Card>
        ))}
      </section>

      {quiet ? (
        <Notice tone="neutral">You chose quiet study, so no classmates are offered. You can change this in Settings at any time.</Notice>
      ) : (
        <Fieldset
          legend="Classmates (optional)"
          hint="AI personas with distinct reasoning styles. They join only when you invite them to a discussion; they never message you first and nothing happens while you are away. Tick none if you prefer."
        >
          <div className="grid gap-2 sm:grid-cols-3">
            {peers.map((p) => (
              <label
                key={p.id}
                className="flex flex-col gap-1 rounded-[var(--radius-panel)] border border-stone bg-paper-2 p-3 text-sm has-[:checked]:border-brass"
              >
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="peerPersonaIds"
                    value={p.id}
                    defaultChecked={enabled.has(p.id)}
                    className="accent-[var(--brass)]"
                  />
                  <span className="font-medium text-ink">{p.name}</span>
                  <AiLabel kind="classmate" />
                </span>
                <span className="text-xs text-ink-2">{p.style.approach}</span>
              </label>
            ))}
          </div>
        </Fieldset>
      )}

      <StepFooter step={12} continueLabel={next ? "Enter your first activity" : "Go to the campus"} />
    </form>
  );
}
