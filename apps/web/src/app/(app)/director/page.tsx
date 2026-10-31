import { listPersonas } from "@corniversity/db/services/catalogue";
import { listEnrolments } from "@corniversity/db/services/enrolment";
import { ensureProfile } from "@corniversity/db/services/onboarding";
import { listOpenProposals } from "@corniversity/db/services/timetable";
import { getOrCreateConversation, listMessages } from "@corniversity/db/services/tutoring";
import { AiLabel, Badge, Card, Notice } from "@/components/ui";
import { db } from "@/lib/db";
import { renderMarkdown } from "@/lib/markdown";
import { requireSession } from "@/lib/session";
import { DirectorPanel } from "./DirectorPanel";

export const metadata = { title: "Director of Studies" };

export default async function DirectorPage() {
  const session = await requireSession("/director");
  const profile = await ensureProfile(db(), session.user.id);
  const [personas, enrolments, proposals] = await Promise.all([
    listPersonas(db()),
    listEnrolments(db(), session.user.id),
    listOpenProposals(db(), session.user.id),
  ]);
  const director = personas.find((p) => p.role === "director");
  const conversation = await getOrCreateConversation(db(), {
    ownerId: session.user.id,
    role: "director",
    personaId: director?.id,
    purpose: "programme",
    allowedLocatorIds: [],
  });
  const messages = await listMessages(db(), conversation.id);
  const rendered = await Promise.all(
    messages.map(async (m) => ({ id: m.id, sender: m.sender, html: await renderMarkdown(m.contentMarkdown) })),
  );

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-6">
        <p className="text-sm uppercase tracking-[0.18em] text-brass">Director of Studies</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl text-ink">{director?.name ?? "Director of Studies"}</h1>
          <AiLabel kind="Director" />
        </div>
        <p className="mt-2 max-w-prose text-sm text-ink-2">{director?.introduction}</p>
      </header>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <DirectorPanel conversationId={conversation.id} initialMessages={rendered} personaName={director?.name ?? "Director"} />
        </Card>
        <div className="flex flex-col gap-6">
          <Card as="aside">
            <h2 className="text-lg text-ink">Your programme</h2>
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {enrolments
                .filter((e) => e.enrolment.status !== "withdrawn")
                .map((e) => (
                  <li key={e.enrolment.id} className="flex items-center justify-between gap-2">
                    <span className="text-ink">{e.course.title}</span>
                    <Badge>{e.enrolment.mode.replace("_", " ")}</Badge>
                  </li>
                ))}
              {enrolments.length === 0 ? <li className="text-ink-3">No courses yet.</li> : null}
            </ul>
            <p className="mt-3 text-xs text-ink-3">Goals: {profile.goalsText || "not stated yet"}</p>
          </Card>
          <Card as="aside">
            <h2 className="text-lg text-ink">Proposals</h2>
            {proposals.length === 0 ? (
              <p className="mt-2 text-sm text-ink-2">
                None open. Changes the director suggests become drafts here, and on the timetable page, for you to confirm or reject.
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2 text-sm">
                {proposals.map((p) => (
                  <li key={p.id} className="rounded-[var(--radius-control)] border border-stone bg-paper p-2">
                    <Badge tone="brass">{p.kind}</Badge> <span className="text-ink">{p.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Notice tone="neutral">
            The director cannot enrol, withdraw, change grades or touch external calendars. Every change is a draft you confirm.
          </Notice>
        </div>
      </div>
    </div>
  );
}
