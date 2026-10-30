import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, EmptyState, LinkButton } from "@/components/ui";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { ensureProfile } from "@corniversity/db/services/onboarding";

export const metadata = { title: "Campus" };

export default async function CampusPage() {
  const session = await requireSession("/campus");
  const profile = await ensureProfile(db(), session.user.id);
  if (!profile.onboardingCompletedAt) {
    redirect(`/onboarding/${profile.onboardingStep}`);
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-8">
        <p className="text-sm uppercase tracking-[0.18em] text-brass">Campus</p>
        <h1 className="mt-1 text-3xl text-ink">Good to see you, {profile.displayName}.</h1>
      </header>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="text-lg text-ink">Next session</h2>
            <EmptyState
              title="Nothing scheduled yet"
              body="Once your first term is confirmed, the next lecture, tutorial or reading appears here with its exact material."
              action={<LinkButton href="/studies" variant="secondary">Open My Studies</LinkButton>}
            />
          </Card>
          <Card>
            <h2 className="text-lg text-ink">Current reading</h2>
            <p className="mt-2 text-sm text-ink-2">Your reader resumes at the page you left. No reading is open yet.</p>
          </Card>
        </div>
        <div className="flex flex-col gap-6">
          <Card as="aside">
            <h2 className="text-lg text-ink">A note from your director</h2>
            <p className="mt-2 text-sm text-ink-2">
              Your programme is not yet confirmed. When it is, a short note about the week appears here.
            </p>
            <Link href="/director" className="mt-3 inline-block text-sm text-brass underline underline-offset-4">
              Open a conversation
            </Link>
          </Card>
          {profile.immersion !== "quiet" ? (
            <Card as="aside">
              <h2 className="text-lg text-ink">Around the college</h2>
              <p className="mt-2 text-sm text-ink-2">
                Society seminars and common-room conversations appear here after you have had a real
                session or two. Nothing happens while you are away.
              </p>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
