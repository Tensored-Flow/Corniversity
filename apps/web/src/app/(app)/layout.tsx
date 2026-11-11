import { ensureProfile } from "@corniversity/db/services/onboarding";
import Link from "next/link";
import type { ReactNode } from "react";
import { AccountMenu } from "@/components/AccountMenu";
import { Wordmark } from "@/components/Crest";
import { SideNav } from "@/components/SideNav";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();
  const profile = await ensureProfile(db(), session.user.id);

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[200px_1fr]">
      <aside className="border-b border-stone bg-paper md:border-b-0 md:border-r">
        <div className="flex items-center justify-between px-4 py-4 md:block">
          <Link href="/campus" className="rounded-sm">
            <Wordmark compact />
          </Link>
          <div className="md:hidden">
            <AccountMenu name={profile.displayName} />
          </div>
        </div>
        <div className="px-3 pb-3 md:pb-6">
          <SideNav />
        </div>
      </aside>
      <div className="flex min-h-dvh flex-col">
        <header className="hidden items-center justify-end border-b border-stone px-8 py-3 md:flex">
          <AccountMenu name={profile.displayName} />
        </header>
        <main id="main" className="flex-1 px-4 py-6 sm:px-8 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
