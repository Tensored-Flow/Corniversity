import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/Crest";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-stone bg-paper">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 sm:px-8">
          <Link href="/" className="rounded-sm">
            <Wordmark compact />
          </Link>
          <nav aria-label="Primary" className="flex items-center gap-4 text-sm">
            <Link href="/tour" className="text-ink-2 hover:text-ink">
              A short tour
            </Link>
            <Link href="/sign-in" className="text-brass hover:underline underline-offset-4">
              Sign in
            </Link>
          </nav>
        </div>
      </header>
      <main id="main" className="flex-1">
        {children}
      </main>
      <footer className="border-t border-stone">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 text-xs text-ink-3 sm:px-8">
          Corniversity is a private, independent, non-accredited personal university. Faculty and classmates here are AI personas and are
          labelled as such. Records are informal.
        </div>
      </footer>
    </div>
  );
}
